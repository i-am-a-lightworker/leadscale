-- TODO(verify): Apply against a disposable copy of the target project's existing database before production rollout.
-- Preserve existing records while aligning the shared setup table with the frozen lib/types/lead.ts contract.
alter table public.lead_scores drop constraint if exists lead_scores_lead_id_fkey;
alter table public.leads drop constraint if exists leads_pkey;
alter table public.leads alter column id type text using id::text;
alter table public.lead_scores alter column lead_id type text using lead_id::text;
alter table public.leads add constraint leads_pkey primary key (id);
alter table public.lead_scores
  add constraint lead_scores_lead_id_fkey foreign key (lead_id) references public.leads(id) on delete cascade;

alter table public.leads alter column timeline type jsonb
  using case
    when timeline is null or btrim(timeline) = '' then '{}'::jsonb
    when upper(timeline) in ('IMMEDIATE', 'WITHIN_30_DAYS', 'WITHIN_3_MONTHS', 'FLEXIBLE')
      then jsonb_build_object('urgency', upper(timeline))
    else '{}'::jsonb
  end;
alter table public.leads add column if not exists lead jsonb;
alter table public.leads add column if not exists content_hash text not null default '';
alter table public.leads add column if not exists dedupe_key text;
alter table public.leads add column if not exists updated_at timestamptz not null default now();

update public.leads
set lead = jsonb_strip_nulls(jsonb_build_object(
  'id', id,
  'source', source,
  'receivedAt', to_char(received_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'name', name,
  'email', email,
  'phone', phone,
  'property', jsonb_strip_nulls(jsonb_build_object(
    'address', property -> 'address',
    'city', property -> 'city',
    'propertyType', coalesce(property -> 'propertyType', property -> 'type'),
    'askingPrice', property -> 'askingPrice'
  )),
  'budget', jsonb_strip_nulls(jsonb_build_object(
    'min', coalesce(budget -> 'min', budget -> 'minimum'),
    'max', coalesce(budget -> 'max', budget -> 'maximum'),
    'currency', coalesce(budget -> 'currency', '"USD"'::jsonb)
  )),
  'timeline', coalesce(timeline, '{}'::jsonb),
  'message', coalesce(message, ''),
  'engagement', jsonb_build_object('replyCount', 0, 'viewCount', 0, 'tourRequestCount', 0),
  'rawSourceData', coalesce(raw_source_data, '{}'::jsonb)
))
where lead is null;
alter table public.leads alter column lead set not null;

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null references public.leads(id) on delete cascade,
  assessment jsonb not null check (jsonb_typeof(assessment) = 'object'),
  score integer not null check (score between 0 and 100),
  priority text not null check (priority in ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  confidence text not null check (confidence in ('LOW', 'MEDIUM', 'HIGH')),
  source text not null check (source in ('agent', 'fallback')),
  prompt_version text not null,
  adjustments jsonb not null default '[]'::jsonb check (jsonb_typeof(adjustments) = 'array'),
  flags jsonb not null default '[]'::jsonb check (jsonb_typeof(flags) = 'array'),
  input_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.rejected_leads (
  id uuid primary key default gen_random_uuid(),
  lead_id text references public.leads(id) on delete set null,
  raw jsonb not null,
  reasons jsonb not null check (jsonb_typeof(reasons) = 'array'),
  created_at timestamptz not null default now()
);

create table if not exists public.intake_events (
  id uuid primary key default gen_random_uuid(),
  provider_message_id text not null unique,
  source text not null,
  status text not null check (status in ('pending', 'processed', 'rejected', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists leads_received_at_idx on public.leads (received_at desc);
create unique index if not exists leads_dedupe_key_uidx on public.leads (dedupe_key) where dedupe_key is not null;
create index if not exists assessments_score_idx on public.assessments (score desc);
create index if not exists assessments_priority_idx on public.assessments (priority);
create index if not exists assessments_latest_idx on public.assessments (lead_id, created_at desc);

alter table public.leads enable row level security;
alter table public.lead_scores enable row level security;
alter table public.assessments enable row level security;
alter table public.rejected_leads enable row level security;
alter table public.intake_events enable row level security;

-- No client policies are intentional: browser access is denied. Only trusted server code uses the service-role key,
-- which bypasses RLS and must never be bundled into client code.
comment on table public.leads is 'Lead access is server-only; no anon/authenticated RLS policy is configured.';
comment on table public.lead_scores is 'Legacy score access is server-only; no anon/authenticated RLS policy is configured.';
comment on table public.assessments is 'Assessment access is server-only; no anon/authenticated RLS policy is configured.';
comment on table public.rejected_leads is 'Rejected source data is sensitive and server-only; no client RLS policy is configured.';
comment on table public.intake_events is 'Webhook idempotency records are server-only; no client RLS policy is configured.';