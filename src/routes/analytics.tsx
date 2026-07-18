import { createFileRoute } from "@tanstack/react-router";
import { Analytics } from "@/features/analytics/Analytics";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [
    { title: "Analytics · Cycloscope" },
    { name: "description", content: "Longitudinal hormonal analytics with rolling averages and phase comparisons." },
  ]}),
  component: Analytics,
});