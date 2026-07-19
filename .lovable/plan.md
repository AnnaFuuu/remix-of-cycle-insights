
## 理解确认

你的需求我听懂了，总结一下：

1. **前端**：Dashboard 加一个"Predictive Variables"输入面板，13 个字段。
2. **N/A 规则**：除了 Age 必填，其余 12 个都可填 N/A。
3. **两阶段预测逻辑**：
   - 如果 LH 和 Estradiol 有值 → 直接分类 menstrual phase。
   - 如果 LH 和/或 Estradiol 为 N/A → 先用其他变量跑回归模型 impute 出 LH / E2，再拼所有变量做 phase classification。
4. 训练数据来自数据库里 mcPHASES 的专业测量值。

---

## 本次交付范围（第一步：前端窗口）

只做 UI 输入面板 + 本地状态，**不接模型**。模型训练/推理放在后续 step。

### 变量清单与输入控件

| # | Variable | Unit | Control | N/A |
|---|---|---|---|---|
| 1 | Age | years | number | ❌ 必填 |
| 2 | BMI | kg/m² | number | ✅ |
| 3 | Cycle day | 1–35 | number | ✅ |
| 4 | LH | mIU/mL | number | ✅ (触发 impute) |
| 5 | Estradiol | pg/mL | number | ✅ (触发 impute) |
| 6 | Resting HR | bpm | number | ✅ |
| 7 | HRV (RMSSD) | ms | number | ✅ |
| 8 | Wrist temperature Δ | °C | number | ✅ |
| 9 | Respiratory rate | breaths/min | number | ✅ |
| 10 | Sleep score | 0–100 | number | ✅ |
| 11 | Sleep duration | hours | number | ✅ |
| 12 | Stress score | 0–100 | number | ✅ |
| 13 | Activity level | sedentary / light / moderate / vigorous | select | ✅ |

每个数值输入右侧带一个 "N/A" 复选框；勾上就 disable 输入框并把值置为 `null`。

### 文件改动

- **新增** `src/features/dashboard/PredictorPanel.tsx`
  - 卡片标题："Predictive variables"，副标题说明规则（LH/E₂ 缺失会走 imputation → phase classification 两步）。
  - 3 列 grid（响应式 → mobile 1 列）分成三组视觉分区：
    - Demographics: Age, BMI, Cycle day
    - Endocrine (clinical): LH, Estradiol — 用浅底色标注 "clinical assay, optional"
    - Wearable + subjective: RHR, HRV, Wrist temp Δ, Resp rate, Sleep score, Sleep duration, Stress score, Activity level
  - 底部两个按钮：`Predict phase`（disabled 直到 Age 有值）+ `Reset`。
  - 结果区域先放占位卡片："Model not yet wired — inputs captured. Two-stage pipeline (impute → classify) will run here."
  - 显示当前 payload JSON preview（折叠 `<details>`），方便你确认输入是否正确。

- **新增** `src/lib/prediction/types.ts`
  - `PredictorInput` interface（13 字段，可空的用 `number | null`）。
  - `ActivityLevel` union。
  - `PredictionResult` 占位 interface（`phase`, `confidence`, `probabilities`, `imputed: { lh?, estradiol? }`）。

- **修改** `src/features/dashboard/Dashboard.tsx`
  - 在 `PageHeader` 下方、`ProactiveInsights` 上方插入 `<PredictorPanel />`。
  - 其他部分不动。

- **修改** `src/lib/i18n.tsx`
  - 新增 `predictor.*` key（面板标题、13 个变量 label、N/A、Predict、Reset、说明文案），五种语言全补。

### 不做的事

- 不训练模型、不调用后端、不改数据库。
- 不动 Foundation Model / XAI 页面（那两页现有的 mock 保留，之后 step 会替换）。
- 不做输入校验的复杂 UX（超出合理范围只给 hint，不阻止提交）。

---

## 后续 step 预告（不在本次交付）

- **Step 2**：服务端 `train.functions.ts`，用 mcPHASES 数据训练 (a) LH 回归、(b) E₂ 回归、(c) phase 多分类。产物存 JSON 系数。
- **Step 3**：`predict.functions.ts` 接 PredictorPanel，实现两阶段推理，返回 imputed 值 + phase 概率。
- **Step 4**：PredictorPanel 结果区替换成真实预测卡（phase badge、置信度、imputed hormone 值高亮）。

第一步 OK 的话回复 "go"，我就实现 PredictorPanel。
