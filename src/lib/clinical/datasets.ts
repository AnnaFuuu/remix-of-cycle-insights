import type { DatasetMeta } from "./types";

export const DATASETS: DatasetMeta[] = [
  {
    id: "mcphases",
    name: "mcPHASES",
    sampleSize: 12480,
    subjects: "reproductive-age women, US multi-site",
    modalities: ["self-report", "wearable", "labs"],
    variables: 214,
    provenance: "Consortium of academic clinics, IRB-approved.",
    license: "Restricted-access · DUA required",
    citation: "Chen et al., 2024. Multi-center Cycle Phenotyping and Endocrine Signatures.",
    usedForPretraining: true,
    description:
      "Multi-center panel of longitudinal menstrual phenotyping with paired serum endocrine assays and 90-day wearable telemetry.",
  },
  {
    id: "nhanes",
    name: "NHANES",
    sampleSize: 51893,
    subjects: "US nationally representative, all ages",
    modalities: ["self-report", "labs", "physical exam"],
    variables: 1300,
    provenance: "CDC / NCHS (2013–2020 continuous cycles).",
    license: "Public domain",
    citation: "CDC NHANES public data release, 2013–2020.",
    usedForPretraining: true,
    description:
      "National Health and Nutrition Examination Survey. Used for population endocrine baselines, TSH/prolactin/testosterone reference distributions, and demographic conditioning.",
  },
  {
    id: "ukbb",
    name: "UK Biobank",
    sampleSize: 502543,
    subjects: "UK adults 40–69 at baseline",
    modalities: ["self-report", "labs", "imaging", "genomics", "wearable"],
    variables: 4200,
    provenance: "UK Biobank Ltd., approved research access.",
    license: "Application-based · fee",
    citation: "Sudlow et al., 2015. UK Biobank: an open access resource.",
    usedForPretraining: true,
    description:
      "Deep phenotype cohort used for hormone × cardiometabolic joint modeling and downstream validation of foundation-model embeddings on reproductive endocrine outcomes.",
  },
];