import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "@/features/settings/Settings";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [
    { title: "Settings · Cycloscope" },
    { name: "description", content: "Preferences, privacy controls, and data management." },
  ]}),
  component: Settings,
});