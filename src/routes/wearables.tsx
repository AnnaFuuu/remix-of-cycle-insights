import { createFileRoute } from "@tanstack/react-router";
import { Wearables } from "@/features/wearables/Wearables";

export const Route = createFileRoute("/wearables")({
  head: () => ({ meta: [
    { title: "Wearable Signals · Cycloscope" },
    { name: "description", content: "Continuous physiological telemetry from wearable sensors." },
  ]}),
  component: Wearables,
});