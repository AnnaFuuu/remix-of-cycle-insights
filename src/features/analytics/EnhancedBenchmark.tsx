import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Trophy, Timer, Network, Users } from "lucide-react";
import {
  runEnhancedBenchmark,
  type EnhancedBenchmarkResult,
  type EnhancedMethod,
} from "@/lib/model/enhanced-benchmark.functions";
import { getPipelineRun } from "@/lib/model/pipeline-runs.functions";
import type { PhaseKey } from "@/lib/model/split.functions";

const METHOD_STYLE: Record<EnhancedMethod, string> = {
  ridge:         "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
  gbrt_enriched: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20",
  mlp_enriched:  "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
  moe_gbrt:      "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  hmm_gbrt:      "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20",
  hmm_moe:       "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/20",
};
const PHASE_COLOR: Record<PhaseKey, string> = {
  Menstrual: "var(--chart-5)", Follicular: "var(--chart-2)", Fertility: "var(--chart-1)", Luteal: "var(--chart-3)",
};
const CLUSTER_COLOR = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

export function EnhancedBenchmark() {
  const fn = useServerFn(runEnhancedBenchmark);
  const getRun = useServerFn(getPipelineRun);
  const cached = useQuery({
    queryKey: ["pipeline-run", "enhanced_benchmark"],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => getRun({ data: { step: "enhanced_benchmark" } }),
    refetchOnWindowFocus: false,
  });
  const m = useMutation({ mutationFn: () => fn() });
  const data: EnhancedBenchmarkResult | undefined = m.data ?? (cached.data?.result as EnhancedBenchmarkResult | undefined);

  return (
    <div className="space-y-4 px-6 sm:px-8">
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Step 6 · Enhanced-methods benchmark (research)
              </div>
              <CardTitle className="mt-1 text-base font-semibold tracking-tight">
                Beyond linear regression — cluster stratification, feature engineering, and sequence smoothing
              </CardTitle>
              <CardDescription className="text-xs">
                Six methods on the same 5-fold participant CV:{" "}
                <b>Ridge</b> (linear baseline · CG normal-equations),{" "}
                <b>Softmax GBRT</b> on enriched features (base + 3d/7d rolling mean/std + per-participant z-scores),{" "}
                <b>Small MLP</b> (32 ReLU · Adam · L2),{" "}
                <b>Mixture-of-Experts GBRT</b> (K-Means phenotype clusters, one expert per cluster),{" "}
                <b>HMM-smoothed GBRT</b> (Viterbi over per-participant sequences with a train-learned transition matrix),{" "}
                and <b>HMM-smoothed MoE</b>. Winner = highest mean CV macro-F1. Does NOT replace the Step 5 model
                persisted for Dashboard inference — this panel is a research comparison.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => m.mutate()} disabled={m.isPending}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              {m.isPending ? "Running…" : data ? "Rerun" : "Run benchmark"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {!data && !m.isPending && (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
              Click <b>Run benchmark</b> to fit all six methods on the enriched feature matrix and produce a comparison
              table plus phenotype summary and HMM transition matrix. Typical runtime: 60–120 s.
            </div>
          )}
          {m.isPending && (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
              Fitting Ridge · GBRT · MLP · MoE · HMM-smoothed variants across 5 folds…
            </div>
          )}
          {m.error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {(m.error as Error).message}
            </div>
          )}
          {data && <Results data={data} />}
        </CardContent>
      </Card>
    </div>
  );
}

