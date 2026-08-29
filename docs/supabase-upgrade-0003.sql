-- Upgrade an existing LifeTracker Supabase schema from 20260825_0002 to 20260828_0003.
-- Run in Supabase > SQL Editor. The CREATE statements are idempotent so this can
-- safely repair a deployment where the revision was only partially applied.
BEGIN;

CREATE TABLE IF NOT EXISTS password_reset_challenges (
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    email VARCHAR(320) NOT NULL,
    code_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL,
    consumed_at TIMESTAMPTZ,
    requester_hash VARCHAR(64),
    id UUID PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_password_reset_email_active
ON password_reset_challenges (email, consumed_at, expires_at);

CREATE TABLE IF NOT EXISTS login_attempts (
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    failure_count INTEGER NOT NULL,
    window_started_at TIMESTAMPTZ NOT NULL,
    blocked_until TIMESTAMPTZ,
    id UUID PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS budgets (
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL,
    category VARCHAR(60) NOT NULL,
    limit_amount NUMERIC(14, 2) NOT NULL CHECK (limit_amount > 0),
    notes VARCHAR(300),
    id UUID PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_budget_user_month_category UNIQUE (user_id, month, category)
);
CREATE INDEX IF NOT EXISTS ix_budgets_user_month ON budgets (user_id, month);

CREATE TABLE IF NOT EXISTS reminders (
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    description VARCHAR(500),
    due_on DATE NOT NULL,
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('general', 'expense', 'goal', 'journal', 'income')),
    completed BOOLEAN NOT NULL,
    id UUID PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_reminders_user_due
ON reminders (user_id, due_on, completed);

ALTER TABLE password_reset_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE password_reset_challenges, login_attempts, budgets, reminders
FROM anon, authenticated, service_role;

UPDATE alembic_version SET version_num = '20260828_0003'
WHERE version_num = '20260825_0002';

COMMIT;
