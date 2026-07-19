## 目标

把 hormone regression 的 predictor 从 52 个精简到 11 个，跟 Dashboard 用户实际能输入的字段一一对齐，让模型的输入空间和推理路径完全一致（避免大量字段永远靠 median 补齐带来的噪声）。

## 保留的 11 个 predictor

跟 `UI_TO_FEATURE`（`src/lib/model/predict.functions.ts:16-29`）对齐：

| Feature key | 来源组 | Dashboard 字段 |
|---|---|---|
| `bmi` | Anthropometric | BMI |
| `wrist_temp_overnight_mean` | Wrist temp | Wrist temp Δ |
| `hrv_mean` | HRV | HRV |
| `resp_rate_full` | Respiratory | Resp rate |
| `sleep_score` | Sleep score | Sleep score |
| `sleep_asleep_min` | Sleep | Sleep duration |
| `stress_score` | Stress | Stress score |
| `glucose_mean` | Glucose | Glucose |
| `rhr` | Resting HR | (dashboard 已删，但 sleep_score.overnight RHR 会用到，保留作为纯 wearable 信号) |
| `cramps` | Self-report | Cramps |
| `bloating` | Self-report | Bloating |

> `age` 不在每日特征表里（`mcphases_daily_features` 是 per-day feature），继续留在分类器侧、不进 hormone regressor。
> `lh`, `estrogen`, `pdg`, `phase`, `sleep_start`, `sleep_end` 继续排除（原来的规则）。

如果你希望**去掉 `rhr`**（因为 Dashboard 已经删了 Resting HR 输入），告诉我，我改成 10 个。

## 实施步骤

1. **`src/lib/model/regression.functions.ts`**
   - 新增 `HORMONE_PREDICTORS: string[]` 常量，明确列出上面 11 个 key。
   - 把 `selectPredictors()` 改成返回 `HORMONE_PREDICTORS`（不再从 `FEATURE_DEFS` 里扣除排除项）。
   - 加一句注释说明"这些字段跟 Dashboard 的 `PredictorInput` 对齐，保证训练输入 = 推理输入"。

2. **重新训练并持久化**
   - 结构变了，之前存在 `mcphases_trained_models` 里 `kind='hormone_regressor:lh' / :estrogen'` 的 artifact 就废了（predictor 数不同、tree 里 feature index 不同）。
   - 需要在 Analytics → Step 4 再点一次 "Train hormone regression"，会 upsert 覆盖旧行。
   - `predictHormonesFromFeatureRow` 从 Postgres 读的时候，会拿到新的 `predictors` 数组，所以推理侧自动匹配，不用改代码。

3. **可选（不改）**：Dashboard 的 `predictPhase` 逻辑不动 —— 它现在的行为已经是「LH/E2 缺失 → 调 hormone regressor」，只要 regressor 用的字段是 Dashboard 输入的子集，就能全部命中，不再走 median。

## 影响

- **好处**：模型透明度更高（52 → 11），推理时几乎不再需要 median fallback；训练也更快。
- **代价**：R²/MAE 可能会有轻微退步（丢掉 HRV 频域、sleep 分期、glucose variability 等信号），但预测的可复现性更强 —— 用户输入什么，模型就用什么。
- **不影响**：分类器 (Step 5) 用的是自己的 predictor 集合，本次不改。如果之后你也想把分类器精简到 Dashboard 对齐，那是单独一步。

## 待确认

`rhr` 保留还是去掉？（Dashboard 已经删了 Resting HR 输入，如果保留，推理时 `rhr` 永远会被 median 补齐 —— 那还不如去掉，只留 10 个。）