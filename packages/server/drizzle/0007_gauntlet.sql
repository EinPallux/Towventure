-- Daily Gauntlet (GDD §10). Additive. A gauntlet run is a normal run seeded with the
-- shared daily seed + forced class; gauntlet_day tags it for the separate daily ladder.

ALTER TABLE runs ADD COLUMN IF NOT EXISTS gauntlet_day integer;
CREATE INDEX IF NOT EXISTS runs_gauntlet_day_idx ON runs (gauntlet_day) WHERE gauntlet_day IS NOT NULL;
