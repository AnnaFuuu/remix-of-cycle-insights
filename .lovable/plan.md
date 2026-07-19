# Cycloscope → Clinical Research Platform

Pivot Cycloscope from consumer wellness UI into an MIT-hackathon-grade women's hormonal health research platform. Keep local-first storage, i18n, and the Copilot agent — but add clinical data surfaces, a foundation model output view, and a longitudinal research dashboard.

## 1. Design language

Replace the pastel wellness palette with a clean clinical/biomedical look: near-white background, slate typography, indigo/teal primary, monospace for numeric values, dense tables with hairline borders, calm status colors (green/amber/red) for reference-range flags. Update `src/styles.css` tokens; no gradients on cards.

## 2. Domain model extensions (`src/lib/clinical/`)

New strict-typed modules (kept separate from the existing `hormonal/` store so we don't break current flows):

- `types.ts` — interfaces:
  - `LabPanel { id, collectedAt, cycleDay, phase, fasting, lab, assays: LabAssay[] }`
  - `LabAssay { analyte: LabAnalyte, value, unit, refLow, refHigh, flag: "L"|"N"|"H", method }`
  - `LabAnalyte` union: `LH | FSH | Estradiol | Progesterone | AMH | Testosterone | DHEA_S | Prolactin | TSH | FreeT4 | Cortisol`
  - `WearableSample { date, hrv, restingHR, skinTempDelta, respRate, spo2, steps, activeMinutes, sleepStages: { deep, light, rem, awake } }`
  - `BiomarkerTimepoint`, `DataQualityReport`, `FoundationPrediction { phase, confidence, hormones: {analyte: {mean, ciLow, ciHigh}}, featureImportance: {feature, weight}[], shap: {feature, contribution, direction}[] }`
- `reference-ranges.ts` — phase-conditioned ranges per analyte with units.
- `seed-clinical.ts` — deterministic seed for ~6 lab panels + 90 days wearable + FM predictions.
- `datasets.ts` — static metadata for mcPHASES / NHANES / UK Biobank (sample size, modalities, variable counts, provenance, license, citation).
- `model.ts` — mock foundation-model inference: derives phase probability, predicted hormone means with 90% CIs, feature importances and SHAP-style contributions from recent wearable+lab data.
- `quality.ts` — completeness %, missingness heatmap data, outlier counts, drift indicators.

## 3. New routes & pages

Create under `src/routes/` and `src/features/`:

| Route | Feature file | Purpose |
|---|---|---|
| `/labs` | `features/labs/Laboratory.tsx` | Endocrine panel table with reference ranges, L/N/H flags, unit column, per-panel drawer |
| `/wearables` | `features/wearables/Wearables.tsx` | HRV/RHR/SkinTemp/RespRate/SpO₂/Steps/ActiveMin/Sleep-stage charts |
| `/biomarkers` | `features/biomarkers/Biomarkers.tsx` | Longitudinal per-analyte trajectories vs phase overlay |
| `/quality` | `features/quality/DataQuality.tsx` | Completeness, missingness heatmap, outliers, sensor uptime |
| `/model` | `features/model/FoundationModel.tsx` | Phase prediction + confidence, predicted hormones with CIs, feature importance bar chart, SHAP cards |
| `/xai` | `features/xai/Explainability.tsx` | Per-prediction SHAP waterfall, counterfactual sliders, cohort attribution |
| `/research` | rewrite `features/research/Research.tsx` | Add datasets summary (mcPHASES, NHANES, UK Biobank) with sample size / modalities / variables / provenance cards; keep JSON export + narrative |
| `/` (Dashboard) | rewrite `features/dashboard/Dashboard.tsx` | Longitudinal research dashboard: 7d/30d/90d/1y tab switcher, synchronized plots for hormones, wearables, symptoms, BBT, cycle events |

Sidebar (`components/app-sidebar.tsx`) grouped:
- **Overview**: Dashboard
- **Data**: Laboratory, Wearables, Biomarkers, Telemetry Log, Data Quality
- **AI**: Foundation Model, Explainability, Copilot
- **Research**: Research Portal, Settings

## 4. Longitudinal research dashboard

Replace current Dashboard with a stacked, x-axis-synchronized Recharts layout:
- Timescale tabs: 7d / 30d / 90d / 1y (1y uses weekly aggregation).
- Row 1: hormone trajectories (E2, P4, LH, FSH) from lab panels + interpolated FM predictions with CI band.
- Row 2: wearable strip (HRV, RHR, skin temp delta).
- Row 3: BBT line with phase shading.
- Row 4: symptom heatstrip (cramps/fatigue/mood 0–10).
- Row 5: menstrual cycle event markers (period start, ovulation estimate, luteal onset).
- Hovering any chart highlights the same date across all rows (shared tooltip via `syncId`).

## 5. Foundation Model Output page

- Header: current predicted phase, confidence gauge, model card badge (name, version, training corpus).
- Predicted hormone panel: table with predicted mean + 90% CI + observed value if available + delta.
- Feature importance: horizontal bar chart (top 10 features).
- SHAP cards: per top feature a card with contribution magnitude, direction chip, and one-line clinical rationale.
- Uncertainty band chart: predicted E2/P4 over next 14 days with shaded CI.

## 6. Research Portal additions

Keep existing JSON export + Copilot narrative. Add a **Datasets** section: card grid for mcPHASES, NHANES, UK Biobank with sample size, modalities (self-report / wearable / labs / imaging), variable count, provenance URL, license, and a "used for pretraining" pill. Add a compact provenance/citation block per dataset.

## 7. i18n

Add all new UI strings to `src/lib/i18n.tsx` under new namespaces (`labs`, `wearables`, `biomarkers`, `quality`, `model`, `xai`, `datasets`, `dashboard`) for all five locales. Where a clinical term has no established translation, keep English (e.g., "SHAP", "AMH").

## 8. Non-goals / preserved

- Keep local-first storage; no Cloud enablement.
- Keep existing Telemetry Log, Analytics, Settings, Copilot agent, i18n, and export schema working.
- No changes to auth, no new secrets, no model swap.

## Technical notes

- Recharts already installed; use `syncId` for synchronized cursors.
- Foundation model output is a deterministic mock (`clinical/model.ts`) — no extra LLM calls.
- Reference ranges are static, phase-aware; flag computation is pure.
- Dataset metadata is a hard-coded constant, not fetched.
- All new pages are client-rendered under existing shell; each route file gets its own `head()` with title + description.
- No changes to `src/routes/api/chat.ts` schema; Copilot continues to work via existing store.
