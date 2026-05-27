-- 0005_ref_payroll_v2.sql — deadline-driven scoring (locked 2026-05-27)

delete from metrics
  where app_id = (select id from apps where slug = 'ref_payroll');

with a as (select id from apps where slug = 'ref_payroll')
insert into metrics (app_id, slug, name, weight_within_app, direction, scoring_rule)
values
  ((select id from a), 'ref_payroll_on_time',
    'Submitted AND approved last week''s payroll before Monday 12pm',
    50, 'higher_better',
    '{"type":"deadline_reward","xp_per_unit":15,"deadline":"mon_12pm_et"}'::jsonb),
  ((select id from a), 'ref_payroll_late_hit',
    'Missed the Monday 12pm deadline',
    25, 'lower_better',
    '{"type":"deadline_penalty_once","xp_per_unit":-15,"deadline":"mon_12pm_et"}'::jsonb),
  ((select id from a), 'ref_payroll_drag',
    'Each weekday a missed payroll stays unfinished',
    25, 'lower_better',
    '{"type":"per_unit_penalty","xp_per_unit":-3,"per":"per_day"}'::jsonb)
on conflict (app_id, slug) do nothing;
