ALTER TABLE tutor_week_advertising ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS tutor_daily_campaigns (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  daily_cost_usd DECIMAL(12,2) NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- At most one active (not yet ended) campaign per tutor
CREATE UNIQUE INDEX IF NOT EXISTS one_active_campaign_per_tutor
  ON tutor_daily_campaigns (tutor_id) WHERE end_date IS NULL;
