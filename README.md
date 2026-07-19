# CycloPredict · Menstrual Cycle Prediction Platform

An AI-powered multimodal platform for menstrual cycle prediction based on real-world physiological data. CycloPredict integrates the **mcPHASES/PhysioNet** dataset and leverages wearable signals—including sleep, heart rate variability (HRV), wrist temperature, BMI, stress, and optional laboratory hormone measurements (e.g., LH and estradiol)—to predict menstrual cycle phases using machine learning.

---

# Core Features

## Personal Data Management

- **Wearable Health Data**
  - Record daily physiological metrics including:
    - BMI
    - Wrist temperature change
    - Heart rate variability (HRV)
    - Respiratory rate
    - Sleep score & duration
    - Stress score
    - Blood glucose
    - Resting heart rate (RHR)
    - Cramps
    - Bloating
    - And more

- **Laboratory Results**
  - Users can manually enter or upload laboratory reports (e.g., hormone tests).
  - AI automatically extracts biomarkers while securely encrypting sensitive health information.

- **Prediction History**
  - Stores previous prediction results for long-term monitoring and comparison.

---

## Model Training

- **Training Dataset Dashboard**
  - Visualize dataset quality, feature coverage, and participant distributions.

- **Machine Learning Pipeline**
  - Train / Validation / Test Split
  - Feature Engineering
  - Data Preprocessing
  - Hormone Regression
  - Menstrual Phase Classification
  - Advanced Model Benchmarking

- Supports:
  - 5-fold Cross Validation
  - Model Persistence
  - Reproducible Training

---

## Prediction Dashboard

- End users only need to provide a small number of wearable health metrics to predict their current menstrual phase using pretrained models.

- **Researcher Mode** unlocks the complete model training interface, while regular users only have access to prediction features.

---

# Technology Stack

| Component          | Technology                            |
| ------------------ | ------------------------------------- |
| Framework          | TanStack Start v1 + React 19 + Vite 7 |
| UI                 | Tailwind CSS v4 + shadcn/ui           |
| Backend & Database | Lovable Cloud (PostgreSQL)            |
| State Management   | Zustand + TanStack Query              |
| Charts             | Recharts                              |
| Deployment         | Lovable Cloud / Edge Workers          |

---

# Data & Machine Learning Pipeline

```text
Raw CSV Files (mcPHASES / PhysioNet)
            │
            ▼
Participant-level Data Integration
            │
            ▼
Data Quality & Coverage Assessment
            │
            ▼
Train / Validation / Test Split
(Stratified by participant, 60 / 20 / 20)
            │
            ▼
Feature Engineering
• BMI
• Wrist Temperature Change
• HRV
• Respiratory Rate
• Sleep Score
• Sleep Duration
• Stress Score
• Blood Glucose
• Resting Heart Rate
• Cramps
• Bloating
            │
            ▼
KNN Imputation
(Median Fallback)
            │
            ▼
Hormone Regression
(Predict LH / Estradiol when unavailable)
            │
            ▼
Menstrual Phase Classification
GBRT / Random Forest / Logistic Regression
            │
            ▼
Advanced Benchmark Models
• Ridge
• Softmax GBRT
• Small MLP
• Mixture-of-Experts (MoE)
• HMM Smoothing
```

---

# Model Performance

Evaluation was performed on **42 participants** using **participant-level 5-fold cross-validation** and an independent held-out test set.

| Model                            | CV Accuracy | CV Macro-F1 | Notes                                                    |
| -------------------------------- | ----------: | ----------: | -------------------------------------------------------- |
| Ridge (Linear Baseline)          |       0.385 |       0.319 | Fastest and most stable                                  |
| Softmax GBRT (Enriched Features) |       0.358 |   **0.334** | Rolling statistics + z-score features                    |
| Small MLP (1×32)                 |       0.338 |       0.328 | Reasonable generalization                                |
| MoE GBRT                         |       0.342 |       0.308 | K-Means phenotype clustering did not improve performance |

> **Current dataset size is the primary bottleneck.** The **Luteal** phase achieved the best performance (F1 ≈ 0.48), while the **Fertility Window** remains the most difficult phase due to its short duration and large inter-individual variability.

---

# Privacy & Security

- Laboratory reports and other personally identifiable information (PII) are encrypted using **AES-256-GCM**.
- Research datasets are protected with **Row-Level Security (RLS)**.
- Model training features are hidden behind **Researcher Mode** to prevent accidental access by general users.

---

# Local Development

```bash
# Install dependencies
bun install

# Start development server
bun dev
```

> CycloPredict uses **Lovable Cloud** as its backend. Proper environment variables are required to connect to the database and authentication services during local development.

---

# Datasets

- **mcPHASES** — Chen et al. (2024). _Multi-center Cycle Phenotyping and Endocrine Signatures._
- **NHANES** — Centers for Disease Control and Prevention (CDC), 2013–2020.
- **UK Biobank** — Sudlow et al. (2015).

---

# License

The source code is released under a standard open-source license. Dataset usage is subject to the licensing terms of their respective providers.
