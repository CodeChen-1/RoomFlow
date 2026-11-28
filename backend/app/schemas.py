from datetime import datetime, timedelta
from typing import Annotated, Literal

from pydantic import AfterValidator, AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints, model_validator

def require_utc(value: datetime) -> datetime:
    if value.utcoffset() != timedelta(0):
        raise ValueError("Send timestamps in UTC, with Z or +00:00.")
    return value


UtcTime = Annotated[AwareDatetime, AfterValidator(require_utc)]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
Organiser = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
RoomId = Annotated[int, Field(gt=0, strict=True)]
Status = Literal["active", "cancelled"]
RoomName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Location = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Capacity = Annotated[int, Field(gt=0, le=500, strict=True)]


class AdminLogin(BaseModel):
    model_config = ConfigDict(extra="forbid")
    password: str = Field(min_length=1, max_length=200)


class RoomCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: RoomName
    capacity: Capacity
    location: Location
    facilities: list[str] = Field(default_factory=list)


class RoomPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: RoomName | None = None
    capacity: Capacity | None = None
    location: Location | None = None
    facilities: list[str] | None = None

    @model_validator(mode="after")
    def validate_changes(self):
        if not self.model_fields_set or any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("Provide at least one change and a value for every submitted field.")
        return self

class BookingCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    room_id: RoomId
    title: Title
    organiser: Organiser
    start_at: UtcTime
    end_at: UtcTime


class BookingPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    room_id: RoomId | None = None
    title: Title | None = None
    organiser: Organiser | None = None
    start_at: UtcTime | None = None
    end_at: UtcTime | None = None

    @model_validator(mode="after")
    def validate_changes(self):
        if not self.model_fields_set or any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("Provide at least one change and a value for every submitted field.")
        return self


class BookingView(BookingCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    status: Status
    created_at: UtcTime
    updated_at: UtcTime


class RoomView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    capacity: int
    location: str
    facilities: list[str]
    available: bool | None = None
