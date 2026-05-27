-- 0003_scoring_v2.sql — task-based XP, weight-as-multiplier, CRM metrics
-- rewritten per spec discussion 2026-05-27.

-- ---------------------------------------------------------------------------
-- apps: weight is now a multiplier (default 1.0). Add xp_floor.
-- ---------------------------------------------------------------------------
alter table apps
  add column if not exists xp_floor numeric not null default -20;

-- Reset all existing weights to 1.0 — they were absolute shares before.
update apps set weight = 1.0;

-- Park ops_schedule (the app isn't built out yet).
update apps set enabled = false where slug = 'ops_schedule';

-- ---------------------------------------------------------------------------
-- CRM metrics: drop old (% based) and insert new task-based rules.
-- ---------------------------------------------------------------------------
delete from metrics
  where app_id = (select id from apps where slug = 'crm');

with a as (select id from apps where slug = 'crm')
insert into metrics (app_id, slug, name, weight_within_app, direction, scoring_rule)
values
  ((select id from a), 'crm_touch',         'Daily touch (LM-initiated activity, excludes cio)',  60, 'higher_better',
    '{"type":"per_unit","xp_per_unit":1,"daily_cap":50}'::jsonb),
  ((select id from a), 'crm_50_bonus',      'Bonus for hitting 50 touches in a day',              10, 'higher_better',
    '{"type":"threshold_bonus","threshold":50,"xp":10,"counts_metric":"crm_touch"}'::jsonb),
  ((select id from a), 'crm_ig_no_outcome', 'Outbound IG DM past 24h with no logged outcome',     30, 'lower_better',
    '{"type":"per_unit_penalty","xp_per_unit":-0.5,"floor":-15}'::jsonb)
on conflict (app_id, slug) do nothing;

-- ---------------------------------------------------------------------------
-- lm_xp_totals: allow negative total_xp + pct > 100. The generated column
-- already handles this since it just divides; we just need to make sure
-- nothing in code clamps it. No schema change needed — just a doc comment.
-- ---------------------------------------------------------------------------
comment on column lm_xp_totals.total_xp is
  'Sum of XP earned across all apps for snapshot_date. Can be negative if penalties exceed gains.';
comment on column lm_xp_totals.pct is
  'total_xp / max_xp * 100. Can exceed 100 (overachiever) or go negative.';
