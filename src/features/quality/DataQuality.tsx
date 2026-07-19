import * as React from "react";
import { PageHeader } from "@/components/hnhh/PageHeader";
import { PageSkeleton } from "@/components/hnhh/PageSkeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useHormonalStore } from "@/lib/hormonal/store";
import { useClinical } from "@/lib/clinical/use-clinical";
import { buildQualityReport } from "@/lib/clinical/quality";
import { SleepDatasetsPanel } from "@/components/physionet/SleepDatasetsPanel";

export function DataQuality() {
  const { ready, entries } = useHormonalStore();
  const { wearables, panels } = useClinical();
  const report = React.useMemo(() => buildQualityReport(entries, wearables, panels), [entries, wearables, panels]);
  if (!ready) return <PageSkeleton />;

  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const rows = report.heatmap.slice(-30);
  const streams = ["hrv", "rhr", "skinTemp", "sleep", "symptoms", "bbt"] as const;

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow="Data quality"
        title="Stream integrity & completeness"
        description="Per-stream completeness, outlier counts, sensor uptime, and drift diagnostics across the last 30 days."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="rounded-full font-mono text-[10px]">overall {pct(report.overallCompleteness)}</Badge>
            <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 font-mono text-[10px] text-amber-700">drift {pct(report.driftScore)}</Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 px-6 py-6 sm:px-8 lg:grid-cols-3">
        <Card className="border-border/60 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Stream summary</CardTitle>
            <CardDescription>Per-stream completeness and quality signal.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-secondary/60 text-muted-foreground">
                  <tr className="text-left">
                    <th className="p-2">Stream</th>
                    <th className="p-2 text-right">Completeness</th>
                    <th className="p-2 text-right">Missing</th>
                    <th className="p-2 text-right">Outliers</th>
                    <th className="p-2 text-right">Uptime (d)</th>
                    <th className="p-2">Last sample</th>
                  </tr>
                </thead>
                <tbody>
                  {report.streams.map((s) => (
                    <tr key={s.stream} className="border-t">
                      <td className="p-2">{s.stream}</td>
                      <td className="p-2 text-right">
                        <div className="ml-auto flex items-center justify-end gap-2">
                          <span className="font-mono tabular-nums">{pct(s.completeness)}</span>
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
                            <div className="h-full bg-primary" style={{ width: pct(s.completeness) }} />
                          </div>
                        </div>
                      </td>
                      <td className="p-2 text-right font-mono tabular-nums">{s.missing}</td>
                      <td className="p-2 text-right font-mono tabular-nums">{s.outliers}</td>
                      <td className="p-2 text-right font-mono tabular-nums">{s.uptimeDays}</td>
                      <td className="p-2 font-mono text-[10px] text-muted-foreground">{s.lastSample}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm">Drift diagnostics</CardTitle>
            <CardDescription>Population-shift score (0 = stable · 1 = severe shift).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { name: "Wearable HRV", v: 0.05 },
              { name: "Sleep architecture", v: 0.12 },
              { name: "Symptom distribution", v: 0.09 },
              { name: "Endocrine assays", v: 0.03 },
            ].map((d) => (
              <div key={d.name}>
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span>{d.name}</span>
                  <span className="font-mono tabular-nums">{d.v.toFixed(2)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className={`h-full ${d.v > 0.2 ? "bg-red-500" : d.v > 0.1 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${d.v * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60 lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm">Missingness heatmap · last 30 days</CardTitle>
            <CardDescription>Dark = sample present · light = missing.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="text-[10px]">
                <thead>
                  <tr>
                    <th className="p-1 text-left font-medium text-muted-foreground">Stream / date</th>
                    {rows.map((r) => (
                      <th key={r.date} className="p-0.5 font-mono text-[9px] text-muted-foreground">{r.date.slice(8)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {streams.map((s) => (
                    <tr key={s}>
                      <td className="p-1 pr-2 font-mono text-muted-foreground">{s}</td>
                      {rows.map((r) => (
                        <td key={r.date} className="p-0.5">
                          <div className={`h-4 w-4 rounded-sm ${r.streams[s] ? "bg-primary" : "bg-secondary"}`} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="px-6 sm:px-8">
        <SleepDatasetsPanel variant="quality" />
      </div>
    </div>
  );
}