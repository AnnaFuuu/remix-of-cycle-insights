import { createFileRoute } from "@tanstack/react-router";
import { FoundationModel } from "@/features/model/FoundationModel";

export const Route = createFileRoute("/model")({
  head: () => ({ meta: [
    { title: "Foundation Model · Cycloscope" },
    { name: "description", content: "Phase prediction, hormone forecast, and feature importance." },
  ]}),
  component: FoundationModel,
});