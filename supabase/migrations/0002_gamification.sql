-- 0002_gamification.sql — streaks, tiers, achievements, champions

-- ---------------------------------------------------------------------------
-- league_managers: cached gamification stats (recomputed every score run)
-- ---------------------------------------------------------------------------
alter table league_managers
  add column if not exists current_streak int not null default 0,
  add column if not exists longest_streak int not null default 0,
  add column if not exists tier text not null default 'rookie'
    check (tier in ('rookie', 'pro', 'elite', 'hall_of_fame')),
  add column if not exists avg_30d numeric;

-- ---------------------------------------------------------------------------
-- achievements catalog
-- ---------------------------------------------------------------------------
create table if not exists achievements (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null,
  icon text not null,           -- emoji
  criteria jsonb not null,      -- { type: 'streak'|'first_xp'|'tier'|'rank'|'metric_streak', ... }
  weight int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists lm_achievements (
  lm_id uuid not null references league_managers(id) on delete cascade,
  achievement_id uuid not null references achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (lm_id, achievement_id)
);
create index if not exists idx_lm_achievements_lm on lm_achievements(lm_id, unlocked_at desc);

alter table achievements enable row level security;
alter table lm_achievements enable row level security;

create policy achievements_read on achievements for select to authenticated using (true);

create policy lm_ach_self_read on lm_achievements for select to authenticated using (
  lm_id = current_lm_id() or current_role_for_user() in ('dm', 'super_admin')
);
create policy lm_ach_admin_write on lm_achievements for all to authenticated
  using (current_role_for_user() in ('dm', 'super_admin'))
  with check (current_role_for_user() in ('dm', 'super_admin'));

-- ---------------------------------------------------------------------------
-- Seed achievements
-- ---------------------------------------------------------------------------
insert into achievements (slug, name, description, icon, criteria, weight) values
  ('first_century',   'First Century',        'Score 100+ XP in a single day for the first time.',  '💯', '{"type":"single_day_xp","min":100}'::jsonb, 10),
  ('streak_3',        '3-Day Streak',         'Three days in a row at 80%+ score.',                 '🔥', '{"type":"streak","min":3}'::jsonb,           20),
  ('streak_7',        'Week Long',            'Seven days in a row at 80%+ score.',                 '🔥', '{"type":"streak","min":7}'::jsonb,           30),
  ('streak_30',       'Iron Month',           'Thirty-day streak. You don''t miss.',                '🗿', '{"type":"streak","min":30}'::jsonb,          40),
  ('tier_pro',        'Welcome to the Pros',  'Hit Pro tier (50%+ 30-day avg).',                    '🏀', '{"type":"tier","min":"pro"}'::jsonb,         15),
  ('tier_elite',      'Elite Status',         'Hit Elite tier (70%+ 30-day avg).',                  '🏆', '{"type":"tier","min":"elite"}'::jsonb,       35),
  ('tier_hof',        'Hall of Fame',         'Hit Hall of Fame tier (85%+ 30-day avg).',           '👑', '{"type":"tier","min":"hall_of_fame"}'::jsonb,50),
  ('daily_champ',     'Top of the Board',     'Finish #1 on the daily leaderboard.',                '🥇', '{"type":"daily_rank","max":1}'::jsonb,       25),
  ('weekly_champ',    'Week''s Best',         'Finish #1 on the weekly leaderboard.',               '🏅', '{"type":"weekly_rank","max":1}'::jsonb,      45),
  ('crm_killer',      'CRM Killer',           'Five consecutive days at 95%+ on Brodie CRM.',       '📈', '{"type":"metric_streak","app":"crm","min_pct":95,"min_days":5}'::jsonb, 30),
  ('facility_steward','Facility Steward',     'Zero overdue invoices for two straight weeks.',      '🏟️', '{"type":"metric_streak","app":"facilities","metric":"invoice_on_time","min_pct":100,"min_days":14}'::jsonb, 30),
  ('comeback_kid',    'Comeback Kid',         'Improved your score by 20+ percentage points day-over-day.', '📊', '{"type":"daily_delta","min":20}'::jsonb, 20),
  ('clean_board',     'Clean Board',          'Resolved every action item in a single day.',        '✨', '{"type":"clean_board"}'::jsonb,              15),
  ('perfect_day',     'Perfect Day',          'Hit 100% score for the day.',                        '⭐', '{"type":"single_day_pct","min":100}'::jsonb, 50)
on conflict (slug) do nothing;
