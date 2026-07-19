
# Goal

Turn Cycloscope into a real mcPHASES-trained research platform that predicts menstrual cycle phase from multi-modal daily signals. Ingest your `sleep_score.csv` now as the first real predictor, and scaffold every other mcPHASES table from the README as empty slots so you can drop each CSV in later without any schema work.

# Confirmed from your upload

`sleep_score.csv`, 5308 rows, columns exactly:
`id, study_interval, is_weekend, day_in_study, timestamp, overall_score, composition_score, revitalization_score, duration_score, deep_sleep_in_minutes, resting_heart_rate, restlessness`.
`study_interval` is stored as `2022` / `2024` (Interval 1 / Interval 2 per README) — I'll keep it as an integer year.

# Phase 1 — mcPHASES-native schema + sleep_score ingestion (this turn)

### Data model

Drop the existing `physionet_sleep_records` (only demo data). Add:

- **`mcphases_participants`** — `(participant_id int, first_seen_at, notes)`. Auto-upserted on ingest.
- **`mcphases_sleep_score`** — mirrors your CSV 1:1: `participant_id, study_interval, day_in_study, timestamp_local, is_weekend, overall_score, composition_score, revitalization_score, duration_score, deep_sleep_in_minutes, resting_heart_rate, restlessness`. Unique key `(participant_id, study_interval, day_in_study)`.
- **`mcphases_ingest_runs`** — audit row per upload: `table_name, filename, rows_inserted, rows_updated, rows_skipped, participants, errors jsonb, created_at`.
- **Placeholder tables for every other mcPHASES CSV in the README** (created empty now so the UI, joins, and feature builder can reference them from day one):
  `mcphases_active_minutes, mcphases_active_zone_minutes, mcphases_altitude, mcphases_calories, mcphases_computed_temperature, mcphases_demographic_vo2_max, mcphases_distance, mcphases_estimated_oxygen_variation, mcphases_exercise, mcphases_glucose, mcphases_heart_rate, mcphases_hrv_details, mcphases_height_weight, mcphases_hormones_selfreport, mcphases_respiratory_rate_summary, mcphases_resting_heart_rate, mcphases_sleep, mcphases_steps, mcphases_stress_score, mcphases_subject_info, mcphases_time_in_hr_zones, mcphases_wrist_temperature`.
  Each has the exact columns from the README, correct key (day-keyed vs window-keyed vs participant-keyed), unique constraint, and `raw jsonb` fallback for anything unexpected.

RLS: public `SELECT` on every table (this is research showcase data), writes only via server functions using service role. GRANTs in the same migration.

### Importer (generic, registry-driven)

- **`src/lib/mcphases/registry.ts`** — one entry per mcPHASES CSV declaring: target table, key columns, column mapping, type coercions, key style (day / window / participant). Every table from the README gets an entry now; `sleep_score` is fully active, the others are marked `status: "scaffold"` (schema exists, importer accepts them, UI shows them as slots).
- **`src/lib/mcphases/ingest.functions.ts`** — one server function `ingestMcphasesCsv({ table, csvText, filename })`: parses with papaparse, coerces via the registry, upserts participants + rows in 1000-row batches, writes an `mcphases_ingest_runs` row, returns `{ inserted, updated, skipped, participants, errors, stats }`.
- **`src/lib/mcphases/summary.functions.ts`** — `getMcphasesOverview()` returns per-table row counts, participant counts, day-range coverage, is-populated flag. Drives the Data Quality grid.

### UI

- **Research Portal** — replace the current sleep panel with an **mcPHASES Importer** card: table dropdown (defaults to `sleep_score`, all 22 tables listed with "scaffolded / active" state), file drop, preview of first 5 rows + detected mapping, confirm, progress, per-run summary. Below it: an **Ingest history** table reading `mcphases_ingest_runs`.
- **Data Quality** — new grid: one card per mcPHASES table showing rows, participants, day coverage, and completeness. Sleep score card is populated after your upload; the others show "Awaiting upload" with a link to the importer.
- **Foundation Model** and **XAI** pages — add a banner "Model training uses real mcPHASES tables — currently 1 of 22 active (sleep_score). Upload more to enrich features." No behavior change to the mock output yet; the real model lands in phase 2.

# Phase 2 — Real cycle-phase model (after your next CSV upload, likely `hormones_and_selfreport.csv`)

That file carries the `phase` label; without it we can't supervise training. Once it's in:

- **Feature builder** joins active mcPHASES tables on `(participant_id, day_in_study)`, builds rolling 3/7-day windows, handles windowed tables via day expansion.
- **Trainer** (server function, pure-JS, Worker-safe): logistic regression + gradient-boosted trees predicting `phase ∈ {menstrual, follicular, ovulation, luteal}`; subject-stratified split; persists coefficients + metrics to `mcphases_model_runs`.
- **Foundation Model page** shows real AUROC / F1 / confusion matrix / per-day predictions with confidence.
- **XAI page** shows real per-prediction feature attributions (LR contribution decomposition).

We do phase 2 only after phase 1 is verified against your first real upload.

# Assumptions (say if any is wrong)

1. Reset the DB — drop `physionet_sleep_records`. Nothing there but demo rows.
2. All mcPHASES data is public read in the app.
3. `study_interval` stored as integer year (`2022` / `2024`) matching your CSV.
4. `restlessness` stored as `numeric` (already in 0–1 range in your file).
5. Model training stays server-side in pure JS (no Python). Fine for hackathon scale.

# Technical section

- **Migration**: drop `physionet_sleep_records`; create `mcphases_participants`, `mcphases_ingest_runs`, and all 22 `mcphases_*` tables with GRANT + RLS (public SELECT, service_role ALL) + `updated_at` triggers where applicable. Single migration.
- **New files**: `src/lib/mcphases/{types.ts, registry.ts, ingest.functions.ts, summary.functions.ts}`, `src/components/mcphases/{McphasesImportPanel.tsx, IngestRunsTable.tsx, TableCoverageGrid.tsx}`.
- **Removed**: `src/lib/physionet/*`, `src/components/physionet/SleepDatasetsPanel.tsx`.
- **Wired**: Research Portal uses `McphasesImportPanel` + `IngestRunsTable`; Data Quality uses `TableCoverageGrid`; Foundation Model & XAI get the "1/22 active" banner.
- **i18n**: new keys for importer + coverage grid in en/zh/fr/it/de.
- **Deps**: `papaparse` already installed. No new deps in phase 1.

Approve and I'll build phase 1 and ingest your `sleep_score.csv` end-to-end so you can see real rows in the Data Quality grid immediately.
