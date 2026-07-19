import { createFileRoute } from "@tanstack/react-router";
import { Biomarkers } from "@/features/biomarkers/Biomarkers";

export const Route = createFileRoute("/biomarkers")({
  head: () => ({ meta: [
    { title: "Biomarkers · Cycloscope" },
    { name: "description", content: "Longitudinal endocrine biomarker trajectories with reference bands." },
  ]}),
  component: Biomarkers,
});