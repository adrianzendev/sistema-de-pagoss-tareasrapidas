-- Migration: Restore advertising_cost_usd column on users table
-- The column was dropped in 0001 when per-week tracking replaced it,
-- but it is now re-introduced as a per-tutor DEFAULT value.
-- Calculation fallback chain: tutor_week_advertising override ?? users.advertising_cost_usd default
-- Applied via drizzle-kit push --force on 2026-05-14.

ALTER TABLE users ADD COLUMN IF NOT EXISTS advertising_cost_usd DECIMAL(10,2) NOT NULL DEFAULT 0;
