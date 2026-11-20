from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Barrier

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database import Room
from app.main import create_app


NOW = datetime(2035, 1, 15, 6, tzinfo=UTC)


def payload(start=120, end=180, room=1, title="Planning session"):
    return {
        "room_id": room, "title": title, "organiser": "Alex Morgan",
        "start_at": (NOW + timedelta(minutes=start)).isoformat(),
        "end_at": (NOW + timedelta(minutes=end)).isoformat(),
    }


@pytest.fixture
def api(tmp_path):
    app = create_app(tmp_path / "test.sqlite", seed=False, clock=lambda: NOW)
    with TestClient(app) as client:
        with Session(app.state.engine) as db, db.begin():
            db.add_all([
                Room(name="Test A", capacity=4, location="Floor 1", facilities=["Display"]),
                Room(name="Test B", capacity=8, location="Floor 2", facilities=["Display", "Whiteboard"]),
            ])
        yield client


def create(client, **kwargs):
    result = client.post("/api/bookings", json=payload(**kwargs))
    assert result.status_code == 201, result.text
    return result.json()


def test_create_and_read(api):
    booking = create(api)
    assert booking["status"] == "active"
    assert booking["start_at"].endswith("Z")
    assert api.get(f"/api/bookings/{booking['id']}").json() == booking
    assert api.get("/api/bookings").json() == [booking]


@pytest.mark.parametrize(("start", "end", "room", "expected"), [
    (130, 160, 1, 409), (100, 140, 1, 409), (160, 210, 1, 409),
    (110, 190, 1, 409), (120, 180, 1, 409), (180, 195, 1, 201),
    (90, 120, 1, 201), (130, 160, 2, 201), (200, 440, 1, 201),
])
def test_intervals(api, start, end, room, expected):
    create(api)
    result = api.post("/api/bookings", json=payload(start, end, room))
    assert result.status_code == expected


@pytest.mark.parametrize(("start", "end"), [(95, 94), (90, 90), (31, 45), (30, 271), (-1, 30)])
def test_invalid_times(api, start, end):
    result = api.post("/api/bookings", json=payload(start, end))
    assert result.status_code == 422
    assert result.json()["error"]["message"]


@pytest.mark.parametrize("field", list(payload()))
def test_required_fields(api, field):
    data = payload()
    del data[field]
    assert api.post("/api/bookings", json=data).status_code == 422


def test_naive_timestamps_and_blank_names(api):
    for field, invalid in [("start_at", "2035-01-15T08:00:00"), ("title", " "), ("organiser", "")]:
        assert api.post("/api/bookings", json={**payload(), field: invalid}).status_code == 422


def test_cancel_frees_slot(api):
    original = create(api)
    assert api.post(f"/api/bookings/{original['id']}/cancel").json()["status"] == "cancelled"
    assert api.get(f"/api/bookings/{original['id']}").json()["status"] == "cancelled"
    assert create(api)["id"] != original["id"]


def test_reschedule(api):
    original = create(api)
    url = f"/api/bookings/{original['id']}"
    assert api.patch(url, json={"title": "New title"}).json()["title"] == "New title"
    new_end = payload(end=190)["end_at"]
    assert api.patch(url, json={"end_at": new_end}).status_code == 200
    create(api, start=210, end=260)
    assert api.patch(url, json=payload(220, 240)).status_code == 409
    assert api.get(url).json()["start_at"] == original["start_at"]
    moved = api.patch(url, json=payload(260, 320))
    assert moved.status_code == 200
    assert moved.json()["id"] == original["id"]
    assert api.patch(url, json={"title": None}).status_code == 422


def test_not_found(api):
    for response in [api.get("/api/rooms/999"), api.get("/api/bookings/999"),
                     api.patch("/api/bookings/999", json={"title": "Update"}),
                     api.post("/api/bookings/999/cancel"), api.post("/api/bookings", json=payload(room=99))]:
        assert response.status_code == 404
        assert set(response.json()["error"]) == {"code", "message"}


def test_competing_http_requests(api):
    barrier = Barrier(2)

    def reserve():
        barrier.wait(timeout=5)
        return api.post("/api/bookings", json=payload()).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(lambda _: reserve(), range(2)))
    assert sorted(outcomes) == [201, 409]
    assert len(api.get("/api/bookings").json()) == 1


def test_filter_rooms_and_bookings(api):
    booking = create(api)
    window = {key: booking[key] for key in ("start_at", "end_at")}
    rooms = api.get("/api/rooms", params=window).json()
    assert [room["available"] for room in rooms] == [False, True]
    assert [r["id"] for r in api.get("/api/rooms", params=[
        ("facility", "Display"), ("facility", "Whiteboard"), ("min_capacity", "6")]).json()] == [2]
    assert api.get("/api/bookings", params={**window, "room_id": 2}).json() == []
    assert api.get("/api/bookings", params={"start_at": booking["end_at"]}).json() == []
    api.post(f"/api/bookings/{booking['id']}/cancel")
    assert api.get("/api/rooms", params=window).json()[0]["available"] is True
    assert api.get("/api/bookings", params={"status": "active"}).json() == []


def test_selected_local_day_includes_cross_midnight(api):
    previous = create(api, start=570, end=600)
    crossing = create(api, start=585, end=645, room=2)
    response = api.get("/api/bookings", params={
        "start_at": "2035-01-15T16:00:00Z", "end_at": "2035-01-16T16:00:00Z"})
    assert [item["id"] for item in response.json()] == [crossing["id"]]
    assert previous["id"] != crossing["id"]


def test_restarting_preserves_seed_and_changes(tmp_path):
    path = tmp_path / "seed.sqlite"
    with TestClient(create_app(path, clock=lambda: NOW)) as first:
        rooms = first.get("/api/rooms").json()
        bookings = first.get("/api/bookings").json()
        assert len(rooms) >= 5 and len(bookings) >= 3
        first.post(f"/api/bookings/{bookings[0]['id']}/cancel").raise_for_status()
    with TestClient(create_app(path, clock=lambda: NOW + timedelta(days=1))) as second:
        assert second.get("/api/rooms").json() == rooms
        restored = second.get("/api/bookings").json()
        assert len(restored) == len(bookings)
        assert restored[0]["status"] == "cancelled"
