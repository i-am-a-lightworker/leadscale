# leadscale
Lead scaling and scoring tool

## Shared setup

This repository is the shared foundation for the 2-day Real Estate Lead Prioritization Agent MVP. It contains the typed lead contract, deterministic mock endpoints, seed data, and integration boundaries; it does not contain the production agent, UI, or source integrations.

### Start locally

```sh
cp .env.example .env.local
npm install
npm run dev
```

The mock API works without credentials. Configure Supabase only to run the seed script.

### Lead prioritization contracts

Stable lead, assessment, deterministic filtering, scoring, and agent prompt contracts for the MVP live under `lib/`. Run their focused unit tests with `npm run test:lead-prioritization`; pass a fixed `now` to filtering when evaluating age-based rules.

### Fresh project commands

For a fresh directory named `real-estate-lead-agent`:

```sh
npx create-next-app@latest real-estate-lead-agent --typescript --tailwind --app --eslint --src-dir --import-alias "@/*" --use-npm
cd real-estate-lead-agent
npm install @strands-agents/harness@0.2.0 @strands-agents/sdk@1.20.0 zod@^4.1.12 openai @supabase/supabase-js resend @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-tooltip
npm install -D tsx
```

The current npm registry lists Strands Harness `0.2.0` and SDK `1.20.0`. Harness' published README documents `createHarness()` and requires the SDK as a peer. This scaffold does not call it; see `docs/CONTRACT.md` before wiring the real agent. Node.js 22+ is required by the Strands SDK.

### Branches and protection

Git itself cannot protect a remote branch. A repository admin should create a GitHub ruleset for `main` that requires pull requests (and required checks once CI exists). Then each developer creates their own branch from an up-to-date `main`:

```sh
git switch main
git pull --ff-only
git switch -c feature/agent-harness  # Sarah
```

```sh
git switch main
git pull --ff-only
git switch -c feature/ui  # Shalinthia
```

### Seed Supabase

Apply `supabase/migrations/20261008000000_shared_setup.sql` in the Supabase SQL editor or with the Supabase CLI, then run:

```sh
npm run seed
```

### Deploy a hello world

1. Push this repository to GitHub and import it into Vercel.
2. Keep the framework preset as Next.js and the build command as `npm run build`.
3. Deploy without environment secrets; `/api/health` is independent of external services.
4. Open the deployment's `/api/health` URL and confirm it returns `{"status":"ok"}`.
5. Add production environment values from `.env.example` in Vercel only when enabling those integrations, then redeploy.

Contract and P0 boundaries are in `docs/CONTRACT.md`.
