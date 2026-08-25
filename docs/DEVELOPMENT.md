# Local development

## Prerequisites

- Node.js 22 or newer.
- Python 3.12–3.14.
- PostgreSQL 16 or newer for production-like local development. The default zero-configuration development run uses SQLite.

No Redis, queue, or container runtime is required for Phase 1.

## Environment

1. Copy `apps/api/.env.example` to `apps/api/.env.local`.
2. Replace `JWT_SECRET` with a unique random value of at least 32 characters.
3. Copy `apps/web/.env.example` to `apps/web/.env.local`.
4. Create the PostgreSQL database and user referenced by `DATABASE_URL`.

Environment-specific example files document development and production differences. Real `.env` files are ignored by Git and must not be committed.

## Run the complete application

After installing dependencies, run both services from the repository root:

```powershell
npm.cmd run dev
```

The first run creates ignored `.env.local` files with a random development secret, applies database migrations, starts the API on port 8000, and starts the web application on port 3000. Next.js will choose another available web port if 3000 is already occupied.

## API setup

From `apps/api` in PowerShell:

```powershell
python -m venv .venv
python -m pip --python .venv install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\alembic.exe upgrade head
.\.venv\Scripts\uvicorn.exe lifetracker.main:app --reload --port 8000
```

API documentation is available at `http://localhost:8000/docs` in development. Health endpoints are `/health` and `/health/ready`.

## Web setup

From the repository root:

```powershell
npm.cmd install
npm.cmd run dev:web
```

Open `http://localhost:3000`.

## Verification

Backend:

```powershell
cd apps/api
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m ruff check src tests migrations
.\.venv\Scripts\python.exe -m mypy src
```

Frontend, from the repository root:

```powershell
npm.cmd run lint:web
npm.cmd run typecheck:web
npm.cmd run test:web
npm.cmd run build:web
```

## Authentication smoke test

1. Open `/signup` and create an account using a password with at least 10 characters, one letter, and one number.
2. Confirm the dashboard displays the submitted first name and selected currency.
3. Sign out from the navigation footer/header.
4. Confirm a direct visit to `/dashboard` redirects to `/login`.
5. Sign in with the created account.
6. Confirm an invalid password returns a generic error and does not reveal whether an email exists.

Access tokens are short-lived JWTs in HTTP-only cookies. Refresh tokens are random, hashed in the database, rotated during refresh, and revocable on logout. Unsafe authenticated requests require the matching CSRF header and cookie.
