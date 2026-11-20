# RoomFlow — Smart Room Booking System

RoomFlow is a local meeting-room planner for a small office. The dashboard shows utilisation, the room directory helps you find a space for a time range, and Reservations lets you edit, move or cancel meetings. The application runs on your computer without a service account or API key.

## Run on Windows

Install Python 3.13 and Node.js 24 with npm. Dependency installation requires internet access on a fresh machine. Open two PowerShell terminals with the cloned RoomFlow repository as the current directory. Run the following in the first terminal.

```powershell
Set-Location .\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Run the following in the second terminal.

```powershell
Set-Location .\frontend
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open [RoomFlow](http://127.0.0.1:5173). Interactive API documentation is available in [FastAPI Swagger UI](http://127.0.0.1:8000/docs). Stop each server with Ctrl+C. On subsequent runs, only the respective server command is needed in each directory. Using the virtual environment's executable directly also works when PowerShell script activation is restricted.

## Architecture

| Directory | Responsibility |
| --- | --- |
| `backend/app/` | FastAPI endpoints, Pydantic validation, SQLAlchemy models, SQLite storage and demo data |
| `backend/tests/` | Pytest checks against isolated databases |
| `frontend/src/` | React, TypeScript and Tailwind interface, native fetch client and local-time display |
| `frontend/tests/` | Vitest and React Testing Library interaction tests |
| `frontend/e2e/` | Playwright checks using both servers |

Vite forwards requests under `/api` to the local backend. Set `ROOMFLOW_API_URL` before starting Vite to use a different backend address. The browser sends UTC instants for the beginning and end of the selected local day. A reservation crossing midnight appears on both days. The dashboard counts only the time between each day's boundaries. An active booking from 23:30 to 00:30 contributes half a room-hour to each day.

## Database and reservation rules

On first startup the backend creates `backend/data/roomflow.sqlite3`. It inserts six rooms and six example meetings on the server's local today and tomorrow. A seed-history record protects those examples from being reinserted on restart. Restarts preserve reservations and cancellations. To use a separate database, set `$env:ROOMFLOW_DB_PATH` to an absolute path before starting the backend. Keep the database on a local disk.

Every create, edit and cancellation acquires SQLite's write lock with `BEGIN IMMEDIATE` before reading reservation state. The conflict check and write share one transaction. A competing writer waits for the first commit and then checks the committed interval. SQLite lock contention exceeding the eight-second timeout returns HTTP 503 and a retry hint.

Reservations require a room, meeting title, organiser and UTC start and end. A new booking must start in the future and last between 15 minutes and four hours inclusive. Two active bookings in the same room conflict when `new_start < existing_end && new_end > existing_start`. Consecutive meetings may share an endpoint. Rescheduling applies the same rule, excluding the original reservation. Cancellation preserves history and releases the slot.

## API

| Method | Path | Result |
| --- | --- | --- |
| GET | `/api/rooms` | Room directory. Supply UTC `start_at` and `end_at` for availability, `min_capacity` for minimum seats, and repeat `facility` to filter amenities. |
| GET | `/api/rooms/{id}` | One room |
| GET | `/api/bookings` | Reservations. Filter by `room_id`, `status` and UTC range. A range includes meetings that overlap it. Use `upcoming=true` for future active starts. |
| POST | `/api/bookings` | Create a reservation and return it with HTTP 201 |
| GET | `/api/bookings/{id}` | One reservation |
| PATCH | `/api/bookings/{id}` | Edit details or reschedule |
| POST | `/api/bookings/{id}/cancel` | Mark the reservation cancelled |

For creation, send a JSON object with `room_id`, `title`, `organiser`, `start_at` and `end_at`. Use ISO 8601 timestamps such as `2030-06-10T02:00:00Z`. An error response has the shape `{"error":{"code":"…","message":"…"}}`. Input errors return HTTP 422, missing resources 404, and booking conflicts 409.

## Verification

From the backend directory:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

From the frontend directory:

```powershell
npm.cmd test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Playwright starts both servers on ports 8781 and 5179 with a temporary database. Leave those ports free. If Google Chrome is installed, set `$env:ROOMFLOW_BROWSER_CHANNEL = 'chrome'` to run the suite with it and skip the Chromium download.

## Scope

RoomFlow is designed for trusted local users. Anyone with access to the application can manage its reservations. SQLite serialises writes, which suits a small office. This version includes no sign-in, recurring meetings, external calendar integration, hosting configuration or database upgrade migrations.
