import { createFileRoute, redirect } from "@tanstack/react-router";
import { Analytics } from "@/features/analytics/Analytics";
import { isResearcherSync } from "@/lib/researcher-mode";

export const Route = createFileRoute("/analytics")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !isResearcherSync()) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({ meta: [
    { title: "Analytics · Cycloscope" },
    { name: "description", content: "Longitudinal hormonal analytics with rolling averages and phase comparisons." },
  ]}),
  component: Analytics,
});
