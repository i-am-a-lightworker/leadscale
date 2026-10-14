# API Reference

All routes are same-origin only for browser requests. Routes that return lead data or mutate it require `ROUTE_SHARED_SECRET` in production, sent as `x-api-key` by a trusted server caller. Do not put this secret in a browser bundle. Webhook routes use Resend signatures instead. Cross-origin requests are rejected; no permissive CORS headers are emitted.

All new request handlers return JSON. Errors use `{ "error": { "code": "...", "message": "..." } }`, except the pre-existing legacy lead-detail route, which retains `{ "error": "..." }`.

## Health and Status

### `GET /api/health`

Request: none.

Response `200`:

```json
{ "status": "ok" }
```

### `GET /api/status`

Request: none. This aggregate endpoint reveals no secrets or lead-level fields.

Response `200`:

```json
{
  "status": "ok",
  "mode": "mock",
  "backend": "memory",
  "promptVersion": "1.0.0",
  "counts": {
    "leads": 6,
    "scored": 0,
    "rejected": 0,
    "fallback": 0,
    "fallbackRate": 0,
    "runs": 0
  }
}
```

Errors: `500 STATUS_UNAVAILABLE`.

## Lead Data

### `GET /api/leads`

Requires the shared route credential in production. Response `200` is an array of frozen `Lead` objects from `lib/types/lead.ts`. It sends `Cache-Control: no-store`.

Errors: `401 UNAUTHORIZED`, `403 INVALID_ORIGIN`, `429 RATE_LIMITED`, `500 LEADS_UNAVAILABLE`.

Mock-only UI states can be requested with `?simulate=empty|error|slow`. `empty` returns `[]`; `error` returns `500`; `slow` waits 1.2 seconds. These are ignored unless `AGENT_MODE=mock`.

### `GET /api/leads/{id}`

Requires the shared route credential in production. This pre-existing endpoint returns the legacy flattened `src/contracts/lead.ts` detail shape; it is intentionally not rewritten as part of the frozen-contract work.

Errors retain the legacy shape: `400 { "error": "Invalid lead id." }` or `404 { "error": "Lead not found." }`.

## Prioritization

### `POST /api/prioritize`

Requires the shared route credential in production. `leadIds` is optional; omit it to prioritize all leads. A maximum of 12 leads is allowed per call.

Request:

```json
{ "leadIds": ["strong", "weak"] }
```

Response `200` is the unchanged Day 1 shape: `{ "ranked": [{ "lead": Lead, "assessment": Assessment }], "rejected": [{ "lead": Lead, "reasons": string[] }], "meta": [...] }`. A compact example includes one entry in each priority band, one rejected lead, and a fallback-sourced item:

```json
{
  "ranked": [
    { "lead": { "id": "l-urgent", "source": "manual", "receivedAt": "2026-10-14T10:00:00.000Z", "name": "Avery", "email": "avery@example.test", "property": {}, "budget": { "currency": "USD" }, "timeline": {}, "message": "Tour requested.", "engagement": { "replyCount": 0, "viewCount": 0, "tourRequestCount": 0 }, "rawSourceData": {} }, "assessment": { "score": 90, "priority": "URGENT", "reasons": ["A tour was requested.", "Contact details are present."], "recommendedAction": "The assigned agent should confirm a tour time today.", "missingInformation": [], "confidence": "HIGH" } },
    { "lead": { "id": "l-high", "source": "csv", "receivedAt": "2026-10-14T09:00:00.000Z", "name": "Blair", "email": "blair@example.test", "property": {}, "budget": { "currency": "USD" }, "timeline": {}, "message": "Interested in a home.", "engagement": { "replyCount": 0, "viewCount": 0, "tourRequestCount": 0 }, "rawSourceData": {} }, "assessment": { "score": 75, "priority": "HIGH", "reasons": ["The lead stated interest.", "A contact method is available."], "recommendedAction": "The assigned agent should contact the lead today.", "missingInformation": [], "confidence": "MEDIUM" } },
    { "lead": { "id": "l-medium", "source": "manual", "receivedAt": "2026-10-14T08:00:00.000Z", "name": "Casey", "email": "casey@example.test", "property": {}, "budget": { "currency": "USD" }, "timeline": {}, "message": "Browsing homes.", "engagement": { "replyCount": 0, "viewCount": 0, "tourRequestCount": 0 }, "rawSourceData": {} }, "assessment": { "score": 55, "priority": "MEDIUM", "reasons": ["The lead is browsing homes.", "No tour request is recorded."], "recommendedAction": "The assigned agent should confirm property criteria tomorrow.", "missingInformation": ["Target budget"], "confidence": "LOW" } },
    { "lead": { "id": "l-low", "source": "manual", "receivedAt": "2026-10-14T07:00:00.000Z", "name": "Dana", "email": "dana@example.test", "property": {}, "budget": { "currency": "USD" }, "timeline": {}, "message": "Maybe interested.", "engagement": { "replyCount": 0, "viewCount": 0, "tourRequestCount": 0 }, "rawSourceData": {} }, "assessment": { "score": 25, "priority": "LOW", "reasons": ["Buying intent is not specific.", "Budget and timing need clarification."], "recommendedAction": "The assigned agent should ask about budget and timing by the next business day.", "missingInformation": ["Target budget", "Buying timeline"], "confidence": "LOW" } }
  ],
  "rejected": [
    { "lead": { "id": "l-test", "source": "csv", "receivedAt": "2026-10-14T06:00:00.000Z", "name": "Test", "email": "test@test.com", "property": {}, "budget": { "currency": "USD" }, "timeline": {}, "message": "Test message", "engagement": { "replyCount": 0, "viewCount": 0, "tourRequestCount": 0 }, "rawSourceData": {} }, "reasons": ["Lead appears to be a spam or test record."] }
  ],
  "meta": [
    { "leadId": "l-urgent", "source": "agent", "retries": 0, "adjustments": [], "flags": [], "durationMs": 110, "promptVersion": "1.0.0" },
    { "leadId": "l-high", "source": "agent", "retries": 0, "adjustments": [], "flags": [], "durationMs": 105, "promptVersion": "1.0.0" },
    { "leadId": "l-medium", "source": "agent", "retries": 0, "adjustments": [], "flags": [], "durationMs": 90, "promptVersion": "1.0.0" },
    { "leadId": "l-low", "source": "fallback", "retries": 1, "adjustments": ["Deterministic fallback used after model failure or invalid output."], "flags": [], "durationMs": 15000, "promptVersion": "1.0.0" }
  ]
}
```

