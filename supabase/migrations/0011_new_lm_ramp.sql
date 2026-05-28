-- 0011_new_lm_ramp.sql — new-LM ramp protection
-- LMs hired within the last 30 days get a softer xp_floor + a daily ramp
-- credit so Day 1 isn't immediately demoralizing.

alter table league_managers
  add column if not exists hired_at date;

-- Backfill: if a manager exists in CRM with hired_at, mirror it here.
-- CRM doesn't have this column today (verified), so we just leave nulls.
-- The score engine treats null as "tenured" (no ramp applies). HR can
-- populate it from the admin UI later.

comment on column league_managers.hired_at is
  'Date the LM was hired. NULL = treat as tenured. Within 30 days = ramp
   protection (softer xp_floor, +5/day ramp credit).';
