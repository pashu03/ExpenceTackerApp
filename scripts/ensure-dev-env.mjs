import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const apiEnvironmentPath = join(repositoryRoot, "apps", "api", ".env.local");
const webEnvironmentPath = join(repositoryRoot, "apps", "web", ".env.local");

if (!existsSync(apiEnvironmentPath)) {
  const jwtSecret = randomBytes(48).toString("base64url");
  const apiEnvironment = [
    "ENVIRONMENT=development",
    "LOG_LEVEL=INFO",
    "DATABASE_URL=sqlite+aiosqlite:///./apps/api/lifetracker-dev.sqlite3",
    "DATABASE_POOL_SIZE=5",
    "DATABASE_MAX_OVERFLOW=10",
    `JWT_SECRET=${jwtSecret}`,
    "JWT_ISSUER=lifetracker-api",
    "JWT_AUDIENCE=lifetracker-web",
    "ACCESS_TOKEN_MINUTES=30",
    "REFRESH_TOKEN_DAYS=7",
    "COOKIE_SECURE=false",
    'CORS_ORIGINS=["http://localhost:3000","http://localhost:3001"]',
    "",
  ].join("\n");
  writeFileSync(apiEnvironmentPath, apiEnvironment, { encoding: "utf8", mode: 0o600 });
  console.log("Created apps/api/.env.local with an isolated development secret.");
}

if (!existsSync(webEnvironmentPath)) {
  writeFileSync(
    webEnvironmentPath,
    "NEXT_PUBLIC_API_URL=http://localhost:8010/api/v1\n",
    { encoding: "utf8", mode: 0o600 },
  );
  console.log("Created apps/web/.env.local.");
}
