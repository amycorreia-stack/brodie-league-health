-- 0012_first_login_tour.sql — track who's seen the welcome tour
-- so we don't pester returning users.

alter table profiles
  add column if not exists tour_completed_at timestamptz;

comment on column profiles.tour_completed_at is
  'Set the first time the user dismisses the welcome tour on My Day.
   NULL = tour will show on next page load. Reset to NULL to re-show.';
