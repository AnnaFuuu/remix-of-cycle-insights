import { createFileRoute } from "@tanstack/react-router";
import { Laboratory } from "@/features/labs/Laboratory";

export const Route = createFileRoute("/labs")({
  head: () => ({ meta: [
    { title: "Laboratory · Cycloscope" },
    { name: "description", content: "Endocrine assay panels with phase-conditioned reference ranges." },
  ]}),
  component: Laboratory,
});