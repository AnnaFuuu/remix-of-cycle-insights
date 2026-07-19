import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getDailyFeatures, refreshDailyFeatures, type FeatureDef } from "@/lib/model/features.functions";
import { RefreshCw, Database, Layers, Table as TableIcon } from "lucide-react";

export function FeatureEngineering() {
  const qc = useQueryClient();
  const fn = useServerFn(getDailyFeatures);
  const refresh = useServerFn(refreshDailyFeatures);
  const q = useQuery({ queryKey: ["mcphases", "features"], queryFn: () => fn(), refetchOnWindowFocus: false });
  const m = useMutation({
    mutationFn: () => refresh(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mcphases", "features"] }),
  });

  const groups = React.useMemo(() => {
    const defs = q.data?.definitions ?? [];
    const coverage = new Map(q.data?.coverage.map((c) => [c.key, c]) ?? []);
    const g = new Map<FeatureDef["group"], { def: FeatureDef; nonNull: number; completeness: number }[]>();
    for (const d of defs) {
      const c = coverage.get(d.key);
      const arr = g.get(d.group) ?? [];
      arr.push({ def: d, nonNull: c?.nonNull ?? 0, completeness: c?.completeness ?? 0 });
      g.set(d.group, arr);
    }
    return Array.from(g.entries());
  }, [q.data]);

  return (
    <div className="space-y-4 px-6 sm:px-8">
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Step 2 · Feature engineering</div>
            <CardTitle className="mt-1 text-base font-semibold tracking-tight">Daily features · one row per participant per study day</CardTitle>
            <CardDescription className="text-xs">
              Wearable time-series (HRV, sleep, sleep-score, RHR, respiratory rate, wrist temperature, stress, glucose) aggregated per (participant_id, day_in_study) and joined with self-reported hormones and anthropometrics. This merged frame feeds both the hormone regression and the phase classifier.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => m.mutate()} disabled={m.isPending || q.isFetching}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${m.isPending ? "animate-spin" : ""}`} /> Rebuild
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={<TableIcon className="h-3.5 w-3.5" />} label="Rows (participant-days)" value={q.data ? q.data.totalRows.toLocaleString() : "—"} />
            <Stat icon={<Database className="h-3.5 w-3.5" />} label="Participants" value={q.data ? q.data.totalParticipants.toString() : "—"} />
            <Stat icon={<Layers className="h-3.5 w-3.5" />} label="Study-day range" value={q.data && q.data.dayMin != null ? `${q.data.dayMin}–${q.data.dayMax}` : "—"} />
            <Stat icon={<Layers className="h-3.5 w-3.5" />} label="Derived columns" value={q.data ? q.data.definitions.length.toString() : "—"} />
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Pipeline · </span>
            aggregation keys <code className="rounded bg-background px-1">participant_id</code> + <code className="rounded bg-background px-1">day_in_study</code>;
            duplicates removed by unique index on the derived frame;
            HRV windows with coverage &lt; 0.5 dropped; sleep durations summed across sessions starting on the same study day; BMI derived from latest height/weight snapshot;
            missing values kept as NULL for downstream imputation (Step 3).
          </div>

          <div className="space-y-4">
            {groups.map(([group, items]) => (
              <div key={group}>
                <div className="mb-1.5 flex items-center gap-2">
                  <div className="text-xs font-semibold tracking-tight">{group}</div>
                  <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                </div>
                <div className="overflow-hidden rounded-lg border border-border/60">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-muted/40 text-left text-muted-foreground">
                        <th className="px-3 py-1.5 font-medium">Feature</th>
                        <th className="px-3 py-1.5 font-medium">Source</th>
                        <th className="px-3 py-1.5 font-medium">Description</th>
                        <th className="px-3 py-1.5 text-right font-medium">Non-null</th>
                        <th className="px-3 py-1.5 text-right font-medium">Coverage</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {items.map(({ def, nonNull, completeness }) => (
                        <tr key={def.key} className="border-t border-border/40">
                          <td className="px-3 py-1.5">{def.label}<div className="text-[10px] text-muted-foreground">{def.key}</div></td>
                          <td className="px-3 py-1.5 text-muted-foreground">{def.source}</td>
                          <td className="px-3 py-1.5 text-muted-foreground font-sans">{def.description}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{nonNull.toLocaleString()}</td>
                          <td className="px-3 py-1.5 text-right">
                            <CoverageBar pct={completeness} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {q.data && q.data.preview.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-semibold tracking-tight">Preview · first 25 rows</div>
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-[10px] font-mono">
                  <thead>
                    <tr className="bg-muted/40 text-left text-muted-foreground">
                      {["participant_id", "day_in_study", "phase", "lh", "estrogen", "bmi", "hrv_mean", "sleep_asleep_min", "sleep_score", "rhr", "resp_rate_full", "wrist_temp_overnight_mean", "stress_score", "glucose_mean"].map((k) => (
                        <th key={k} className="whitespace-nowrap px-2.5 py-1.5 font-medium">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {q.data.preview.map((r, i) => (
                      <tr key={i} className="border-t border-border/40">
                        {["participant_id", "day_in_study", "phase", "lh", "estrogen", "bmi", "hrv_mean", "sleep_asleep_min", "sleep_score", "rhr", "resp_rate_full", "wrist_temp_overnight_mean", "stress_score", "glucose_mean"].map((k) => (
                          <td key={k} className="whitespace-nowrap px-2.5 py-1 tabular-nums">{fmt(r[k])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {q.data && (
            <div className="text-[10px] text-muted-foreground">Refreshed {new Date(q.data.refreshedAt).toLocaleString()}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function CoverageBar({ pct }: { pct: number }) {
  const p = Math.round(pct * 100);
  const color = p >= 75 ? "bg-emerald-500" : p >= 40 ? "bg-amber-500" : p > 0 ? "bg-rose-500" : "bg-muted-foreground/40";
  return (
    <div className="inline-flex w-24 items-center gap-1.5">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color}`} style={{ width: `${p}%` }} />
      </div>
      <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">{p}%</span>
    </div>
  );
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? v.toString() : v.toFixed(2);
  return String(v);
}