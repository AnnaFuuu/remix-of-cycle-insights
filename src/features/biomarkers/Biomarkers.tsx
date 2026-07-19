import * as React from "react";
import { PageHeader } from "@/components/hnhh/PageHeader";
import { PageSkeleton } from "@/components/hnhh/PageSkeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useHormonalStore } from "@/lib/hormonal/store";
import { useClinical } from "@/lib/clinical/use-clinical";
import { ANALYTE_LABEL, ANALYTE_ORDER, REF_UNITS, refRange } from "@/lib/clinical/reference-ranges";
import type { LabAnalyte } from "@/lib/clinical/types";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceArea } from "recharts";

export function Biomarkers() {
  const { ready } = useHormonalStore();
  const { panels } = useClinical();
  const [analyte, setAnalyte] = React.useState<LabAnalyte>("Estradiol");
  if (!ready) return <PageSkeleton />;

  const data = panels.map((p) => {
    const a = p.assays.find((x) => x.analyte === analyte)!;
    return { date: p.collectedAt, value: a.value, phase: p.phase, low: a.refLow, high: a.refHigh };
  });
  const minY = Math.min(...data.map((d) => Math.min(d.value, d.low))) * 0.8;
  const maxY = Math.max(...data.map((d) => Math.max(d.value, d.high))) * 1.15;

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow="Biomarkers"
        title="Longitudinal endocrine trajectories"
        description="Per-analyte serum trajectories with phase-conditioned reference bands across all collected panels."
      />

      <div className="px-6 py-6 sm:px-8">
        <div className="mb-4 flex flex-wrap gap-1.5">
          {ANALYTE_ORDER.map((a) => (
            <button
              key={a}
              onClick={() => setAnalyte(a)}
              className={`rounded-md border px-2.5 py-1 text-[11px] font-mono transition ${analyte === a ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}
            >
              {a}
            </button>
          ))}
        </div>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">{ANALYTE_LABEL[analyte]} · {REF_UNITS[analyte]}</CardTitle>
            <CardDescription>{panels.length} timepoints · shaded band = phase-conditioned reference range at each collection.</CardDescription>
          </CardHeader>
          <CardContent className="h-[380px] pl-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 30, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                {data.map((d, i) => (
                  <ReferenceArea key={i} x1={i === 0 ? d.date : data[i - 1].date} x2={d.date} y1={d.low} y2={d.high} fill="var(--chart-1)" fillOpacity={0.08} stroke="none" />
                ))}
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                <YAxis domain={[minY, maxY]} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} width={50} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", fontSize: 12 }} />
                <Line dataKey="value" name={ANALYTE_LABEL[analyte]} stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {(["LH", "Estradiol", "Progesterone"] as LabAnalyte[]).map((a) => {
            const latest = panels[panels.length - 1].assays.find((x) => x.analyte === a)!;
            const range = refRange(a, panels[panels.length - 1].phase);
            return (
              <Card key={a} className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{ANALYTE_LABEL[a]}</CardTitle>
                  <CardDescription className="font-mono text-[11px]">
                    latest {latest.value} {REF_UNITS[a]} · ref {range[0]}–{range[1]}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative h-2 rounded-full bg-secondary">
                    <div className="absolute top-0 h-full rounded-full bg-primary/25" style={{ left: `${(range[0] / (range[1] * 1.4)) * 100}%`, width: `${((range[1] - range[0]) / (range[1] * 1.4)) * 100}%` }} />
                    <div className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded bg-foreground" style={{ left: `${Math.min(100, (latest.value / (range[1] * 1.4)) * 100)}%` }} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}