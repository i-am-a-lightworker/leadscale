create table if not exists public.leads (
  id uuid primary key,
  source text not null check (source in ('csv', 'email-forward', 'manual')),
  received_at timestamptz not null,
  name text not null,
  email text,
  phone text,
  property jsonb not null default '{}'::jsonb,
  budget jsonb not null default '{}'::jsonb,
  timeline text not null,
  message text not null default '',
  engagement jsonb not null default '{}'::jsonb,
  raw_source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint leads_require_contact check (email is not null or phone is not null)
);

create table if not exists public.lead_scores (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  score smallint not null check (score between 0 and 100),
  priority text not null check (priority in ('Low', 'Medium', 'High', 'Urgent')),
  reasons jsonb not null check (jsonb_typeof(reasons) = 'array'),
  next_action text not null,
  missing_information jsonb not null default '[]'::jsonb check (jsonb_typeof(missing_information) = 'array'),
  confidence numeric(3, 2) not null check (confidence between 0 and 1),
  generated_at timestamptz not null default now(),
  constraint lead_scores_priority_matches_score check (
    (priority = 'Low' and score between 0 and 39) or
    (priority = 'Medium' and score between 40 and 64) or
    (priority = 'High' and score between 65 and 84) or
    (priority = 'Urgent' and score between 85 and 100)
  ),
  constraint lead_scores_one_current_score_per_lead unique (lead_id)
);

create index if not exists leads_received_at_idx on public.leads (received_at desc);
create index if not exists lead_scores_rank_idx on public.lead_scores (score desc, generated_at desc);