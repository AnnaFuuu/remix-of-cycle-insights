import { createFileRoute } from "@tanstack/react-router";
import { DataQuality } from "@/features/quality/DataQuality";

export const Route = createFileRoute("/quality")({
  head: () => ({ meta: [
    { title: "Data Quality · Cycloscope" },
    { name: "description", content: "Stream integrity, completeness, and drift diagnostics." },
  ]}),
  component: DataQuality,
});