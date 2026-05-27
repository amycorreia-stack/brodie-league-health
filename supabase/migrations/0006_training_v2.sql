-- 0006_training_v2.sql — task-based training (locked 2026-05-27)

delete from metrics
  where app_id = (select id from apps where slug = 'training');

with a as (select id from apps where slug = 'training')
insert into metrics (app_id, slug, name, weight_within_app, direction, scoring_rule)
values
  ((select id from a), 'training_staff_completion',
    'Staff member completed an assigned training module today',
    70, 'higher_better',
    '{"type":"per_unit","xp_per_unit":5}'::jsonb),
  ((select id from a), 'training_ghost_staff',
    'Staff member at LM''s location with zero completions in last 30 days',
    30, 'lower_better',
    '{"type":"per_unit_penalty","xp_per_unit":-2,"per":"per_day"}'::jsonb)
on conflict (app_id, slug) do nothing;
