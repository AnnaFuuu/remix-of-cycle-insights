import { createFileRoute } from "@tanstack/react-router";
import { ExplainableAI } from "@/features/xai/ExplainableAI";

export const Route = createFileRoute("/xai")({
  head: () => ({ meta: [
    { title: "Explainable AI · Cycloscope" },
    { name: "description", content: "SHAP-style attributions and counterfactuals for the current prediction." },
  ]}),
  component: ExplainableAI,
});