import { createFileRoute } from "@tanstack/react-router";
import { Research } from "@/features/research/Research";

export const Route = createFileRoute("/research")({
  head: () => ({ meta: [
    { title: "Research Portal · Cycloscope" },
    { name: "description", content: "Anonymized JSON export, endocrine baselines, and synthetic benchmark cohort." },
  ]}),
  component: Research,
});