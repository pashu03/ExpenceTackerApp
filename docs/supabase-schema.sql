-- LifeTracker PostgreSQL schema for a new Supabase database.
-- Canonical source: apps/api/migrations/versions/*.py
-- Run this once in Supabase Dashboard > SQL Editor > New query.

BEGIN;

CREATE TABLE users (
    name VARCHAR(100) NOT NULL,
    email VARCHAR(320) NOT NULL,
    password_hash TEXT,
    auth_provider VARCHAR(30) NOT NULL,
    profile_image_url TEXT,
    status VARCHAR(20) NOT NULL,
    id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_users_provider CHECK (auth_provider IN ('local', 'google', 'oidc')),
    CONSTRAINT ck_users_status CHECK (status IN ('active', 'disabled', 'pending_deletion')),
    CONSTRAINT pk_users PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE TABLE user_preferences (
    user_id UUID NOT NULL,
    currency_code VARCHAR(3) NOT NULL,
    timezone VARCHAR(100) NOT NULL,
    ai_insights_enabled BOOLEAN NOT NULL,
    journal_ai_enabled BOOLEAN NOT NULL,
    notifications_enabled BOOLEAN NOT NULL,
    theme VARCHAR(10) NOT NULL,
    financial_month_start SMALLINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_financial_month_start CHECK (financial_month_start BETWEEN 1 AND 28),
    CONSTRAINT ck_theme CHECK (theme IN ('light', 'dark', 'system')),
    CONSTRAINT fk_user_preferences_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT pk_user_preferences PRIMARY KEY (user_id)
);

CREATE TABLE auth_sessions (
    user_id UUID NOT NULL,
    refresh_token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    user_agent_hash VARCHAR(64),
    ip_hash VARCHAR(64),
    revoke_reason TEXT,
    id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT pk_auth_sessions PRIMARY KEY (id),
    CONSTRAINT uq_auth_sessions_refresh_token_hash UNIQUE (refresh_token_hash)
);

CREATE INDEX ix_auth_sessions_user_active ON auth_sessions (user_id, revoked_at, expires_at);

CREATE TABLE expenses (
    user_id UUID NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    category VARCHAR(60) NOT NULL,
    description VARCHAR(200),
    notes TEXT,
    spent_on DATE NOT NULL,
    id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_expenses_positive_amount CHECK (amount > 0),
    CONSTRAINT fk_expenses_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT pk_expenses PRIMARY KEY (id)
);

CREATE INDEX ix_expenses_user_date ON expenses (user_id, spent_on);

CREATE TABLE income_transactions (
    user_id UUID NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    source VARCHAR(100) NOT NULL,
    description VARCHAR(200),
    received_on DATE NOT NULL,
    id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_income_positive_amount CHECK (amount > 0),
    CONSTRAINT fk_income_transactions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT pk_income_transactions PRIMARY KEY (id)
);

CREATE INDEX ix_income_user_date ON income_transactions (user_id, received_on);

CREATE TABLE journal_entries (
    user_id UUID NOT NULL,
    entry_date DATE NOT NULL,
    title VARCHAR(120),
    content TEXT NOT NULL,
    mood VARCHAR(30),
    id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_journal_entries_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT pk_journal_entries PRIMARY KEY (id),
    CONSTRAINT uq_journal_user_date UNIQUE (user_id, entry_date)
);

CREATE INDEX ix_journal_user_date ON journal_entries (user_id, entry_date);

CREATE TABLE financial_goals (
    user_id UUID NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(300),
    target_amount NUMERIC(14, 2) NOT NULL,
    current_amount NUMERIC(14, 2) NOT NULL,
    monthly_contribution NUMERIC(14, 2) DEFAULT 0 NOT NULL,
    target_date DATE,
    status VARCHAR(20) NOT NULL,
    id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_goals_positive_target CHECK (target_amount > 0),
    CONSTRAINT ck_goals_nonnegative_current CHECK (current_amount >= 0),
    CONSTRAINT ck_goals_nonnegative_monthly_contribution CHECK (monthly_contribution >= 0),
    CONSTRAINT ck_goals_status CHECK (status IN ('active', 'completed', 'paused')),
    CONSTRAINT fk_financial_goals_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT pk_financial_goals PRIMARY KEY (id)
);

CREATE INDEX ix_goals_user_status ON financial_goals (user_id, status);

CREATE TABLE password_reset_challenges (
    user_id UUID NOT NULL,
    email VARCHAR(320) NOT NULL,
    code_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL,
    consumed_at TIMESTAMPTZ,
    requester_hash VARCHAR(64),
    id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT pk_password_reset_challenges PRIMARY KEY (id)
);
CREATE INDEX ix_password_reset_email_active ON password_reset_challenges (email, consumed_at, expires_at);

CREATE TABLE login_attempts (
    key_hash VARCHAR(64) NOT NULL,
    failure_count INTEGER NOT NULL,
    window_started_at TIMESTAMPTZ NOT NULL,
    blocked_until TIMESTAMPTZ,
    id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_login_attempts PRIMARY KEY (id),
    CONSTRAINT uq_login_attempts_key_hash UNIQUE (key_hash)
);

CREATE TABLE budgets (
    user_id UUID NOT NULL,
    month VARCHAR(7) NOT NULL,
    category VARCHAR(60) NOT NULL,
    limit_amount NUMERIC(14, 2) NOT NULL,
    notes VARCHAR(300),
    id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_budgets_positive_limit CHECK (limit_amount > 0),
    CONSTRAINT fk_budgets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT pk_budgets PRIMARY KEY (id),
    CONSTRAINT uq_budget_user_month_category UNIQUE (user_id, month, category)
);
CREATE INDEX ix_budgets_user_month ON budgets (user_id, month);

CREATE TABLE reminders (
    user_id UUID NOT NULL,
    title VARCHAR(120) NOT NULL,
    description VARCHAR(500),
    due_on DATE NOT NULL,
    kind VARCHAR(20) NOT NULL,
    completed BOOLEAN NOT NULL,
    id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_reminders_kind CHECK (kind IN ('general', 'expense', 'goal', 'journal', 'income')),
    CONSTRAINT fk_reminders_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT pk_reminders PRIMARY KEY (id)
);
CREATE INDEX ix_reminders_user_due ON reminders (user_id, due_on, completed);

-- LifeTracker uses its FastAPI server for authorization and does not query these
-- tables from a Supabase browser client. Block Supabase Data API roles from them.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
    users,
    user_preferences,
    auth_sessions,
    expenses,
    income_transactions,
    journal_entries,
    financial_goals,
    password_reset_challenges,
    login_attempts,
    budgets,
    reminders
FROM anon, authenticated, service_role;

-- The SQL above is equivalent to all migrations through this revision.
CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

INSERT INTO alembic_version (version_num) VALUES ('20260828_0004');

COMMIT;
