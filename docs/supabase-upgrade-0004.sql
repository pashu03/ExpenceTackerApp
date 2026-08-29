    -- Upgrade an existing LifeTracker Supabase schema from 20260828_0003 to 20260828_0004.
    -- Run once in Supabase > SQL Editor. Do not run if Alembic already applied revision 0004.

    BEGIN;

    ALTER TABLE financial_goals
    ADD COLUMN IF NOT EXISTS monthly_contribution NUMERIC(14, 2) DEFAULT 0 NOT NULL;

    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'ck_goals_nonnegative_monthly_contribution'
        ) THEN
            ALTER TABLE financial_goals
            ADD CONSTRAINT ck_goals_nonnegative_monthly_contribution
            CHECK (monthly_contribution >= 0);
        END IF;
    END $$;

    UPDATE alembic_version SET version_num = '20260828_0004'
    WHERE version_num = '20260828_0003';

    COMMIT;
