-- 0008_content_health_v2.sql — clips-per-hour scoring (locked 2026-05-27)

delete from metrics
  where app_id = (select id from apps where slug = 'content_health');

with a as (select id from apps where slug = 'content_health')
insert into metrics (app_id, slug, name, weight_within_app, direction, scoring_rule)
values
  ((select id from a), 'content_ratio_hit',
    'Hit the 20-clips-per-AHS-hour target on a content night',
    50, 'higher_better',
    '{"type":"per_unit_reward","xp_per_unit":10,"target_ratio":20}'::jsonb),
  ((select id from a), 'content_ratio_miss',
    'Missed the 20-clips-per-AHS-hour target',
    20, 'lower_better',
    '{"type":"per_unit_penalty","xp_per_unit":-3}'::jsonb),
  ((select id from a), 'content_post_12h_bonus',
    'Posted iPhone clips to IG stories within 12h of the night',
    20, 'higher_better',
    '{"type":"per_unit_reward","xp_per_unit":3,"sla_hours":12}'::jsonb),
  ((select id from a), 'content_never_posted',
    'Content night 7+ days old with iPhone clips still not posted',
    10, 'lower_better',
    '{"type":"per_unit_penalty","xp_per_unit":-2,"per":"per_day"}'::jsonb)
on conflict (app_id, slug) do nothing;
