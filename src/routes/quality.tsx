import { createFileRoute, redirect } from "@tanstack/react-router";
import { DataQuality } from "@/features/quality/DataQuality";
import { isResearcherSync } from "@/lib/researcher-mode";

export const Route = createFileRoute("/quality")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !isResearcherSync()) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({ meta: [
    { title: "Data for training models · Cycloscope" },
    { name: "description", content: "Stream integrity, completeness, and drift diagnostics." },
  ]}),
  component: DataQuality,
});
