# RoomFlow — Smart Room Booking System

**Live Demo:** [https://room-flow-rho.vercel.app](https://room-flow-rho.vercel.app)

RoomFlow is a meeting-room planner for a small office, deployable on Vercel + Neon PostgreSQL or runnable locally on SQLite. The dashboard shows utilisation, the room directory helps you find a space for a time range, Reservations lets you edit, move or cancel meetings, and the Admin tab provides password-protected room management.

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
| `backend/app/` | FastAPI endpoints, Pydantic validation, SQLAlchemy models, SQLite/PostgreSQL storage and demo data |
| `backend/alembic/` | Alembic schema migrations and PostgreSQL exclusion constraint |
| `backend/tests/` | Pytest checks against isolated databases |
| `frontend/src/` | React, TypeScript and Tailwind interface, native fetch client and local-time display |
| `frontend/tests/` | Vitest and React Testing Library interaction tests |
| `frontend/e2e/` | Playwright checks using both servers |
| `api/index.py` | Vercel Python serverless entrypoint exposing the FastAPI app |
| `vercel.json` | Vercel build, static output, and `/api/*` rewrite configuration |
| `requirements.txt` | Root Python dependencies for Vercel serverless deployment |

Vite forwards requests under `/api` to the local backend. Set `ROOMFLOW_API_URL` before starting Vite to use a different backend address. The browser sends UTC instants for the beginning and end of the selected local day. A reservation crossing midnight appears on both days. The dashboard counts only the time between each day's boundaries. An active booking from 23:30 to 00:30 contributes half a room-hour to each day.

## Database and reservation rules

On first startup with the default SQLite configuration, the backend creates `backend/data/roomflow.sqlite3`. It inserts six rooms and six example meetings on the server's local today and tomorrow. A seed-history record protects those examples from being reinserted on restart. Restarts preserve reservations and cancellations. To use a separate SQLite file, set `$env:ROOMFLOW_DB_PATH` to an absolute path before starting the backend. Keep the SQLite database on a local disk.

To use PostgreSQL (such as Neon) instead of SQLite, set `$env:ROOMFLOW_DATABASE_URL` (for example `postgresql+psycopg://...`) and apply the versioned schema migrations before starting the backend:

```powershell
.\.venv\Scripts\alembic.exe upgrade head
```

On SQLite, every create, edit and cancellation acquires a write lock with `BEGIN IMMEDIATE` before reading reservation state so the conflict check and write share one transaction; lock contention exceeding the eight-second timeout returns HTTP 503 and a retry hint. On PostgreSQL, booking checks lock the target room row with `SELECT ... FOR UPDATE`, and the `no_overlapping_active_bookings` `EXCLUDE USING gist` constraint (`btree_gist` + `tsrange`) enforces non-overlapping active slots at the storage layer (mapping `23P01` violations to HTTP 409).

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
| GET | `/api/admin/me` | Check whether admin mode is configured and signed in |
| POST | `/api/admin/login` | Sign in with the admin password and set an `HttpOnly` cookie |
| POST | `/api/admin/logout` | Clear the admin session cookie |
| POST | `/api/rooms` | Create a room (admin required, HTTP 201) |
| PATCH | `/api/rooms/{id}` | Edit room details (admin required) |
| DELETE | `/api/rooms/{id}` | Delete a room with no existing reservations (admin required, HTTP 204) |

For creation, send a JSON object with `room_id`, `title`, `organiser`, `start_at` and `end_at`. Use ISO 8601 timestamps such as `2030-06-10T02:00:00Z`. An error response has the shape `{"error":{"code":"…","message":"…"}}`. Input errors return HTTP 422, missing resources 404, and booking conflicts 409.

## Deployment (Vercel + Neon)

RoomFlow is configured for all-in-one deployment on Vercel with a Neon PostgreSQL database:

1. Apply Alembic migrations once against your Neon database:
   ```powershell
   $env:ROOMFLOW_DATABASE_URL = 'postgresql+psycopg://<user>:<password>@<host>/<db>?sslmode=require'
   .\.venv\Scripts\alembic.exe upgrade head
   ```
2. Import the repository in Vercel with the **Root Directory** left at the repo root (`./`).
3. Set the following environment variables in **Vercel → Settings → Environment Variables**:
   - `ROOMFLOW_DATABASE_URL`: Neon connection string starting with `postgresql+psycopg://...` (required)
   - `ROOMFLOW_ADMIN_PASSWORD`: Password required to unlock the `#admin` room management tab (optional; admin mode is disabled if unset)
   - `ROOMFLOW_ADMIN_SECRET`: Optional explicit HMAC signing secret for admin session cookies

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

Reservations are open for quick workspace and demo use: anyone with access to the application can view, create, edit, or cancel reservations. Room creation, editing, and deletion in the Admin tab are protected by an HMAC-signed `HttpOnly` cookie backed by `ROOMFLOW_ADMIN_PASSWORD`. SQLite serialises writes by default for local runs, while PostgreSQL uses row-level locking and an exclusion constraint. Recurring meetings and external calendar integration are out of scope for this version.
