
## Goal

Right now Analytics → Step 5 trains three models in memory and shows metrics, but the artifact is thrown away — the Dashboard's **Predict phase** button just echoes the payload. Make training write the winning model to the database so the Dashboard can load it and produce a real phase prediction from user input.

## Design

Two moving parts: **persist on train**, **infer on predict**.

### 1. Storage — new table `mcphases_trained_models`

Single row per model kind (latest wins). Migration adds:

```text
id             uuid pk
kind           text  ('phase_classifier')   -- room for future models
algo           text  (softmax_gbrt | random_forest | logistic_regression)
predictors     jsonb  -- ordered string[] of feature keys
medians        jsonb  -- Float64Array serialized as number[]
classes        jsonb  -- ['Menstrual','Follicular','Fertility','Luteal']
artifact       jsonb  -- the actual trees / weights (winner only)
metrics        jsonb  -- {accuracy, macroF1, logLoss, perClass} on val+test
trained_at     timestamptz default now()
n_train        int
```

Grants: `service_role` all. Nothing to `anon`/`authenticated` — inference goes through a server fn using `supabaseAdmin`.

### 2. `trainPhaseClassification` writes the winner

After picking `bestAlgo`, serialize `trainedByAlgo[bestAlgo]` (already plain JS objects — trees are `{feature, threshold, left, right, leaf}` nodes, logreg is `{W, b}`) plus `predictors`, `medians`, `CLASSES`, and the metrics of the winner. Upsert into `mcphases_trained_models` (unique on `kind`).

### 3. New `predictPhase` server fn

Input: `PredictorInput` from `src/lib/prediction/types.ts`.

Steps:
1. Load latest row for `kind='phase_classifier'`. Return `{ trained: false }` if none.
2. Rehydrate `Float64Array` from `medians`.
3. Build feature vector `x[]` of length `predictors.length`:
   - map dashboard keys → model keys (table below); missing/N/A → `medians[f]`.
4. Call `predictProba(model, x)` — same function already in `classification.functions.ts`, factored so the handler can reuse it.
5. Return `{ trained: true, algo, classes, probabilities, top: {phase, confidence}, trainedAt, usedImputation: string[] }`.

Dashboard → model feature map (rest fall back to train medians):

```text
lh              → lh
estradiol       → estrogen
bmi             → bmi
wristTempDelta  → wrist_temp_overnight_mean
restingHR       → rhr, sleep_rhr
hrv             → hrv_mean
respiratoryRate → resp_rate_full
sleepScore      → sleep_score
sleepDuration   → sleep_asleep_min   (hours × 60)
stressScore     → stress_score
glucose         → glucose_mean
cramps          → cramps
bloating        → bloating
age             → (not a feature — ignored)
```

### 4. Dashboard UI (`PredictorPanel.tsx`)

Replace the "prediction pending" placeholder with real output. On click:

- `useMutation(predictPhase)` with the built `PredictorInput`.
- Loading: spinner in the result card.
- Not trained: show "No trained model yet — run Step 5 in Analytics." with a link to `/analytics`.
- Trained: show
  - Big top phase + confidence %
  - Four-bar probability breakdown (color per phase, matching the classification page)
  - Small footer: "Softmax GBRT · trained {relative time} · N features imputed from training medians: LH, Estradiol, …"

Also surface the model badge at the top of the card ("Model: Softmax GBRT · trained 2h ago").

## Files touched

- `supabase/migrations/<ts>_trained_models.sql` — new table + grants
- `src/lib/model/classification.functions.ts` — export `predictProba` and tree/model types; upsert winner at end of `trainPhaseClassification`
- `src/lib/model/predict.functions.ts` — new: `getLatestClassifier`, `predictPhase` server fn, feature mapping
- `src/features/dashboard/PredictorPanel.tsx` — wire button to `useServerFn(predictPhase)`, render result card
- `src/lib/i18n.tsx` — 5 locales for new strings (`predictor.result.top`, `.confidence`, `.notTrained`, `.trainedAgo`, `.usedMedians`, per-phase names already exist)

## Out of scope (this pass)

- Per-user personalised models — one global artifact keyed by `kind`.
- Training from the Dashboard itself — training still happens in Analytics.
- Reusing the Step-4 hormone-imputation regressors — median fallback is enough for the classifier since it already handles missing hormones during training.
