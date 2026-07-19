import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trainHormoneRegression, type RegressionResult, type AlgoName, type HormoneResult, type Metrics } from "@/lib/model/regression.functions";
import { getPipelineRun } from "@/lib/model/pipeline-runs.functions";
import { Sparkles, Trophy, Timer } from "lucide-react";

const ALGO_STYLE: Record<AlgoName, string> = {
  random_forest: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  gradient_boosting: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
  xgboost: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20",
};

export function HormoneRegression() {
  const fn = useServerFn(trainHormoneRegression);
  const getRun = useServerFn(getPipelineRun);
  const cached = useQuery({
    queryKey: ["pipeline-run", "regression"],
    queryFn: () => getRun({ data: { step: "regression" } }),
    refetchOnWindowFocus: false,
  });
  const m = useMutation({ mutationFn: () => fn() });
  const data: RegressionResult | undefined = m.data ?? (cached.data?.result as RegressionResult | undefined);


  return (
    <div className="space-y-4 px-6 sm:px-8">
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Step 4 · Hormone regression</div>
              <CardTitle className="mt-1 text-base font-semibold tracking-tight">Estimate missing LH & estrogen from wearables</CardTitle>
              <CardDescription className="text-xs">
                Two separate regressors are trained per hormone (LH, estrogen). Predictors are every non-hormone,
                non-phase, non-timestamp feature — so the models remain usable when a user only supplies wearable
                signals. Three algorithms compete: <span className="font-medium">Random Forest</span>,
                <span className="font-medium"> Gradient Boosting</span>, and an
                <span className="font-medium"> XGBoost-style GBRT</span> (L2 leaf regularization).
                Each is fit on the training split, scored on validation, and the winner (highest val R²) is saved
                to the in-worker artifact for inference on future users.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => m.mutate()} disabled={m.isPending}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              {m.isPending ? "Training…" : data ? "Retrain" : "Train models"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {!data && !m.isPending && (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
              Click <span className="font-medium text-foreground">Train models</span> to fit Random Forest, Gradient
              Boosting, and XGBoost-style regressors on the training split and evaluate them on validation & test.
              Fits typically take 10–30 seconds inside the worker.
            </div>
          )}
          {m.isPending && (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
              Fitting three regressors per hormone on the training split, evaluating on validation and test…
            </div>
          )}
          {m.error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {(m.error as Error).message}
            </div>
          )}

          {data && data.hormones.map((h) => <HormoneCard key={h.target} h={h} />)}

          {data && (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Artifact & inference · </span>
              {data.notes} The predictor list and the exact train-set medians used for missing-value fill are
              persisted alongside each winning ensemble; a downstream call to <code className="rounded bg-background px-1">predictHormones</code> reuses that same artifact to fill LH / estrogen when a new user only provides wearables.
              <div className="mt-1 text-[10px]">Trained {new Date(data.refreshedAt).toLocaleString()}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HormoneCard({ h }: { h: HormoneResult }) {
  return (
    <div className="rounded-lg border border-border/60">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 bg-muted/30 px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold tracking-tight">{h.label}</span>
          <span className="text-[10px] text-muted-foreground">{h.unit}</span>
          <Badge variant="outline" className="text-[10px]">{h.predictors.length} predictors</Badge>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <Trophy className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-muted-foreground">Best on val:</span>
          <span className={`rounded border px-1.5 py-0.5 font-medium ${ALGO_STYLE[h.bestAlgo]}`}>{algoLabel(h.bestAlgo)}</span>
          <span className="ml-2 tabular-nums text-muted-foreground">test R² <span className="font-semibold text-foreground">{h.bestTest.r2.toFixed(3)}</span></span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 px-3 py-2 text-[11px] sm:grid-cols-4">
        <Kv label="Train rows"      value={h.trainN.toLocaleString()} />
        <Kv label="Validation rows" value={h.valN.toLocaleString()} />
        <Kv label="Test rows"       value={h.testN.toLocaleString()} />
        <Kv label="Target μ ± σ"    value={`${h.yMean.toFixed(2)} ± ${h.yStd.toFixed(2)}`} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-t border-border/40 bg-muted/20 text-left text-muted-foreground">
              <th className="px-3 py-1.5 font-medium">Algorithm</th>
              <th className="px-3 py-1.5 font-medium">Hyperparameters</th>
              <th className="px-3 py-1.5 text-right font-medium">Fit</th>
              <th className="px-3 py-1.5 text-right font-medium">Train MAE / RMSE / R²</th>
              <th className="px-3 py-1.5 text-right font-medium">Val MAE / RMSE / R²</th>
              <th className="px-3 py-1.5 text-right font-medium">Test MAE / RMSE / R²</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {h.algos.map((a) => {
              const isBest = a.algo === h.bestAlgo;
              return (
                <tr key={a.algo} className={`border-t border-border/40 ${isBest ? "bg-amber-500/5" : ""}`}>
                  <td className="px-3 py-1.5">
                    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${ALGO_STYLE[a.algo]}`}>
                      {isBest && <Trophy className="h-2.5 w-2.5" />}
                      {a.label}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-[10px] text-muted-foreground">{fmtHp(a.hyperparams)}</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground"><Timer className="mr-0.5 inline h-3 w-3" />{a.fitMs} ms</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmtMetrics(a.train)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmtMetrics(a.val)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmtMetrics(a.test)}</td>
                </tr>
              );
            })}
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

function fmtMetrics(m: Metrics): string {
  return `${m.mae.toFixed(2)} / ${m.rmse.toFixed(2)} / ${m.r2.toFixed(3)}`;
}
function fmtHp(hp: Record<string, number>): string {
  return Object.entries(hp).filter(([k]) => k !== "seed").map(([k, v]) => `${k}=${v}`).join(" · ");
}
function algoLabel(a: AlgoName): string {
  return a === "random_forest" ? "Random Forest" : a === "gradient_boosting" ? "Gradient Boosting" : "XGBoost";
}