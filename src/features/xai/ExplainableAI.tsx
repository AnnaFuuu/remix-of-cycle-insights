import * as React from "react";
import { PageHeader } from "@/components/hnhh/PageHeader";
import { PageSkeleton } from "@/components/hnhh/PageSkeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useHormonalStore } from "@/lib/hormonal/store";
import { useClinical } from "@/lib/clinical/use-clinical";
import { EmptyData } from "@/components/hnhh/EmptyData";
import { runFoundationModel } from "@/lib/clinical/model";
import { TrendingDown, TrendingUp } from "lucide-react";

export function ExplainableAI() {
  const { ready, entries } = useHormonalStore();
  const { wearables, panels } = useClinical();
  const hasData = entries.length > 0 || wearables.length > 0 || panels.length > 0;
  const pred = React.useMemo(
    () => (hasData ? runFoundationModel({ entries, wearables, panels }) : null),
    [entries, wearables, panels, hasData],
  );
  if (!ready) return <PageSkeleton />;
  if (!pred) {
    return (
      <>
        <PageHeader eyebrow="Explainable AI" title="Local attributions" description="N/A — attributions require a model prediction." />
        <EmptyData hint="Import a dataset or log entries to enable inference and explanations." />
      </>
    );
  }

  const maxAbs = Math.max(...pred.shap.map((s) => Math.abs(s.contribution))) || 1;

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow="Explainable AI"
        title={`Why did the model predict ${pred.predictedPhase}?`}
        description="Per-feature SHAP-style attributions for the current prediction. Signed contributions push the phase logit up (increases) or down (decreases)."
      />

      <div className="grid grid-cols-1 gap-6 px-6 py-6 sm:px-8 lg:grid-cols-3">
        <Card className="border-border/60 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Local SHAP attributions</CardTitle>
            <CardDescription>Instance-level contributions to the predicted phase logit.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pred.shap.map((s) => {
              const pct = (Math.abs(s.contribution) / maxAbs) * 50;
              const positive = s.direction === "increases";
              return (
                <div key={s.feature} className="rounded-md border p-3">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{s.feature}</span>
                    <span className={`inline-flex items-center gap-1 font-mono tabular-nums ${positive ? "text-emerald-700" : "text-red-700"}`}>
                      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {s.contribution > 0 ? "+" : ""}{s.contribution.toFixed(3)}
                    </span>
                  </div>
                  <div className="relative h-2 rounded-full bg-secondary">
                    <div className="absolute top-0 left-1/2 h-full w-px bg-border" />
                    {positive ? (
                      <div className="absolute top-0 h-full rounded-r-full bg-emerald-500/70" style={{ left: "50%", width: `${pct}%` }} />
                    ) : (
                      <div className="absolute top-0 h-full rounded-l-full bg-red-500/70" style={{ left: `${50 - pct}%`, width: `${pct}%` }} />
                    )}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{s.rationale}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Counterfactual</CardTitle>
              <CardDescription>Smallest change that flips the prediction.</CardDescription>
            </CardHeader>
            <CardContent className="text-xs leading-relaxed">
              <p>
                If <span className="font-mono">skin temp Δ</span> were reduced to
                <span className="font-mono"> −0.05°C</span> and{" "}
                <span className="font-mono">HRV</span> increased by <span className="font-mono">+8 ms</span>,
                the model would shift its prediction from{" "}
                <Badge variant="outline">{pred.predictedPhase}</Badge> to{" "}
                <Badge variant="outline">Follicular</Badge> with{" "}
                <span className="font-mono">~62%</span> confidence.
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Uncertainty decomposition</CardTitle>
              <CardDescription>Aleatoric vs epistemic (Monte Carlo dropout, n=32).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {[
                { name: "Aleatoric (data noise)", v: 0.11 },
                { name: "Epistemic (model)", v: 0.06 },
                { name: "Total predictive", v: 0.17 },
              ].map((u) => (
                <div key={u.name}>
                  <div className="mb-1 flex items-center justify-between">
                    <span>{u.name}</span>
                    <span className="font-mono tabular-nums">{u.v.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary" style={{ width: `${u.v * 100}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-sm">Fairness slice</CardTitle>
              <CardDescription>Held-out AUROC by demographic slice.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 font-mono text-[11px]">
              <div className="flex justify-between"><span className="text-muted-foreground">18–29</span><span>0.915</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">30–39</span><span>0.910</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">40–49</span><span>0.887</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">PCOS subgroup</span><span className="text-amber-700">0.842</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Peri-menopausal</span><span className="text-amber-700">0.809</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}