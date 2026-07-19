## 问题
`mcphases_daily_features.wrist_temp_overnight_mean` 5,659 行全是 NULL。

**根因**：ingest 脚本把 overnight 均值写入了 `mcphases_wrist_temperature.temperature_diff_from_baseline`（数据在，样例 0.17 / 0.01 / -0.14 °C），但物化视图从 `raw->>'overnight_mean'` 取值，那个 JSONB 字段从未被写入 → 聚合结果全空。

同时 Dashboard 里的 "Overnight wrist temperature (difference from baseline)" 语义正好就是这一列，所以直接把视图接到 `temperature_diff_from_baseline` 即可，无需回填 `raw`。

## 修复
新建一个 migration，`CREATE OR REPLACE` 物化视图（也可 DROP + CREATE，保留 `refresh_mcphases_daily_features()` 函数），只改 `wrist_temp_daily` CTE：

```sql
wrist_temp_daily AS (
  SELECT participant_id,
         day_in_study,
         avg(temperature_diff_from_baseline) AS wrist_temp_overnight_mean,
         count(*) AS wrist_temp_samples
  FROM mcphases_wrist_temperature
  WHERE day_in_study IS NOT NULL
    AND temperature_diff_from_baseline IS NOT NULL
  GROUP BY participant_id, day_in_study
)
```

外层 SELECT 去掉 `wt.wrist_temp_daily_mean`（冗余），保留 `wt.wrist_temp_overnight_mean` 与 `wt.wrist_temp_samples`。其余 CTE 不动。

之后调用 `SELECT public.refresh_mcphases_daily_features();` 刷新，`wrist_temp_overnight_mean` 与 `wrist_temp_samples` 会在 42 名参与者、~5,128 天里出现真实值，Analytics 里 Preprocessing / imputation 图表也会同步显示。

## 验证
- `SELECT COUNT(wrist_temp_overnight_mean), AVG(wrist_temp_overnight_mean) FROM mcphases_daily_features;` 非零。
- Analytics 页面 wrist_temp_overnight_mean 一列不再是空白。

## 影响面
- 只改物化视图；表结构、前端代码不动。
- 若前端有代码读 `wrist_temp_daily_mean`，一起换成 `wrist_temp_overnight_mean`（构建时如报错再处理）。