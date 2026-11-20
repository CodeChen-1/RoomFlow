from datetime import UTC, datetime, time, timedelta

from sqlalchemy.orm import Session

from .database import Booking, Room, SeedRecord


ROOMS = [
    ("Atlas Boardroom", 16, "Level 3 · North wing", ["Display", "Video conferencing", "Whiteboard"]),
    ("Cedar Studio", 8, "Level 2 · Garden wing", ["Display", "Whiteboard"]),
    ("Harbor Room", 10, "Level 1 · East wing", ["Projector", "Video conferencing", "Speakerphone"]),
    ("Juniper Huddle", 4, "Level 2 · West wing", ["Display", "Speakerphone"]),
    ("Summit Workshop", 24, "Level 3 · South wing", ["Projector", "Whiteboard", "Video conferencing"]),
    ("Willow Lounge", 6, "Level 1 · Garden wing", ["Whiteboard", "Speakerphone"]),
]


def seed_demo(db: Session, now: datetime):
    if db.get(SeedRecord, "initial-office"):
        return
    rooms = [Room(name=name, capacity=size, location=location, facilities=facilities)
             for name, size, location, facilities in ROOMS]
    db.add_all(rooms)
    local_day = now.astimezone().date()
    meetings = [
        (0, 0, 9, 60, "Product planning", "Amira Hassan"),
        (0, 1, 11, 45, "Design critique", "Maya Chen"),
        (0, 2, 14, 60, "Partner catch-up", "James Tan"),
        (0, 4, 16, 90, "Engineering workshop", "Elena Cruz"),
        (1, 3, 10, 30, "Operations check-in", "Ravi Nair"),
        (1, 5, 15, 45, "Research debrief", "Sofia Lim"),
    ]
    for offset, room, hour, minutes, title, organiser in meetings:
        local_start = datetime.combine(local_day + timedelta(days=offset), time(hour))
        start = local_start.astimezone(UTC)
        db.add(Booking(room=rooms[room], title=title, organiser=organiser, start_at=start,
                       end_at=start + timedelta(minutes=minutes), created_at=now, updated_at=now))
    db.add(SeedRecord(name="initial-office"))
