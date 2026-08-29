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

The first run creates ignored `.env.local` files with a random development secret, applies database migrations, starts the API on port 8010, and starts the web application on port 3000. Next.js will choose another available web port if 3000 is already occupied.

## API setup

From `apps/api` in PowerShell:

```powershell
python -m venv .venv
python -m pip --python .venv install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn lifetracker.main:app --port 8010
```

API documentation is available at `http://localhost:8010/docs` in development. Health endpoints are `/health` and `/health/ready`.
The root launcher intentionally runs the API without Uvicorn auto-reload because some managed
Windows devices block its subprocess. Restart `npm.cmd run dev` after changing Python code.

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

1. Open `/signup` and create an account using a lowercase email and a password with at least 8 characters, one letter, and one number.
2. Confirm the dashboard displays the submitted first name and the default INR currency.
3. Sign out from the navigation footer/header.
4. Confirm a direct visit to `/dashboard` redirects to `/login`.
5. Sign in with the created account.
6. Confirm an invalid password returns a generic error and does not reveal whether an email exists.

Access tokens are short-lived JWTs in HTTP-only cookies. Refresh tokens are random, hashed in the database, rotated during refresh, and revocable on logout. Unsafe authenticated requests require the matching CSRF header and cookie.

## Vercel deployment

The repository deploys as two Vercel Services behind one origin. `/api/*` and `/health*`
are handled by FastAPI; all other routes are handled by Next.js.

1. Keep the Vercel project Root Directory at the repository root (leave it blank).
2. In Project Settings > Build and Deployment, set Framework Preset to **Services**.
3. Add these production environment variables to Vercel:
   - `ENVIRONMENT=production`
   - `DATABASE_URL=<managed PostgreSQL asyncpg URL>`
   - `DATABASE_POOL_SIZE=2`
   - `DATABASE_MAX_OVERFLOW=1`
   - `DATABASE_USE_NULL_POOL=true`
   - `JWT_SECRET=<at least 32 random characters>`
   - `COOKIE_SECURE=true`
   - `CORS_ORIGINS=["https://your-production-domain"]`
   - `NEXT_PUBLIC_API_URL=/api/v1`
   - `SMTP_HOST=<your email provider SMTP host>`
   - `SMTP_PORT=587`
   - `SMTP_USERNAME=<your email provider username>`
   - `SMTP_PASSWORD=<your email provider password or API key>`
   - `SMTP_FROM_EMAIL=<verified sender address>`
   - `SMTP_USE_TLS=true`

   For Supabase, copy the **Session Pooler** connection string (the `aws-...pooler.supabase.com`
   host on port `5432`) from **Supabase > Connect** and replace its scheme with
   `postgresql+asyncpg://`. `DATABASE_USE_NULL_POOL=true` ensures serverless instances release
   their database connections. Do not use the direct `db.<project-ref>.supabase.co` address
   from Vercel because that endpoint is IPv6-only by default. Do not use the transaction
   pooler with this asyncpg configuration because it does not support prepared statements.
   `CORS_ORIGINS` must contain a plain URL, not Markdown link syntax.
   The SMTP variables are required for Forgot Password in production. Use a verified sender
   from an SMTP provider; never use your personal mailbox password.
4. Apply the database migrations using the same production `DATABASE_URL` before the first
   production request:

   ```powershell
   $env:DATABASE_URL = "postgresql+asyncpg://..."
   $env:ENVIRONMENT = "production"
   $env:JWT_SECRET = "your-production-secret"
   $env:COOKIE_SECURE = "true"
   .\apps\api\.venv\Scripts\python.exe -m alembic -c apps/api/alembic.ini upgrade head
   ```

   Alternatively, for a new Supabase database, run `docs/supabase-schema.sql` once in
   **Supabase > SQL Editor**. If the database was created with the older schema through
   revision `20260825_0002`, first run `docs/supabase-upgrade-0003.sql` and then
   `docs/supabase-upgrade-0004.sql`. If it is already at revision `20260828_0003`, run only
   `docs/supabase-upgrade-0004.sql`. Use either Alembic or the SQL scripts for a revision,
   not both.

5. Push the deployment commit or redeploy the latest commit in Vercel.
6. Verify API routing and database readiness from the repository root:

   ```powershell
   npm.cmd run check:deployment -- https://your-production-domain
   ```

   All three checks must report `PASS`. A 404 means the project is not using the
   Services framework/root configuration. A 503 from `/health/ready` means the
   database URL or migrations are not ready.

The production web build always uses the same-origin `/api/v1` route. Remove any Vercel
`NEXT_PUBLIC_API_URL` value that points to `localhost`, is empty, or contains only the
frontend origin. If you keep the variable for documentation, set it to `/api/v1`.

After changing any Vercel environment variable, redeploy the latest commit. Confirm both
`/health` (application running) and `/health/ready` (database reachable and migrated) before
testing registration. A successful `/health` with a failing `/health/ready` is a database
connection or schema problem, not a CORS problem.
