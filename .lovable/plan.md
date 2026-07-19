## Goal

Hide "Model training" (Data for training models + Analytics) from end users. Only the team/researchers should see it. The trained model already persists in `mcphases_trained_models`, so end users just use `Predict phase` on the Dashboard — no training UI needed. Preserve the 5 pipeline steps intact behind the gate so the hackathon rubric is still demonstrable.

## Design

### 1. Gate via a role, not a hidden URL

Add an `app_role` enum (`admin`, `researcher`, `user`) + `user_roles` table + `has_role()` security-definer function (standard pattern). Any signed-in user without a row defaults to `user`.

- `admin` / `researcher` → sees Model training group + `/quality` + `/analytics`.
- everyone else → doesn't see the group; direct URL visits redirect to `/`.

Seed our own accounts as `researcher` after auth is wired (one-line insert per email once we know them).

### 2. Sidebar

`app-sidebar.tsx` reads `useIsResearcher()` (thin hook around `has_role` RPC, cached in React Query). The `nav.group.modelTraining` group is filtered out when false. No visual "locked" hint — regular users don't need to know it exists.

### 3. Route protection

Both `/quality` and `/analytics` get a `beforeLoad` that calls `has_role` and `throw redirect({ to: '/' })` when not a researcher. Keeps the file-based routes in place, no folder move needed (avoids churning `_authenticated/`).

### 4. Remember the 5 runs

Today only Step 5 persists (`mcphases_trained_models`). Extend persistence so every step's last successful run is remembered and re-displayed on page load — user (researcher) doesn't have to re-click 5 buttons after a refresh.

New table `mcphases_pipeline_runs`:

```text
id           uuid pk
step         text unique  -- 'split' | 'features' | 'preprocess' | 'regression' | 'classification'
result       jsonb        -- the full ServerFn return payload for that step
ran_at       timestamptz
ran_by       uuid null
```

- Each Step's server fn upserts its result by `step` at the end.
- Each Step panel's loader calls a new `getLastRun(step)` server fn; if present, hydrate the panel from stored `result` instead of showing the empty "Run" state. A "Re-run" button replaces "Run" once cached.
- Step 5's existing write to `mcphases_trained_models` stays — it's the artifact used by `predictPhase`.

Grants: `researcher`/`admin` read via RLS + `has_role`; `service_role` all. Users never touch it.

### 5. Auth surface

Requires sign-in for the gate to work. If the project doesn't yet have auth, we add Supabase email + Google via the Lovable broker, gated `_authenticated/` layout is already integration-managed. Public dashboard stays public (predict works without login) — only the researcher pages need login. If auth already exists, skip.

## Files touched

- migration: `app_role` enum, `user_roles`, `has_role()`, `mcphases_pipeline_runs` + grants + RLS
- `src/hooks/use-role.ts` — new hook `useIsResearcher()`
- `src/components/app-sidebar.tsx` — filter group by role
- `src/routes/quality.tsx`, `src/routes/analytics.tsx` — `beforeLoad` role gate
- `src/lib/model/split.functions.ts`, `features.functions.ts`, `preprocess.functions.ts`, `regression.functions.ts`, `classification.functions.ts` — upsert to `mcphases_pipeline_runs` at end of each handler
- `src/lib/model/pipeline-runs.functions.ts` — new `getLastRun(step)` + `getAllRuns()` server fns
- `src/features/analytics/*Panel.tsx` (5 files) — on mount, query cached run; render stored result if present; button label → "Re-run"
- `src/features/quality/DataQuality.tsx` — no change beyond route gate

## Open questions

1. Is Supabase auth already enabled on this project, or should the plan also scaffold sign-in? (Affects scope by ~1 migration + auth pages.)
2. Which email(s) should be seeded as `researcher` on first login?

## Out of scope

- Admin UI to grant roles (do it via SQL for now).
- Sharing trained models across environments (single global row per `kind` is enough for the demo).
- Versioning / history of past runs — we only remember the latest per step.
