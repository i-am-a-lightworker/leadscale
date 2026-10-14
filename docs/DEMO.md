# Five-Minute Demo Runbook

## Before the Demo

- Apply the timestamped Supabase migrations and set `DATA_BACKEND=supabase` if demonstrating persistence.
- Run `npm run demo:reset` to replace only the known seed lead IDs; it does not truncate other lead records or run history.
- Set `AGENT_MODE=mock` for a deterministic, zero-model-cost fallback plan. Use `live` only after a passing live eval and with model credentials configured.
- Confirm `GET /api/health`, `GET /api/status`, and `GET /api/leads` from a trusted caller.
- If the UI is using the API, verify its trusted server-side auth path. Never expose `ROUTE_SHARED_SECRET` to the browser. Until that exists, use fixtures for the browser and use the protected API from the shell.
- Prepare one forwarded email using generic labels (`Name`, `Email`, `Phone`, `Budget`, `Timeline`, `Message`) and send it to the configured Resend inbound address.

## Live Walkthrough

1. **Forwarded email arrives (0:00-0:45).** Forward the prepared inquiry to the inbound address. Show the Resend `email.received` delivery and the app's signed webhook route.
2. **Normalization (0:45-1:30).** Fetch `/api/leads`; point out lowercased email, normalized phone, parsed budget/timeline, and preserved raw source payload.
3. **Filter decision (1:30-2:15).** Call `/api/prioritize` and show the rejected test lead plus duplicate/conflict/stale/re-engagement flags in `meta`.
4. **Ranking and action (2:15-3:00).** Show ranked priority, score, evidence reasons, one recommended action, missing information, and confidence. Explain that deterministic scoring bounds model score adjustments.
5. **Duplicate and conflict (3:00-4:00).** Compare the seeded duplicate/conflicting entries. Show the `DUPLICATE:` and `CONFLICT:` flags and the corresponding deterministic score penalties; do not present a conflict as a resolved fact.
6. **Audit trail (4:00-5:00).** Show the run JSON log and `prioritize_runs` row: prompt version, counts, duration percentiles, validation failures, fallback count, and the `agent`/`fallback` source marker.

The current DB repository merges duplicate contacts during intake based on normalized email/phone and keeps the most recent row. This may remove a duplicate before the filter can flag it; use the in-memory evaluation set to demonstrate that behavior until canonical duplicate retention is confirmed. This is a known integration limitation, not a UI contract change.

## UI State Checks

- Loading: `GET /api/leads?simulate=slow` delays 1.2 seconds in mock mode.
- Empty: `GET /api/leads?simulate=empty` returns a valid empty list.
- Error: `GET /api/leads?simulate=error` returns a generic structured error.
- Partial failure: import one valid and one invalid row and show `imported`, `skipped`, and row messages.
- Fallback: `POST /api/prioritize?simulate=fallback` produces `meta[].source = "fallback"` in mock mode.

These switches are API-only; use curl or the browser Network panel. They are disabled unless `AGENT_MODE=mock`.

## Backup Plan

If the model or network is unavailable, set `AGENT_MODE=mock` and redeploy. The deterministic runner keeps the response contract available; failures in live mode also fall back per lead. If Resend is unavailable, use manual JSON intake and keep the source payload for a later retry.

## Likely Questions

1. **How do you prevent hallucinations?** The model receives one lead, a deterministic score, filter flags, and missing fields. Output is schema-validated, score-clamped to a +/-10 bound, and confidence cannot exceed deterministic evidence; invalid/sensitive output uses a deterministic fallback.
2. **How do you handle fair housing?** The system denies sensitive attributes in assessment text and instructs the model not to infer them. The demo checks family-status/religion bait; human review remains required.
3. **What happens when the model fails?** A per-lead timeout/retry path returns a deterministic fallback with `source: "fallback"`; the overall API response remains valid.
4. **How is PII handled?** PII is server-side in the normalized lead and untouched raw payload; client table access is denied by RLS. Logs contain aggregate run metadata only. The retention schedule still needs owner approval.
5. **How would you add a source?** Add a parser behind the existing adapter interface, preserve raw input, normalize to the frozen `Lead`, and test its happy/messy/invalid paths. Do not integrate directly with listing sources.

## Screen and Endpoint Checklist

- Lead queue/list: `GET /api/leads`; `POST /api/prioritize`.
- Lead detail: selected ranked result in the current UI; legacy direct endpoint `GET /api/leads/{id}`.
- Intake/import: `POST /api/intake/csv`, `POST /api/intake/manual`; Resend delivery to `POST /api/intake/email`.
- Health/operations: `GET /api/health`, `GET /api/status`.
- UI states: use the mock-only simulation query strings above.
- Security: confirm API requests originate through an authenticated server-side caller; no browser-held API secret.

## Known Limitations and Next Steps

- Supabase intake dedupe can merge duplicate contacts before prioritization exposes a duplicate flag; confirm the desired source-history model.
- The UI's current API client has no authenticated server-side session/proxy. Production API-mode UI integration is blocked until that owner/path is chosen.
- The rate limiter is per process and not globally reliable on Vercel; configure a verified Firewall or shared-store rule.
- Real listing-site email formats are unverified; two source parser examples remain explicitly fictional.
- Agree data-retention duration and operational deletion process.
- Run the live eval and production smoke with real deployment credentials and record the results before demo day.