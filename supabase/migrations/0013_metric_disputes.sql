-- 0013_metric_disputes.sql
-- LMs can challenge any metric on any day. DMs triage. If approved,
-- a score adjustment lands on that day's snapshot and the rollup re-runs.
--
-- This is the trust valve: the system is wrong sometimes (bad source data,
-- mis-attributed action, late sync), and LMs need a documented path to
-- contest it instead of just grumbling.

create table if not exists metric_disputes (
  id uuid primary key default gen_random_uuid(),
  lm_id uuid not null references league_managers(id) on delete cascade,
  snapshot_date date not null,
  metric_id uuid not null references metrics(id) on delete cascade,

  -- LM-supplied
  reason text not null check (length(reason) between 4 and 2000),
  filed_at timestamptz not null default now(),
  filed_by uuid references profiles(id) on delete set null,

  -- DM-supplied
  status text not null default 'open'
    check (status in ('open', 'approved', 'rejected', 'withdrawn')),
  dm_note text,
  score_adjustment numeric,   -- nullable; set on approve to nudge the day
  resolved_at timestamptz,
  resolved_by uuid references profiles(id) on delete set null
);

create index if not exists idx_disputes_lm_date
  on metric_disputes(lm_id, snapshot_date desc);
create index if not exists idx_disputes_status
  on metric_disputes(status) where status = 'open';
create index if not exists idx_disputes_metric
  on metric_disputes(metric_id);

-- one open dispute per (lm, day, metric) — no spam
create unique index if not exists uq_disputes_one_open_per_metric
  on metric_disputes(lm_id, snapshot_date, metric_id)
  where status = 'open';

alter table metric_disputes enable row level security;

-- LM sees their own. DM/super_admin see everything.
create policy disputes_self_read on metric_disputes for select to authenticated
  using (
    lm_id = current_lm_id()
    or current_role_for_user() in ('dm', 'super_admin')
  );

-- LM can file for themselves. DM/super_admin can file for anyone (rare,
-- but useful when an LM flags something verbally).
create policy disputes_insert on metric_disputes for insert to authenticated
  with check (
    lm_id = current_lm_id()
    or current_role_for_user() in ('dm', 'super_admin')
  );

-- LM can withdraw their own (set status='withdrawn'). DM/super_admin can do anything.
create policy disputes_update on metric_disputes for update to authenticated
  using (
    lm_id = current_lm_id()
    or current_role_for_user() in ('dm', 'super_admin')
  )
  with check (
    lm_id = current_lm_id()
    or current_role_for_user() in ('dm', 'super_admin')
  );

comment on table metric_disputes is
  'LM-filed challenges against a specific (lm_id, snapshot_date, metric_id).
   DM triage with optional score_adjustment when approved.';
