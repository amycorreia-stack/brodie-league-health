-- 0004_facilities_v2.sql — task-based facilities scoring
-- (locked with user 2026-05-27)

-- Drop old facilities metrics
delete from metrics
  where app_id = (select id from apps where slug = 'facilities');

with a as (select id from apps where slug = 'facilities')
insert into metrics (app_id, slug, name, weight_within_app, direction, scoring_rule)
values
  ((select id from a), 'invoice_followup',
    'Followed up with DM on an invoice due in <=4 business days',
    50, 'higher_better',
    '{"type":"reward_on_resolve","xp_per_unit":5}'::jsonb),
  ((select id from a), 'invoice_overdue',
    'Open invoice past scheduled pay date',
    30, 'lower_better',
    '{"type":"per_unit_penalty","xp_per_unit":-3,"per":"per_day"}'::jsonb),
  ((select id from a), 'contract_gap',
    'Facility contract expiring in <30 days with no follow-on signed',
    20, 'lower_better',
    '{"type":"per_unit_penalty","xp_per_unit":-3,"per":"per_day"}'::jsonb)
on conflict (app_id, slug) do nothing;
