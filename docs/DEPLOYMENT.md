# Deployment and Security

## Vercel Environment

Set values in Project Settings → Environment Variables. Do not commit real values or expose server-only values with `NEXT_PUBLIC_` names.

| Variable | Purpose | Required | Where |
| --- | --- | --- | --- |
| `DATA_BACKEND` | `memory` or `supabase` repository selection | Yes | Vercel dashboard |
| `SUPABASE_URL` | Supabase project URL | For Supabase backend | Vercel dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase persistence; bypasses RLS | For Supabase backend | Vercel dashboard secret |
| `AGENT_MODE` | `mock` kill switch or `live` agent execution | Yes | Vercel dashboard |
| `AGENT_MODEL` | Live model identifier | For live mode | Vercel dashboard |
| `OPENAI_API_KEY` | Live model credential | For live mode | Vercel dashboard secret |
| `AGENT_TIMEOUT_MS` | Per-lead timeout, maximum 15,000 ms | Optional | Vercel dashboard |
| `AGENT_CONCURRENCY` | Concurrent model calls, maximum 3 | Optional | Vercel dashboard |
| `LEAD_MESSAGE_MAX_CHARS` | Message passed to live lead retrieval, maximum 4,000 | Optional | Vercel dashboard |
| `ROUTE_SHARED_SECRET` | Protects lead PII and non-webhook intake/prioritize routes | Required in production | Vercel dashboard secret |
| `INTAKE_MAX_BYTES` | Import payload cap; hard capped at 2 MB | Optional | Vercel dashboard |
| `RESEND_API_KEY` | Retrieve inbound email body by event email ID | For email intake | Vercel dashboard secret |
| `RESEND_WEBHOOK_SECRET` | Verify Resend/Svix webhook signatures | For email intake/smoke | Vercel dashboard secret |
| `RESEND_INBOUND_DOMAIN` | Resend inbound domain configuration reference | For email intake setup | Vercel dashboard |
| `NEXT_PUBLIC_USE_FIXTURES` | `false` makes the current browser client call the API | Optional | Vercel dashboard |
| `SMOKE_RESEND_EMAIL_ID` | Existing received-email ID used by the smoke script | Local smoke only | Local `.env.local`, never committed |

`NEXT_PUBLIC_SUPABASE_URL` is not required; the browser must not connect using the service-role key. The sample `.env.example` contains placeholders only.

## Runtime, Limits, and Rate Control

The prioritize handler exports `maxDuration = 120`. Current Vercel docs list a 300-second default and Hobby maximum, and an 800-second Pro/Enterprise maximum; the route's 120 seconds is below those published caps. It bounds a request to 12 leads, 15-second per-lead calls, and concurrency 3. Per-lead caching reduces repeated work. Confirm the deployed project's runtime and plan at rollout; Vercel limits can change.

The in-process limiter is best-effort only. Vercel Functions autoscale across instances, so a process-local map is not a global abuse limit. **TODO(verify):** Sarah's Vercel project owner must configure and test a Vercel Firewall rate-limit rule or approved shared rate-limit store before relying on global throttling. No unverified Vercel SDK/API was added.

No permissive CORS headers are configured. Browser requests with a foreign `Origin` are rejected. Same-origin checks are not authentication; production lead-data routes also require `ROUTE_SHARED_SECRET`. The existing UI cannot safely store that secret and currently has no session flow. Do not set `NEXT_PUBLIC_ROUTE_SHARED_SECRET`; add a trusted session/backend proxy before connecting the production UI.

## Smoke Test

After deploying, set `AGENT_MODE=mock` temporarily, provide the local secret values to the shell, and identify an email already available to Resend's received-email retrieval API:

```sh
SMOKE_RESEND_EMAIL_ID=<existing-received-email-id> npm run smoke -- https://your-deployment.vercel.app
```

The script checks health, status, lead list, mock prioritize, a correctly signed email webhook, and invalid-signature rejection. It requires `RESEND_WEBHOOK_SECRET`; add `ROUTE_SHARED_SECRET` to the environment running the script if the deployed routes require it. The successful webhook check requires `SMOKE_RESEND_EMAIL_ID` to refer to a real accessible received email. The script prints HTTP statuses only.

## Rollback

In Vercel Deployments, promote the last known-good deployment. If the live model is the failure source, set `AGENT_MODE=mock` in the Vercel dashboard and redeploy; this switches scoring to the deterministic mock runner while keeping the API shape and data backend. Restore `live` only after a successful smoke and eval run.

## PII and Retention

Lead name, contact fields, message, and original payload are stored in `leads.lead`, `leads.raw_source_data`, and rejected intake records in `rejected_leads.raw`. Assessment reasons/actions are retained in `assessments.assessment`. `intake_events` stores provider IDs/status only; `prioritize_runs` stores aggregate counts/timings only. These tables have RLS enabled and no browser policies; trusted server code uses the service-role key.

There is no automatic retention purge. Agree and operate a retention schedule before production. `LeadRepository.deleteLead(id)` deletes the lead, its cascading assessments, and linked rejection records in both repository implementations. Run summaries remain aggregate-only.