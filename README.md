# CycloPredict · 月经周期预测平台

基于多模态真实生理数据的女性月经周期预测平台。整合 mcPHASES/PhysioNet 数据，以睡眠、HRV、腕温、BMI、压力等可穿戴指标及可选实验室激素（LH、雌激素）为预测变量，通过机器学习实现周期阶段分类预测。

---

## 核心功能

- **个人数据管理（Personal data）**
  - 日常可穿戴指标录入：BMI、腕温变化、HRV、呼吸率、睡眠评分/时长、压力评分、血糖、RHR、 cramps、bloating 等
  - 实验室检查日历（Laboratory）：用户可手动输入或上传体检/激素报告，支持 AI 自动提取并隐私加密存储
  - 预测历史（Prediction History）：保存每次预测结果，便于长期追踪与对比

- **模型训练后台（Model training）**
  - 数据质量看板（Data for training models）
  - 训练流程：Train/Val/Test 划分 → 特征工程 → 预处理 → 激素回归 → 阶段分类 → 高级方法 Benchmark
  - 支持 5 折交叉验证与模型持久化

- **Dashboard 预测**
  - 普通用户只需在 Dashboard 输入少量字段，即可调用已训练模型预测当前周期阶段
  - 研究者模式（Researcher Mode）开启后才显示模型训练入口，日常用户不可见

---

## 技术栈

- **框架**：TanStack Start v1 + React 19 + Vite 7
- **样式**：Tailwind CSS v4 + shadcn/ui
- **后端 / 数据库**：Lovable Cloud（Postgres）
- **状态管理**：Zustand + TanStack Query
- **图表**：Recharts
- **部署**：Lovable Cloud / Edge Worker

---

## 数据与模型流程

```
原始 CSV（mcPHASES / PhysioNet）
    ↓ 按 participant_id 关联
数据质量 / 覆盖度检查
    ↓
训练/验证/测试划分（按受试者分层，60/20/20）
    ↓
特征工程：BMI、腕温 Δ、HRV、呼吸率、睡眠评分、睡眠时长、
         压力评分、血糖、RHR、cramps、bloating 等 11 维输入
    ↓
KNN 插补（中位数 fallback）
    ↓
激素回归（Hormone Regression）→ 当 LH/E2 缺失时作为 fallback
    ↓
阶段分类（Phase Classification）：GBRT / Random Forest / Logistic Regression
    ↓
高级方法 Benchmark：Ridge、Softmax GBRT、MLP、MoE、HMM 平滑
```

---

## 模型效果摘要

在 42 名受试者、按 participant 分层的 5 折 CV + held-out test 上：

| 方法 | CV Acc | CV Macro-F1 | 说明 |
|---|---|---|---|
| Ridge（线性基线） | 0.385 | 0.319 | 最快，表现稳健 |
| Softmax GBRT（enriched） | 0.358 | **0.334** | 加入 rolling + z-score 特征 |
| Small MLP (1×32) | 0.338 | 0.328 | 泛化尚可 |
| MoE GBRT | 0.342 | 0.308 | K-Means phenotype 分群暂未带来提升 |

> 当前样本量是主要瓶颈。Luteal 阶段预测最好（F1 ~0.48），Fertility 窗口最窄、个体差异最大，预测难度最高。

---

## 隐私与安全

- 体检报告等 PII 使用 AES-256-GCM 服务端加密
- 研究相关数据表启用 RLS，仅项目所有者/授权用户可访问
- 研究者模式隐藏模型训练入口，避免普通用户误操作

---

## 本地开发

```bash
# 安装依赖
bun install

# 启动开发服务器
bun dev
```

> 项目使用 Lovable Cloud 作为后端。本地开发时需要正确的环境变量才能连接数据库与认证服务。

---

## 数据引用

- **mcPHASES**：Chen et al., 2024. Multi-center Cycle Phenotyping and Endocrine Signatures.
- **NHANES**：CDC / NCHS, 2013–2020.
- **UK Biobank**：Sudlow et al., 2015.

---

## 许可证

本项目代码遵循标准开源协议，数据使用受各原始数据集许可条款约束。
