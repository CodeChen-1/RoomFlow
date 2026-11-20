from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import JSON, CheckConstraint, DateTime, ForeignKey, Index, String, URL, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator


class UtcDateTime(TypeDecorator):
    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.utcoffset() is None:
            raise ValueError("A timezone-aware timestamp is required.")
        return value.astimezone(UTC).replace(tzinfo=None)

    def process_result_value(self, value, dialect):
        return value.replace(tzinfo=UTC) if value is not None else None


class Base(DeclarativeBase):
    pass


class Room(Base):
    __tablename__ = "rooms"
    __table_args__ = (CheckConstraint("capacity > 0"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    capacity: Mapped[int]
    location: Mapped[str]
    facilities: Mapped[list[str]] = mapped_column(JSON)
    bookings: Mapped[list["Booking"]] = relationship(back_populates="room")


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        CheckConstraint("status IN ('active','cancelled')"),
        CheckConstraint("end_at > start_at"),
        Index("ix_bookings_room_status_time", "room_id", "status", "start_at", "end_at"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"))
    room: Mapped[Room] = relationship(back_populates="bookings")
    title: Mapped[str] = mapped_column(String(160))
    organiser: Mapped[str] = mapped_column(String(100))
    start_at: Mapped[datetime] = mapped_column(UtcDateTime())
    end_at: Mapped[datetime] = mapped_column(UtcDateTime())
    status: Mapped[str] = mapped_column(String(10), default="active")
    created_at: Mapped[datetime] = mapped_column(UtcDateTime())
    updated_at: Mapped[datetime] = mapped_column(UtcDateTime())


class SeedRecord(Base):
    __tablename__ = "seed_history"
    name: Mapped[str] = mapped_column(primary_key=True)


def make_engine(path: Path):
    engine = create_engine(URL.create("sqlite", database=str(path)),
                           connect_args={"check_same_thread": False, "timeout": 8})

    @event.listens_for(engine, "connect")
    def configure_connection(connection, _record):
        connection.execute("PRAGMA foreign_keys=ON")

    return engine
