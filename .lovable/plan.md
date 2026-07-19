# Step 5 · Menstrual phase classification

## What we have (verified against Postgres)

- Label `phase` in `mcphases_daily_features`: 5,658 labeled days across ~42 participants
  - Luteal 1,912 · Follicular 1,386 · Fertility 1,281 · Menstrual 1,079 (moderate imbalance)
- ~56 predictor columns (HRV / sleep / RHR / respiratory / stress / glucose / wrist temp / self-report / anthropometric / hormones)
- Participant-level 60/20/20 split from Step 1 (`getTrainValTestSplit`) — reused so no subject leaks across sets

## Chosen model — evidence for the pick

Peer-reviewed benchmarks on small–medium tabular data with mixed continuous + ordinal predictors and moderate class imbalance consistently rank **gradient-boosted decision trees** first:

- Grinsztajn et al., *NeurIPS 2022* — "Why do tree-based models still outperform deep learning on tabular data?": GBDT ≥ deep nets on 45 benchmark datasets in this exact size regime.
- Shwartz-Ziv & Armon, *Information Fusion 2022* — XGBoost / LightGBM the top performer across their 11-dataset comparison.
- Prokhorenkova et al., *NeurIPS 2018* (CatBoost paper) — GBDT dominates on tabular tasks with categorical / ordinal features (matches our 0-5 self-reports).

**Primary model: softmax gradient-boosted trees (K trees per round, one per class)** — the multi-class extension of the XGB-style GBRT already implemented for hormone regression, so we reuse the L2-regularized tree builder (`buildTreeL2` in `regression.functions.ts`) and just wrap it in a softmax loss.

**Baselines shipped alongside for honesty:**
- Random Forest (majority vote) — bagged trees, non-linear, no boosting
- Multinomial Logistic Regression — linear reference; if it wins, feature engineering matters more than model capacity

Selection rule: highest **macro-F1 on validation** wins; the winner's test metrics are the reported number. Class weighting = inverse frequency (handles the Menstrual/Luteal imbalance).

## What gets built

### 1. `src/lib/model/classification.functions.ts` (new server fn)
- `trainPhaseClassification()` — pure TS, runs in the worker
- Steps:
  1. Load `mcphases_daily_features`, reuse Step 1 split & Step 3 train-median imputation
  2. Predictors = all feature keys except `phase`, `participant_id`, `day_in_study`, `sleep_start`, `sleep_end`
  3. Encode `phase` → {0:Menstrual, 1:Follicular, 2:Fertility, 3:Luteal}
  4. Fit three models on train, tune per-model hyperparams on validation, evaluate on held-out test
  5. Return: per-algo metrics, per-class precision/recall/F1, confusion matrix (val + test), top-15 gain-based feature importances, fit time
- Cache winning model in module scope so a follow-up `predictPhase({ features })` fn can serve the Dashboard's PredictorPanel

### 2. `src/features/analytics/PhaseClassification.tsx` (new card)
Same visual style as `HormoneRegression.tsx`:
- Header with "Run training" button + last-run timestamp
- Algorithm comparison table (macro-F1, accuracy, log-loss, fit ms) — winner highlighted
- Per-class table (Menstrual / Follicular / Fertility / Luteal · precision · recall · F1 · support)
- 4×4 confusion-matrix heatmap (test set)
- Top-15 feature importance bar chart (recharts, existing chart tokens)

### 3. Wire into `src/features/analytics/Analytics.tsx`
- Render `<PhaseClassification />` immediately after `<HormoneRegression />` in both the empty-data and populated branches
- Update the `PageHeader` `description` to append: *"Step 5 trains a multi-class phase classifier (softmax GBRT vs Random Forest vs multinomial logistic regression) on all non-hormone-only predictors and reports macro-F1 + confusion matrix on held-out participants."*

### 4. Nothing else changes
- No new tables / migrations (label already in the matview)
- No new predictors on the Dashboard — Step 5 inference from the PredictorPanel is a follow-up once the user confirms the classifier
- No mock data — if the matview is empty, the card shows the same "N/A" empty state as the other steps

## Technical detail

Softmax GBRT (implemented in TS, no new deps):

```text
for round r in 1..T:
  p_ik = softmax(F_ik)                 # class probabilities
  for class k in 0..K-1:
    g_ik = p_ik - y_ik                  # gradient (residual under log-loss)
    tree_rk = buildTreeL2(X, -g_ik, λ)  # reuse existing L2 tree
    F_ik += lr * tree_rk(x_i)
```

Hyperparam grid (validation-tuned): `nTrees ∈ {80,150}`, `maxDepth ∈ {3,5}`, `lr ∈ {0.05,0.1}`, `λ = 1`, `mtry = sqrt(nFeat)` for RF only. Runs in the worker within the existing serverless CPU budget (< 3 s expected at this row count).

Class weights = `n_total / (K · n_k)` applied to gradients so majority classes don't swamp gain calculations.

Metrics computed from scratch (`macroF1`, `accuracy`, `logLoss`, per-class `precision`/`recall`/`F1`, `confusion`), matching the from-scratch style of `regression.functions.ts`.
