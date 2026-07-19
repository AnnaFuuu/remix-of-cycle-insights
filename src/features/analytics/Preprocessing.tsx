import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPreprocessing } from "@/lib/model/preprocess.functions";
import { Filter, Wand2, ShieldCheck } from "lucide-react";

const STRATEGY_STYLE: Record<string, string> = {
  median: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
  mode: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20",
  preserve: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  skip: "bg-muted text-muted-foreground border-border/60",
};

export function Preprocessing() {
  const fn = useServerFn(getPreprocessing);
  const q = useQuery({ queryKey: ["mcphases", "preprocess"], queryFn: () => fn(), refetchOnWindowFocus: false });

  const grouped = React.useMemo(() => {
    const specs = q.data?.specs ?? [];
    const params = new Map(q.data?.params.map((p) => [p.key, p]) ?? []);
    const g = new Map<string, { spec: (typeof specs)[number]; param: ReturnType<typeof params.get> }[]>();
    for (const s of specs) {
      const arr = g.get(s.group) ?? [];
      arr.push({ spec: s, param: params.get(s.key) });
      g.set(s.group, arr);
    }
    return Array.from(g.entries());
  }, [q.data]);

  return (
    <div className="space-y-4 px-6 sm:px-8">
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Step 3 · Preprocessing & imputation</div>
          <CardTitle className="mt-1 text-base font-semibold tracking-tight">Sanitize missing values, learn imputers on train, apply to val & test</CardTitle>
          <CardDescription className="text-xs">
            Placeholder tokens (<code className="rounded bg-muted px-1">-</code>, <code className="rounded bg-muted px-1">--</code>, <code className="rounded bg-muted px-1">NA</code>, empty strings) are converted to true NULLs.
            Continuous features are imputed with the <span className="font-medium">training-set median</span>; ordinal self-reports with the <span className="font-medium">training-set mode</span>.
            Hormone biomarkers (LH, estrogen, PdG) are <span className="font-medium">preserved as NA</span> and later filled by the dedicated hormone regression model. All imputation parameters are fit on train only and re-used verbatim on validation, test, and future user data — no leakage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={<Filter className="h-3.5 w-3.5" />} label="Placeholder tokens sanitized" value={q.data ? q.data.sanitizedDashCount.toLocaleString() : "—"} />
            <Stat icon={<Wand2 className="h-3.5 w-3.5" />} label="Median imputers" value={q.data ? q.data.params.filter((p) => p.strategy === "median").length.toString() : "—"} />
            <Stat icon={<Wand2 className="h-3.5 w-3.5" />} label="Mode imputers" value={q.data ? q.data.params.filter((p) => p.strategy === "mode").length.toString() : "—"} />
            <Stat icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Preserved (hormones)" value={q.data ? q.data.params.filter((p) => p.strategy === "preserve").length.toString() : "—"} />
          </div>

          {q.data && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {q.data.splits.map((s) => (
                <div key={s.split} className="rounded-lg border border-border/60 bg-background p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold capitalize tracking-tight">{s.split}</div>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{s.rows.toLocaleString()} rows</span>
                  </div>
                  <div className="mt-2 text-[10px] text-muted-foreground">
                    Mean missingness across imputable features:
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="tabular-nums text-foreground">before {avgImputable(s.before, q.data!.specs).toFixed(1)}%</span>
                      <span>→</span>
                      <span className="tabular-nums font-medium text-emerald-600 dark:text-emerald-400">after {avgImputable(s.after, q.data!.specs).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-4">
            {grouped.map(([group, items]) => (
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
                        <th className="px-3 py-1.5 font-medium">Strategy</th>
                        <th className="px-3 py-1.5 font-medium">Learned value (train)</th>
                        <th className="px-3 py-1.5 text-right font-medium">Train missing</th>
                        <th className="px-3 py-1.5 font-medium">Rationale</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {items.map(({ spec, param }) => (
                        <tr key={spec.key} className="border-t border-border/40 align-top">
                          <td className="px-3 py-1.5">{spec.label}<div className="text-[10px] text-muted-foreground">{spec.key}</div></td>
                          <td className="px-3 py-1.5">
                            <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium capitalize ${STRATEGY_STYLE[spec.strategy]}`}>{spec.strategy}</span>
                          </td>
                          <td className="px-3 py-1.5 tabular-nums">
                            {spec.strategy === "median" || spec.strategy === "mode"
                              ? (param?.value === null || param?.value === undefined ? "—" : fmtVal(param!.value))
                              : <span className="text-muted-foreground">n/a</span>}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                            {param ? `${param.trainMissing}/${param.trainMissing + param.trainNonNull}` : "—"}
                          </td>
                          <td className="px-3 py-1.5 font-sans text-muted-foreground">{spec.rationale}</td>
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
              <div className="mb-1.5 text-xs font-semibold tracking-tight">Preview · train, post-imputation (first 25 rows)</div>
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full text-[10px] font-mono">
                  <thead>
                    <tr className="bg-muted/40 text-left text-muted-foreground">
                      {["participant_id", "day_in_study", "phase", "lh", "estrogen", "bmi", "hrv_mean", "sleep_asleep_min", "sleep_score", "rhr", "resp_rate_full", "stress_score", "glucose_mean", "cramps"].map((k) => (
                        <th key={k} className="whitespace-nowrap px-2.5 py-1.5 font-medium">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {q.data.preview.map((r, i) => (
                      <tr key={i} className="border-t border-border/40">
                        {["participant_id", "day_in_study", "phase", "lh", "estrogen", "bmi", "hrv_mean", "sleep_asleep_min", "sleep_score", "rhr", "resp_rate_full", "stress_score", "glucose_mean", "cramps"].map((k) => (
                          <td key={k} className="whitespace-nowrap px-2.5 py-1 tabular-nums">{fmt(r[k])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Reproducibility · </span>
            The learned imputers above form the preprocessing artifact. At inference (or when new mcPHASES batches arrive), apply exactly this pipeline in order:
            <span className="mt-1 block">1&nbsp;· coerce placeholder tokens (<code className="rounded bg-background px-1">-</code>, <code className="rounded bg-background px-1">--</code>, <code className="rounded bg-background px-1">NA</code>, empty) to NULL &nbsp;·&nbsp; 2&nbsp;· cast continuous / hormone fields to numeric &nbsp;·&nbsp; 3&nbsp;· fill continuous NULLs with the train medians &nbsp;·&nbsp; 4&nbsp;· fill ordinal self-reports with the train modes &nbsp;·&nbsp; 5&nbsp;· leave hormone NULLs untouched — the hormone regression model fills them at prediction time.</span>
          </div>

          {q.data && (
            <div className="text-[10px] text-muted-foreground">Fit {new Date(q.data.refreshedAt).toLocaleString()} · imputers learned on train split only</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function avgImputable(rec: Record<string, number>, specs: { key: string; strategy: string }[]): number {
  const imp = specs.filter((s) => s.strategy === "median" || s.strategy === "mode");
  if (!imp.length) return 0;
  let sum = 0;
  for (const s of imp) sum += rec[s.key] ?? 0;
  return (sum / imp.length) * 100;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function fmtVal(v: number | string): string {
  if (typeof v === "number") return Number.isInteger(v) ? v.toString() : v.toFixed(2);
  return String(v);
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? v.toString() : v.toFixed(2);
  return String(v);
}