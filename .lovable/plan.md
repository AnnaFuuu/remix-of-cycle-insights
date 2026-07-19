## Goal

把你上传的 PhysioNet 睡眠 CSV 存进 Lovable Cloud (Postgres)，只在 **Data Quality** 和 **Research Portal** 两个页面里展示，不影响 Wearables / Dashboard 等 synthetic 数据流。

## Steps

1. **启用 Lovable Cloud**（一次性）
   - 调用 `supabase--enable`，得到 Postgres + Data API。

2. **建表 + 权限**（migration）
   ```
   physionet_datasets(id, slug, name, source_url, description, uploaded_at, row_count)
   physionet_sleep_records(
     id, dataset_id, subject_id, recording_date,
     total_sleep_min, deep_min, light_min, rem_min, awake_min,
     sleep_efficiency, latency_min, waso_min, quality_score,
     raw jsonb
   )
   ```
   - RLS: 公开只读（`GRANT SELECT TO anon, authenticated`），写入走 service_role。
   - 索引：`(dataset_id, subject_id)`、`(recording_date)`。

3. **CSV 上传 UI**（Research Portal 新增 "Real datasets" 区块）
   - 一个 shadcn `Input type="file"` + "Import" 按钮。
   - 客户端用 PapaParse 解析 header，做列名自动映射（PhysioNet 常见列：`subject`, `night`, `TST`, `SE`, `SOL`, `WASO`, `N1/N2/N3`, `REM` 等）。有映射不明的列弹一个小 mapper 让你手动对齐。
   - 解析后 POST 到 `saveSleepRecords` server function → 分批 upsert (500 行/批)。

4. **Server function**
   - `src/lib/physionet/sleep.functions.ts`
     - `listDatasets()` — 返回数据集卡片列表。
     - `importSleepCsv({ datasetMeta, rows })` — 创建 dataset 行 + 批量插入 records，用 handler 内 `await import` 拿 `supabaseAdmin`。
     - `getSleepSummary(datasetId)` — 返回聚合：n subjects、n nights、mean TST/SE/deep%/REM%、缺失率、日期范围。
     - `getSleepQualityDistribution(datasetId)` — 直方图数据（quality_score bins）+ 按 subject 的 boxplot 数据。

5. **Data Quality 页面**（新增 section "External datasets · PhysioNet"）
   - 每个 dataset 一张 Card：completeness per column、missingness heatmap（subject × night）、outlier count（TST < 3h / > 12h、SE < 40%）、date coverage。
   - 复用现有 `DataQualityReport` 视觉语言。

6. **Research Portal 页面**（Datasets 区块扩展）
   - 在 mcPHASES / NHANES / UKBB 卡片旁边加真实的 PhysioNet 卡片：sample size、subjects、modalities、变量数、provenance（来自 upload metadata）、citation 输入框。
   - 一个 "Sleep quality distribution" 小图（bar + box）用真实数据渲染，明确 badge："Real data · PhysioNet"。

7. **i18n**
   - 5 种语言加 keys：`physionet.upload`, `physionet.mapping`, `physionet.realBadge`, `physionet.summary.*` 等。

## Technical notes

- **不动** `src/lib/clinical/seed-clinical.ts` 与 Wearables/Foundation Model 页；PhysioNet 数据是独立表 + 独立 UI 分区。
- 上传走 server function（不用 `/api/public/*`，因为只你自己/评审用；后续要开放再加 auth）。
- CSV 大文件（>5MB）用分批 upsert；给一个 progress bar。
- 保留 `raw jsonb` 字段方便以后接别的 PhysioNet 表（如 EEG features）不用改 schema。
- Data Quality 里的 real vs synthetic 用不同 badge 颜色区分。

## Out of scope

- EDF 原始信号解析（这次只处理你已经导出的 CSV summary）。
- 用 PhysioNet 数据重新训练 Foundation Model —— 目前只做展示 + 质量报告。
- 用户账号系统（现在所有人共享 dataset）。

## Open question

你手上的 CSV 具体是 PhysioNet 哪个 dataset？（Sleep-EDF / SHHS / CAP / MESA / 其它？）不同 dataset 的列命名差别很大，我可以针对性内置一个 mapping preset 而不是每次都手动映射。如果不确定，把 CSV 前几行贴出来或直接上传，我在 build 阶段读一下 header 就行。
