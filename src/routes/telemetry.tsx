import { createFileRoute } from "@tanstack/react-router";
import { TelemetryLog } from "@/features/telemetry/TelemetryLog";

export const Route = createFileRoute("/telemetry")({
  head: () => ({ meta: [
    { title: "Telemetry Log · Cycloscope" },
    { name: "description", content: "Structured daily hormonal telemetry logging with full CRUD." },
  ]}),
  component: TelemetryLog,
});