from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database import Booking, Room
from app.main import create_app


NOW = datetime(2035, 1, 15, 6, tzinfo=UTC)


@pytest.fixture
def api(tmp_path):
    app = create_app(tmp_path / "test.sqlite", seed=False, clock=lambda: NOW)
    with TestClient(app) as client:
        with Session(app.state.engine) as db, db.begin():
            room = Room(name="Test A", capacity=4, location="Floor 1", facilities=["Display"])
            db.add(room)
            db.flush()
            db.add(
                Booking(
                    room_id=room.id,
                    title="Booked meeting",
                    organiser="Alex Morgan",
                    start_at=NOW + timedelta(hours=1),
                    end_at=NOW + timedelta(hours=2),
                    created_at=NOW,
                    updated_at=NOW,
                )
            )
        yield client


def test_admin_unconfigured(api, monkeypatch):
    monkeypatch.delenv("ROOMFLOW_ADMIN_PASSWORD", raising=False)
    assert api.get("/api/admin/me").json() == {"configured": False, "authenticated": False}
    assert api.post(
        "/api/rooms",
        json={"name": "Studio", "capacity": 6, "location": "Floor 3", "facilities": []},
    ).status_code == 503


def test_admin_auth_and_room_crud(api, monkeypatch):
    monkeypatch.setenv("ROOMFLOW_ADMIN_PASSWORD", "test-secret")

    # Unauthenticated room creation is rejected
    assert api.post(
        "/api/rooms",
        json={"name": "Studio", "capacity": 6, "location": "Floor 3", "facilities": ["Whiteboard"]},
    ).status_code == 401

    # Wrong password is rejected
    assert api.post("/api/admin/login", json={"password": "wrong"}).status_code == 401

    # Correct password sets session cookie
    login = api.post("/api/admin/login", json={"password": "test-secret"})
    assert login.status_code == 200
    assert api.get("/api/admin/me").json() == {"configured": True, "authenticated": True}

    # Create room
    created = api.post(
        "/api/rooms",
        json={"name": "Studio", "capacity": 6, "location": "Floor 3", "facilities": ["Whiteboard"]},
    )
    assert created.status_code == 201
    room = created.json()
    assert room["name"] == "Studio"

    # Duplicate room name is rejected
    assert api.post(
        "/api/rooms",
        json={"name": "Studio", "capacity": 8, "location": "Floor 4", "facilities": []},
    ).status_code == 409

    # Update room
    updated = api.patch(f"/api/rooms/{room['id']}", json={"capacity": 10, "location": "Floor 4"})
    assert updated.status_code == 200
    assert updated.json()["capacity"] == 10
    assert updated.json()["location"] == "Floor 4"

    # Room with existing bookings cannot be deleted
    assert api.delete("/api/rooms/1").status_code == 409

    # Unused room can be deleted
    assert api.delete(f"/api/rooms/{room['id']}").status_code == 204
    assert api.get(f"/api/rooms/{room['id']}").status_code == 404

    # Logout invalidates access
    assert api.post("/api/admin/logout").status_code == 200
    assert api.get("/api/admin/me").json() == {"configured": True, "authenticated": False}
    assert api.post(
        "/api/rooms",
        json={"name": "Studio 2", "capacity": 4, "location": "Floor 2", "facilities": []},
    ).status_code == 401
