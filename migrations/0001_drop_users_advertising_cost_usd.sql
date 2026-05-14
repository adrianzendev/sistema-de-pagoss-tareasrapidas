-- Migration: Remove deprecated advertising_cost_usd column from users table
-- This column stored per-tutor global advertising costs which were replaced
-- by the per-week per-tutor system (tutor_week_advertising table).
-- Historical values (33.00, 20.00, 100.00) were stale residues of the old config.
-- This migration was applied via drizzle-kit push --force on 2026-05-14.

ALTER TABLE users DROP COLUMN IF EXISTS advertising_cost_usd;
