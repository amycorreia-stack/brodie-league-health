-- 0007_stats_health_v2.sql — dispute-triage scoring (locked 2026-05-27)

delete from metrics
  where app_id = (select id from apps where slug = 'stats_health');

with a as (select id from apps where slug = 'stats_health')
insert into metrics (app_id, slug, name, weight_within_app, direction, scoring_rule)
values
  ((select id from a), 'stats_dispute_on_time',
    'Triaged a dispute within 48 business hours of receipt',
    70, 'higher_better',
    '{"type":"per_unit_reward","xp_per_unit":10,"sla_business_hours":48}'::jsonb),
  ((select id from a), 'stats_dispute_overdue',
    'Open dispute past the 48 business hour SLA',
    30, 'lower_better',
    '{"type":"per_unit_penalty","xp_per_unit":-2,"per":"per_day"}'::jsonb)
on conflict (app_id, slug) do nothing;
