-- Minutes at each heart rate, per day, for the time-in-zone trend.
--
-- A histogram rather than five zone-minute columns: zone boundaries derive
-- from resting and max heart rate, both of which drift, so stored zone
-- minutes are frozen under the model of the day they were written. Holding
-- the distribution makes zones a read-time view that re-slices consistently
-- when the model changes. See docs/design/heart-rate-zone-trends.md §3.
--
-- Nullable: a day before the app started computing it, or a day with no
-- heart-rate data, has none — which is different from a day of zeroes.
ALTER TABLE daily_activity_summary
  ADD COLUMN IF NOT EXISTS active_hr_histogram jsonb;
