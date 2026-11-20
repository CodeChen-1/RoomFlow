import os
import sqlite3
from collections.abc import Callable
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import select, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException

from .database import Base, Booking, Room, make_engine
from .schemas import BookingCreate, BookingPatch, BookingView, RoomView, Status, UtcTime
from .seed import seed_demo


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status = status
        self.code = code
        self.message = message


def failure(status, code, message, headers=None):
    return JSONResponse({"error": {"code": code, "message": message}}, status_code=status, headers=headers)


def session(request: Request):
    with Session(request.app.state.engine, expire_on_commit=False) as db:
        yield db


Db = Annotated[Session, Depends(session)]


def begin_write(db: Session):
    db.execute(text("BEGIN IMMEDIATE"))


def get_record(db, model, resource_id):
    record = db.get(model, resource_id)
    if record is None:
        raise ApiError(404, "not_found", f"{model.__name__} was not found.")
    return record


def overlap(start, end):
    return [Booking.start_at < end, Booking.end_at > start]


def check_window(start, end):
    if start is not None and end is not None and end <= start:
        raise ApiError(422, "invalid_range", "The end time must be later than the start time.")


def check_booking(db, room_id, start, end, now, current=None):
    check_window(start, end)
    if not timedelta(minutes=15) <= end - start <= timedelta(hours=4):
        raise ApiError(422, "invalid_duration", "Reserve between 15 minutes and four hours.")
    if start < now:
        raise ApiError(422, "past_start", "Choose a start time in the future.")
    get_record(db, Room, room_id)
    query = select(Booking.id).where(Booking.room_id == room_id, Booking.status == "active", *overlap(start, end))
    if current is not None:
        query = query.where(Booking.id != current)
    if db.scalar(query.limit(1)) is not None:
        raise ApiError(409, "booking_conflict", "This room is already booked during that time. Choose another room or time.")


def create_app(path: Path | None = None, *, seed: bool = True, clock: Callable[[], datetime] = lambda: datetime.now(UTC)):
    default_path = Path(__file__).resolve().parents[1] / "data" / "roomflow.sqlite3"
    database_path = Path(path or os.environ.get("ROOMFLOW_DB_PATH", default_path))
    engine = make_engine(database_path)

    @asynccontextmanager
    async def lifespan(_app):
        database_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with Session(engine) as db:
                begin_write(db)
                Base.metadata.create_all(db.connection())
                if seed:
                    seed_demo(db, clock())
                db.commit()
            yield
        finally:
            engine.dispose()

    app = FastAPI(title="RoomFlow", lifespan=lifespan)
    app.state.engine = engine

    @app.exception_handler(ApiError)
    async def business_error(_, exc):
        return failure(exc.status, exc.code, exc.message)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(_, exc):
        first = exc.errors()[0]
        field = " ".join(str(item) for item in first["loc"][1:]).replace("_", " ")
        return failure(422, "validation_error", f"{field.capitalize() or 'Request'}: {first['msg']}")

    @app.exception_handler(HTTPException)
    async def http_error(_, exc):
        return failure(exc.status_code, "http_error", str(exc.detail), exc.headers)

    @app.exception_handler(OperationalError)
    async def database_error(_, exc):
        code = getattr(exc.orig, "sqlite_errorcode", 0) or 0
        if code & 255 in (sqlite3.SQLITE_BUSY, sqlite3.SQLITE_LOCKED):
            return failure(503, "database_busy", "The database is busy. Please try again shortly.", {"Retry-After": "1"})
        return failure(500, "database_error", "The database could not complete this request.")

    @app.exception_handler(Exception)
    async def unexpected_error(_, exc):
        return failure(500, "internal_error", "RoomFlow could not complete the request.")

    @app.get("/api/rooms", response_model=list[RoomView])
    def list_rooms(db: Db, start_at: UtcTime | None = None, end_at: UtcTime | None = None,
                   min_capacity: Annotated[int, Query(ge=1)] = 1,
                   facility: Annotated[list[str] | None, Query()] = None):
        if (start_at is None) != (end_at is None):
            raise ApiError(422, "invalid_range", "Supply both a start and an end time to check availability.")
        check_window(start_at, end_at)
        busy = set()
        if start_at is not None:
            busy = set(db.scalars(select(Booking.room_id).where(Booking.status == "active", *overlap(start_at, end_at))))
        required = {name.casefold() for name in facility or []}
        views = []
        for room in db.scalars(select(Room).where(Room.capacity >= min_capacity).order_by(Room.name)):
            if required.issubset(item.casefold() for item in room.facilities):
                view = RoomView.model_validate(room)
                view.available = room.id not in busy if start_at is not None else None
                views.append(view)
        return views

    @app.get("/api/rooms/{room_id}", response_model=RoomView)
    def room_details(room_id: int, db: Db):
        return get_record(db, Room, room_id)

    @app.get("/api/bookings", response_model=list[BookingView])
    def list_bookings(db: Db, start_at: UtcTime | None = None, end_at: UtcTime | None = None,
                      room_id: int | None = None, status: Status | None = None, upcoming: bool = False):
        check_window(start_at, end_at)
        query = select(Booking)
        if start_at is not None:
            query = query.where(Booking.end_at > start_at)
        if end_at is not None:
            query = query.where(Booking.start_at < end_at)
        if room_id is not None:
            query = query.where(Booking.room_id == room_id)
        if status is not None:
            query = query.where(Booking.status == status)
        if upcoming:
            query = query.where(Booking.start_at >= clock(), Booking.status == "active")
        return list(db.scalars(query.order_by(Booking.start_at, Booking.id)))

    @app.get("/api/bookings/{booking_id}", response_model=BookingView)
    def booking_details(booking_id: int, db: Db):
        return get_record(db, Booking, booking_id)

    @app.post("/api/bookings", response_model=BookingView, status_code=201)
    def create_booking(data: BookingCreate, db: Db):
        begin_write(db)
        now = clock()
        check_booking(db, data.room_id, data.start_at, data.end_at, now)
        booking = Booking(**data.model_dump(), created_at=now, updated_at=now)
        db.add(booking)
        db.commit()
        return booking

    @app.patch("/api/bookings/{booking_id}", response_model=BookingView)
    def update_booking(booking_id: int, data: BookingPatch, db: Db):
        begin_write(db)
        booking = get_record(db, Booking, booking_id)
        if booking.status == "cancelled":
            raise ApiError(409, "cancelled_booking", "Cancelled reservations cannot be edited.")
        changes = data.model_dump(exclude_unset=True)
        now = clock()
        if any(changes.get(field, getattr(booking, field)) != getattr(booking, field)
               for field in ("room_id", "start_at", "end_at")):
            check_booking(db, changes.get("room_id", booking.room_id), changes.get("start_at", booking.start_at),
                          changes.get("end_at", booking.end_at), now, current=booking.id)
        for field, value in changes.items():
            setattr(booking, field, value)
        booking.updated_at = now
        db.commit()
        return booking

    @app.post("/api/bookings/{booking_id}/cancel", response_model=BookingView)
    def cancel_booking(booking_id: int, db: Db):
        begin_write(db)
        booking = get_record(db, Booking, booking_id)
        if booking.status != "cancelled":
            booking.status = "cancelled"
            booking.updated_at = clock()
        db.commit()
        return booking

    return app


app = create_app()