function Results({ data }: { data: EnhancedBenchmarkResult }) {
  const methods = [...data.methods].sort((a, b) => b.cvMacroF1.mean - a.cvMacroF1.mean);
  const winner = data.methods.find((m) => m.method === data.best) ?? methods[0];
  const classes: PhaseKey[] = ["Menstrual", "Follicular", "Fertility", "Luteal"];
  return (
    <>
      <div className="grid grid-cols-2 gap-3 text-[11px] sm:grid-cols-4">
        <Kv label="CV pool days" value={fmt(data.poolN)} />
        <Kv label="Test days" value={fmt(data.testN)} />
        <Kv label="Enriched features" value={String(data.enrichedFeatures.length)} />
        <Kv label={`K-Means phenotypes`} value={`K=${data.phenotype.k}`} />
      </div>

      {/* Leaderboard */}
      <div className="rounded-lg border border-border/60">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 bg-muted/30 px-3 py-2">
          <span className="text-sm font-semibold tracking-tight">Method leaderboard</span>
          <div className="flex items-center gap-1.5 text-[11px]">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-muted-foreground">Winner (mean CV macro-F1):</span>
            <span className={`rounded border px-1.5 py-0.5 font-medium ${METHOD_STYLE[winner.method]}`}>{winner.label}</span>
            <span className="ml-2 tabular-nums text-muted-foreground">
              CV F1 <b className="text-foreground">{winner.cvMacroF1.mean.toFixed(3)} ± {winner.cvMacroF1.std.toFixed(3)}</b>
              {" · "}test F1 <b className="text-foreground">{winner.testMacroF1.toFixed(3)}</b>
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-t border-border/40 bg-muted/20 text-left text-muted-foreground">
                <th className="px-3 py-1.5 font-medium">Method</th>
                <th className="px-3 py-1.5 text-right font-medium">Fit</th>
                <th className="px-3 py-1.5 text-right font-medium">CV acc (mean ± std)</th>
                <th className="px-3 py-1.5 text-right font-medium">CV macro-F1 (mean ± std)</th>
                <th className="px-3 py-1.5 text-right font-medium">Test acc</th>
                <th className="px-3 py-1.5 text-right font-medium">Test macro-F1</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {methods.map((mr) => {
                const best = mr.method === data.best;
                return (
                  <tr key={mr.method} className={`border-t border-border/40 ${best ? "bg-amber-500/5" : ""}`}>
                    <td className="px-3 py-1.5">
                      <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${METHOD_STYLE[mr.method]}`}>
                        {best && <Trophy className="h-2.5 w-2.5" />}
                        {mr.label}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground"><Timer className="mr-0.5 inline h-3 w-3" />{mr.fitMs} ms</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{mr.cvAccuracy.mean.toFixed(3)} ± {mr.cvAccuracy.std.toFixed(3)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{mr.cvMacroF1.mean.toFixed(3)} ± {mr.cvMacroF1.std.toFixed(3)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{mr.testAccuracy.toFixed(3)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{mr.testMacroF1.toFixed(3)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-fold macro-F1 */}
      <div className="rounded-lg border border-border/60">
        <div className="border-b border-border/60 bg-muted/30 px-3 py-2 text-sm font-semibold tracking-tight">
          Per-fold macro-F1
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-t border-border/40 bg-muted/20 text-left text-muted-foreground">
                <th className="px-3 py-1.5 font-medium">Method</th>
                {Array.from({ length: data.cvFolds }).map((_, i) => (
                  <th key={i} className="px-3 py-1.5 text-right font-medium">Fold {i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono">
              {methods.map((mr) => (
                <tr key={mr.method} className="border-t border-border/40">
                  <td className="px-3 py-1.5">
                    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${METHOD_STYLE[mr.method]}`}>
                      {mr.label}
                    </span>
                  </td>
                  {mr.perFold.map((v, i) => (
                    <td key={i} className="px-3 py-1.5 text-right tabular-nums">{v.toFixed(3)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PhenotypeCard data={data} />
        <HMMCard data={data} classes={classes} />
      </div>

      {/* Per-class metrics for winner */}
      <div className="rounded-lg border border-border/60">
        <div className="border-b border-border/60 bg-muted/30 px-3 py-2">
          <div className="text-sm font-semibold tracking-tight">Per-class metrics · test set · {winner.label}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-t border-border/40 bg-muted/20 text-left text-muted-foreground">
                <th className="px-3 py-1.5 font-medium">Phase</th>
                <th className="px-3 py-1.5 text-right font-medium">Precision</th>
                <th className="px-3 py-1.5 text-right font-medium">Recall</th>
                <th className="px-3 py-1.5 text-right font-medium">F1</th>
                <th className="px-3 py-1.5 text-right font-medium">Support</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {classes.map((c) => {
                const pm = winner.perClassTest[c];
                return (
                  <tr key={c} className="border-t border-border/40">
                    <td className="px-3 py-1.5">
                      <span className="inline-flex items-center gap-1.5 text-foreground">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: PHASE_COLOR[c] }} />
                        {c}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{pm.precision.toFixed(3)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{pm.recall.toFixed(3)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{pm.f1.toFixed(3)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{pm.support}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
        {data.notes}
        <div className="mt-1 text-[10px]">
          Trained {data.refreshedAt ? new Date(data.refreshedAt).toLocaleString() : "—"} ·
          {" "}baseline features {data.baselineFeatures.length}, enriched {data.enrichedFeatures.length}.
        </div>
      </div>
    </>
  );
}

function PhenotypeCard({ data }: { data: EnhancedBenchmarkResult }) {
  const { phenotype } = data;
  return (
    <div className="rounded-lg border border-border/60">
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-3 py-2">
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        <div>
          <div className="text-sm font-semibold tracking-tight">Participant phenotypes · K-Means (K={phenotype.k})</div>
          <div className="text-[11px] text-muted-foreground">Cluster centroids in original units. Assignment is used by MoE-GBRT.</div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-t border-border/40 bg-muted/20 text-left text-muted-foreground">
              <th className="px-3 py-1.5 font-medium">Feature</th>
              {phenotype.centroidsOriginal.map((_, c) => (
                <th key={c} className="px-3 py-1.5 text-right font-medium">
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: CLUSTER_COLOR[c % CLUSTER_COLOR.length] }} />
                    C{c} · n={phenotype.counts[c] ?? 0}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono">
            {phenotype.embeddingKeys.map((k, f) => (
              <tr key={k} className="border-t border-border/40">
                <td className="px-3 py-1.5 text-[10px] text-muted-foreground">{k}</td>
                {phenotype.centroidsOriginal.map((c, ci) => (
                  <td key={ci} className="px-3 py-1.5 text-right tabular-nums">{c[f]?.toFixed(2) ?? "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HMMCard({ data, classes }: { data: EnhancedBenchmarkResult; classes: PhaseKey[] }) {
  const t = data.hmm.transition;
  return (
    <div className="rounded-lg border border-border/60">
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-3 py-2">
        <Network className="h-3.5 w-3.5 text-muted-foreground" />
        <div>
          <div className="text-sm font-semibold tracking-tight">HMM transition matrix</div>
          <div className="text-[11px] text-muted-foreground">P(next phase | current phase) learned from pool sequences. Used by Viterbi smoothing.</div>
        </div>
      </div>
      <div className="overflow-x-auto p-3">
        <table className="w-full border-separate border-spacing-0 text-[11px]">
          <thead>
            <tr>
              <th className="p-1.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground">From ↓ / To →</th>
              {classes.map((c) => (
                <th key={c} className="p-1.5 text-center text-[10px] font-medium text-muted-foreground">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {classes.map((c, i) => (
              <tr key={c}>
                <th className="p-1.5 text-right text-[10px] font-medium text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: PHASE_COLOR[c] }} />
                    {c}
                  </span>
                </th>
                {classes.map((_, j) => {
                  const v = t[i]?.[j] ?? 0;
                  const bg = i === j
                    ? `color-mix(in oklab, var(--chart-1) ${Math.round(v * 100)}%, transparent)`
                    : `color-mix(in oklab, var(--chart-3) ${Math.round(v * 60)}%, transparent)`;
                  return (
                    <td key={j} className="p-0">
                      <div className="mx-0.5 my-0.5 rounded px-2 py-2 text-center font-mono tabular-nums" style={{ background: bg }}>
                        <div className="text-[11px] font-medium text-foreground">{(v * 100).toFixed(0)}%</div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-mono text-sm tabular-nums">{value}</div>
    </div>
  );
}
function fmt(n: number | null | undefined) {
  return typeof n === "number" && Number.isFinite(n) ? n.toLocaleString() : "—";
}
