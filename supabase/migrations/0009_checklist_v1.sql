-- 0009_checklist_v1.sql — seasonal checklist as the 8th source app
-- (locked with user 2026-05-27)

insert into apps (slug, name, weight, xp_floor, enabled, display_order, description) values
  ('checklist', 'Seasonal Checklist', 1.0, -20, true, 8,
   'Per-season playbook tasks tracked per location')
on conflict (slug) do nothing;

with a as (select id from apps where slug = 'checklist')
insert into metrics (app_id, slug, name, weight_within_app, direction, scoring_rule)
values
  ((select id from a), 'checklist_progress',
    'Task flipped to in_progress or done today',
    70, 'higher_better',
    '{"type":"per_unit_reward","xp_per_unit":5,"triggers_on":"status_changed_at"}'::jsonb),
  ((select id from a), 'checklist_overdue',
    'Task past due_date with status not_started',
    30, 'lower_better',
    '{"type":"per_unit_penalty","xp_per_unit":-1,"per":"per_day"}'::jsonb)
on conflict (app_id, slug) do nothing;
