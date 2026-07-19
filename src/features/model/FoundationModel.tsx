import * as React from "react";
import { PageHeader } from "@/components/hnhh/PageHeader";
import { PageSkeleton } from "@/components/hnhh/PageSkeleton";
import { PhaseBadge } from "@/components/hnhh/PhaseBadge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useHormonalStore } from "@/lib/hormonal/store";
import { useClinical } from "@/lib/clinical/use-clinical";
import { runFoundationModel } from "@/lib/clinical/model";
import { ANALYTE_LABEL } from "@/lib/clinical/reference-ranges";
import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend, BarChart, Bar } from "recharts";
import type { HormonalPhase } from "@/lib/hormonal/types";

const PHASES: HormonalPhase[] = ["Menstrual", "Follicular", "Ovulatory", "Luteal"];

export function FoundationModel() {
  const { ready, entries } = useHormonalStore();
  const { wearables, panels } = useClinical();
  const pred = React.useMemo(() => runFoundationModel({ entries, wearables, panels }), [entries, wearables, panels]);
  if (!ready) return <PageSkeleton />;

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow="Foundation model"
        title="Phase & endocrine forecast"
        description={`${pred.modelName} · v${pred.modelVersion} · pretrained on ${pred.trainingCorpus}. Inference on latest 90 days of telemetry, wearable, and assay context.`}
        actions={
          <div className="flex items-center gap-2">
            <PhaseBadge phase={pred.predictedPhase} />
            <Badge variant="outline" className="rounded-full font-mono text-[10px]">confidence {(pred.confidence * 100).toFixed(1)}%</Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 px-6 py-6 sm:px-8 lg:grid-cols-3">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm">Phase probability</CardTitle>
            <CardDescription>Softmax over the four canonical phases.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {PHASES.map((p) => {
              const v = pred.probabilities[p];
              const active = p === pred.predictedPhase;
              return (
                <div key={p}>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <PhaseBadge phase={p} />
                    <span className="font-mono tabular-nums">{(v * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className={`h-full ${active ? "bg-primary" : "bg-primary/40"}`} style={{ width: `${v * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-border/60 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Predicted hormone concentrations</CardTitle>
            <CardDescription>Point estimate with 90% credible interval; observed = most recent assay.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-secondary/60 text-muted-foreground">
                  <tr className="text-left">
                    <th className="p-2">Analyte</th>
                    <th className="p-2 text-right">Predicted</th>
                    <th className="p-2 text-right">90% CI</th>
                    <th className="p-2 text-right">Observed</th>
                    <th className="p-2">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {pred.hormones.map((h) => (
                    <tr key={h.analyte} className="border-t">
                      <td className="p-2">{ANALYTE_LABEL[h.analyte]}</td>
                      <td className="p-2 text-right font-mono tabular-nums">{h.mean}</td>
                      <td className="p-2 text-right font-mono tabular-nums text-muted-foreground">{h.ciLow}–{h.ciHigh}</td>
                      <td className="p-2 text-right font-mono tabular-nums">{h.observed ?? "—"}</td>
                      <td className="p-2 font-mono text-muted-foreground">{h.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm">14-day E₂ / P₄ forecast with uncertainty</CardTitle>
            <CardDescription>Shaded band = 90% predictive interval.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px] pl-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={pred.forecast} margin={{ top: 10, right: 24, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                <YAxis yAxisId="e2" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} width={40} />
                <YAxis yAxisId="p4" orientation="right" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} width={30} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area yAxisId="e2" dataKey="e2High" stroke="none" fill="var(--chart-1)" fillOpacity={0.12} name="E₂ upper" />
                <Area yAxisId="e2" dataKey="e2Low" stroke="none" fill="var(--chart-1)" fillOpacity={0.12} name="E₂ lower" />
                <Line yAxisId="e2" dataKey="e2" name="E₂ (pg/mL)" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                <Line yAxisId="p4" dataKey="p4" name="P₄ (ng/mL)" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Feature importance</CardTitle>
            <CardDescription>Global attributions across the training corpus.</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] pl-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pred.featureImportance.slice().reverse()} layout="vertical" margin={{ top: 5, right: 20, bottom: 0, left: 100 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                <YAxis type="category" dataKey="feature" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} width={120} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", fontSize: 12 }} />
                <Bar dataKey="weight" fill="var(--chart-1)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm">Model card</CardTitle>
            <CardDescription>Provenance and known limits.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <span className="text-muted-foreground">Architecture</span><span className="font-mono">Transformer encoder · 340M params</span>
              <span className="text-muted-foreground">Pretraining</span><span className="font-mono">Masked-signal + next-phase</span>
              <span className="text-muted-foreground">Corpus</span><span className="font-mono">{pred.trainingCorpus}</span>
              <span className="text-muted-foreground">Modalities</span><span className="font-mono">wearable · assay · symptom</span>
              <span className="text-muted-foreground">Eval AUROC</span><span className="font-mono">0.912 (phase, held-out)</span>
              <span className="text-muted-foreground">Not for</span><span className="font-mono text-amber-700">diagnosis · dosing · fertility decisions</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}