Errors: `400 INVALID_REQUEST`, `401 UNAUTHORIZED`, `403 INVALID_ORIGIN`, `404 LEAD_NOT_FOUND`, `413 PAYLOAD_TOO_LARGE` or `LEAD_LIMIT_EXCEEDED`, `429 RATE_LIMITED`, `500 PRIORITIZE_FAILED`, `503 AGENT_CONFIGURATION_REQUIRED`.

Mock-only `?simulate=empty|error|slow|fallback` returns an empty valid result, a simulated error, a delayed response, or deterministic fallback assessments. It is disabled outside mock mode.

## Intake

### `POST /api/intake/csv`

Requires the shared route credential in production. Accepts `text/csv` or multipart form data with a `file` or `csv` field. Example CSV body:

```csv
Name,Email,Phone,Budget,Timeline,Message
Morgan Reed,morgan@example.test,512-555-0199,$450k,within 30 days,Interested in touring
```

### `POST /api/intake/manual`

Requires the shared route credential in production. Accepts a lead-shaped object, an array, or `{ "leads": [...] }`.

```json
{ "name": "Morgan Reed", "email": "morgan@example.test", "phone": "512-555-0199", "budget": "$450k", "timeline": "within 30 days", "message": "Interested in touring" }
```

### `POST /api/intake/email`

Resend `email.received` webhook only; requires a valid Svix signature. Resend's event carries `data.email_id`; the server retrieves the inbound body from Resend. A repeated provider email ID returns a successful no-op.

Verified event request example (the three `svix-*` headers are required):

```json
{
  "type": "email.received",
  "created_at": "2026-10-14T12:00:00.000Z",
  "data": {
    "email_id": "56761188-7520-42d8-8898-ff6fc54ce618",
    "from": "buyer@example.test",
    "to": ["leads@example.test"],
    "subject": "New buyer inquiry"
  }
}
```

All intake routes return the same partial-success structure:

```json
{ "imported": 1, "skipped": 1, "errors": [{ "row": 3, "message": "email: Invalid email address" }] }
```

Errors: `400 INVALID_REQUEST`/`INVALID_JSON`/`INVALID_SIGNATURE`, `401 UNSIGNED_WEBHOOK`/`INVALID_SIGNATURE`/`UNAUTHORIZED`, `403 INVALID_ORIGIN`, `413 PAYLOAD_TOO_LARGE`, `415 UNSUPPORTED_MEDIA_TYPE`, `429 RATE_LIMITED`, `500 INTAKE_FAILED`/`EMAIL_INTAKE_FAILED`, `503 WEBHOOK_NOT_CONFIGURED`.

## UI Verification Checklist

- Lead queue: `GET /api/leads` and `POST /api/prioritize`; verify `Lead[]`, rank, priority, next action, and fallback source metadata.
- Lead details: current UI opens detail from the ranked item; direct detail API is the legacy flattened `GET /api/leads/{id}` response.
- Loading: use `GET /api/leads?simulate=slow` with the UI's loading state or inspect its request in DevTools.
- Empty: `GET /api/leads?simulate=empty` returns `[]`.
- Error: `GET /api/leads?simulate=error` returns a structured `500`.
- Partial import: POST a CSV/manual batch containing one valid and one invalid row; render `imported`, `skipped`, and `errors`.
- Fallback source: `POST /api/prioritize?simulate=fallback` in mock mode; `meta[].source` is `fallback`.
- Intake screen: `POST /api/intake/csv`, `POST /api/intake/manual`, and signed Resend delivery to `POST /api/intake/email`.
- Operations: `GET /api/status` exposes aggregate counts only.

Production UI callers need an authenticated server-side session/proxy. Never send `ROUTE_SHARED_SECRET` from a browser. The current client has no session integration; confirm the auth owner before turning fixtures off in production.