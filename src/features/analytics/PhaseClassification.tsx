import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Trophy, Timer } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import {
  trainPhaseClassification,
  type ClassificationResult,
  type AlgoName,
  type AlgoResult,
} from "@/lib/model/classification.functions";
import { getPipelineRun } from "@/lib/model/pipeline-runs.functions";
import type { PhaseKey } from "@/lib/model/split.functions";

const ALGO_STYLE: Record<AlgoName, string> = {
  softmax_gbrt:         "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20",
  random_forest:        "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  logistic_regression:  "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
};

const PHASE_COLOR: Record<PhaseKey, string> = {
  Menstrual:  "var(--chart-5)",
  Follicular: "var(--chart-2)",
  Fertility:  "var(--chart-1)",
  Luteal:     "var(--chart-3)",
};

export function PhaseClassification() {
  const fn = useServerFn(trainPhaseClassification);
  const getRun = useServerFn(getPipelineRun);
  const cached = useQuery({
    queryKey: ["pipeline-run", "classification"],
    queryFn: () => getRun({ data: { step: "classification" } }),
    refetchOnWindowFocus: false,
  });
  const m = useMutation({ mutationFn: () => fn() });
  const data: ClassificationResult | undefined = m.data ?? (cached.data?.result as ClassificationResult | undefined);


  return (
    <div className="space-y-4 px-6 sm:px-8">
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Step 5 · Menstrual phase classification
              </div>
              <CardTitle className="mt-1 text-base font-semibold tracking-tight">
                Predict cycle phase from every other variable
              </CardTitle>
              <CardDescription className="text-xs">
                Four-class target (<span className="font-medium">Menstrual · Follicular · Fertility · Luteal</span>).
                Predictors = all non-phase, non-identifier features (LH / E3G / PdG included when observed; the
                Step-4 imputer fills them for new users). Three algorithms compete under
                <span className="font-medium"> 5-fold stratified cross-validation by participant</span> over the
                pre-split <span className="font-medium">train + validation</span> pool — the test set stays held
                out. Algorithms: <span className="font-medium">Softmax GBRT</span> (multi-class gradient-boosted
                trees, the literature-preferred choice for tabular data — Grinsztajn et al. NeurIPS 2022;
                Shwartz-Ziv &amp; Armon 2022), <span className="font-medium">Random Forest</span> (Gini, majority
                vote), and <span className="font-medium">multinomial logistic regression</span> as a linear
                baseline. Winner = highest <span className="font-medium">mean CV macro-F1</span>; then refit on the
                full pool and scored on the held-out test set. Class weights = inverse fold-train frequency;
                imputation uses fold-train medians (no leakage).
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
              Click <span className="font-medium text-foreground">Train models</span> to fit all three classifiers,
              evaluate on validation & test, and surface per-class F1 + a confusion matrix. Runs in the worker in a
              few seconds.
            </div>
          )}
          {m.isPending && (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
              Fitting softmax GBRT, random forest and multinomial logistic regression on the training split…
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

function Results({ data }: { data: ClassificationResult }) {
  const winner = data.algos.find((a) => a.algo === data.bestAlgo)!;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 text-[11px] sm:grid-cols-4">
        <Kv label={`CV pool days (${data.cvFolds}-fold)`} value={data.poolN.toLocaleString()} />
        <Kv label="Held-out test days" value={data.testN.toLocaleString()} />
        <Kv label="Predictors" value={String(data.predictors.length)} />
        <Kv label="Pre-split (train / val)" value={`${data.trainN.toLocaleString()} / ${data.valN.toLocaleString()}`} />
      </div>

      <div className="rounded-lg border border-border/60">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 bg-muted/30 px-3 py-2">
          <span className="text-sm font-semibold tracking-tight">Algorithm comparison</span>
          <div className="flex items-center gap-1.5 text-[11px]">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-muted-foreground">Winner (mean CV macro-F1):</span>
            <span className={`rounded border px-1.5 py-0.5 font-medium ${ALGO_STYLE[winner.algo]}`}>{winner.label}</span>
            <span className="ml-2 tabular-nums text-muted-foreground">
              CV F1 <span className="font-semibold text-foreground">{winner.cv.meanMacroF1.toFixed(3)} ± {winner.cv.stdMacroF1.toFixed(3)}</span>
              {" · "}test F1 <span className="font-semibold text-foreground">{winner.macroF1.test.toFixed(3)}</span>
              {" · "}test acc <span className="font-semibold text-foreground">{winner.accuracy.test.toFixed(3)}</span>
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-t border-border/40 bg-muted/20 text-left text-muted-foreground">
                <th className="px-3 py-1.5 font-medium">Algorithm</th>
                <th className="px-3 py-1.5 font-medium">Hyperparameters</th>
                <th className="px-3 py-1.5 text-right font-medium">Fit</th>
                <th className="px-3 py-1.5 text-right font-medium">Train acc / F1 / logloss</th>
                <th className="px-3 py-1.5 text-right font-medium">CV mean ± std · acc / F1 / logloss</th>
                <th className="px-3 py-1.5 text-right font-medium">Test acc / F1 / logloss</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {data.algos.map((a) => {
                const best = a.algo === data.bestAlgo;
                return (
                  <tr key={a.algo} className={`border-t border-border/40 ${best ? "bg-amber-500/5" : ""}`}>
                    <td className="px-3 py-1.5">
                      <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${ALGO_STYLE[a.algo]}`}>
                        {best && <Trophy className="h-2.5 w-2.5" />}
                        {a.label}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-[10px] text-muted-foreground">{fmtHp(a.hyperparams)}</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground"><Timer className="mr-0.5 inline h-3 w-3" />{a.fitMs} ms</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtTrip(a.accuracy.train, a.macroF1.train, a.logLoss.train)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtCV(a.cv)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtTrip(a.accuracy.test, a.macroF1.test, a.logLoss.test)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <CVFoldsCard data={data} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PerClassCard winner={winner} classes={data.classes} />
        <ConfusionMatrixCard winner={winner} classes={data.classes} />
      </div>

      {data.featureImportances.length > 0 && (
        <div className="rounded-lg border border-border/60">
          <div className="border-b border-border/60 bg-muted/30 px-3 py-2 text-sm font-semibold tracking-tight">
            Top 15 predictors · {winner.label}
          </div>
          <div className="h-[360px] w-full p-3">
            <ResponsiveContainer>
              <BarChart data={data.featureImportances.slice().reverse()} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickFormatter={(v) => `${(v * 100).toFixed(1)}%`} />
                <YAxis type="category" dataKey="label" width={160} tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)", opacity: 0.3 }}
                  contentStyle={{ fontSize: 11, background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }}
                  formatter={(v: number) => `${(v * 100).toFixed(2)}%`}
                />
                <Bar dataKey="importance" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Class balance (train / val / test days) · </span>
        {data.classes.map((c) => (
          <span key={c} className="mr-3 inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: PHASE_COLOR[c] }} />
            {c}: {data.classCounts.train[c]} / {data.classCounts.val[c]} / {data.classCounts.test[c]}
          </span>
        ))}
        <div className="mt-1 text-[10px]">{data.notes} · Trained {new Date(data.refreshedAt).toLocaleString()}</div>
      </div>
    </>
  );
}

function PerClassCard({ winner, classes }: { winner: AlgoResult; classes: PhaseKey[] }) {
  return (
    <div className="rounded-lg border border-border/60">
      <div className="border-b border-border/60 bg-muted/30 px-3 py-2">
        <div className="text-sm font-semibold tracking-tight">Per-class metrics · test set</div>
        <div className="text-[11px] text-muted-foreground">Precision, recall, F1 and support per phase for the winning model.</div>
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
              const m = winner.perClass.test[c];
              return (
                <tr key={c} className="border-t border-border/40">
                  <td className="px-3 py-1.5">
                    <span className="inline-flex items-center gap-1.5 text-foreground">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: PHASE_COLOR[c] }} />
                      {c}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{m.precision.toFixed(3)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{m.recall.toFixed(3)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{m.f1.toFixed(3)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{m.support}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConfusionMatrixCard({ winner, classes }: { winner: AlgoResult; classes: PhaseKey[] }) {
  const conf = winner.confusion.test;
  const rowTotals = conf.map((r) => r.reduce((s, v) => s + v, 0));
  return (
    <div className="rounded-lg border border-border/60">
      <div className="border-b border-border/60 bg-muted/30 px-3 py-2">
        <div className="text-sm font-semibold tracking-tight">Confusion matrix · test set</div>
        <div className="text-[11px] text-muted-foreground">Rows = truth · columns = prediction · cell = row-normalized share.</div>
      </div>
      <div className="overflow-x-auto p-3">
        <table className="w-full border-separate border-spacing-0 text-[11px]">
          <thead>
            <tr>
              <th className="p-1.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground">True ↓ / Pred →</th>
              {classes.map((c) => (
                <th key={c} className="p-1.5 text-center text-[10px] font-medium text-muted-foreground">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {classes.map((c, i) => (
              <tr key={c}>
                <th className="p-1.5 text-right text-[10px] font-medium text-muted-foreground">{c}</th>
                {classes.map((_, j) => {
                  const raw = conf[i][j];
                  const share = rowTotals[i] > 0 ? raw / rowTotals[i] : 0;
                  const bg = i === j
                    ? `color-mix(in oklab, var(--chart-1) ${Math.round(share * 100)}%, transparent)`
                    : `color-mix(in oklab, var(--destructive) ${Math.round(share * 60)}%, transparent)`;
                  return (
                    <td key={j} className="p-0">
                      <div
                        className="mx-0.5 my-0.5 rounded px-2 py-2 text-center font-mono tabular-nums"
                        style={{ background: bg }}
                        title={`${raw} of ${rowTotals[i]}`}
                      >
                        <div className="text-[11px] font-medium text-foreground">{(share * 100).toFixed(0)}%</div>
                        <div className="text-[9px] text-muted-foreground">{raw}</div>
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
function fmtTrip(acc: number, f1: number, ll: number) {
  return `${acc.toFixed(3)} / ${f1.toFixed(3)} / ${ll.toFixed(3)}`;
}
function fmtHp(hp: Record<string, number | string>) {
  return Object.entries(hp).filter(([k]) => k !== "seed").map(([k, v]) => `${k}=${v}`).join(" · ");
}
function fmtMS(m: number, s: number) {
  return `${m.toFixed(3)} ± ${s.toFixed(3)}`;
}
function fmtCV(cv: AlgoResult["cv"]) {
  return `${fmtMS(cv.meanAccuracy, cv.stdAccuracy)} / ${fmtMS(cv.meanMacroF1, cv.stdMacroF1)} / ${fmtMS(cv.meanLogLoss, cv.stdLogLoss)}`;
}

function CVFoldsCard({ data }: { data: ClassificationResult }) {
  return (
    <div className="rounded-lg border border-border/60">
      <div className="border-b border-border/60 bg-muted/30 px-3 py-2">
        <div className="text-sm font-semibold tracking-tight">
          {data.cvFolds}-fold cross-validation · per-fold macro-F1 on out-of-fold participants
        </div>
        <div className="text-[11px] text-muted-foreground">
          Stratified by participant over the train + validation pool ({data.poolN.toLocaleString()} labeled days).
          Test set stayed held out for every fold.
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-t border-border/40 bg-muted/20 text-left text-muted-foreground">
              <th className="px-3 py-1.5 font-medium">Algorithm</th>
              {Array.from({ length: data.cvFolds }, (_, i) => (
                <th key={i} className="px-3 py-1.5 text-right font-medium">Fold {i + 1}</th>
              ))}
              <th className="px-3 py-1.5 text-right font-medium">Mean ± std</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {data.algos.map((a) => {
              const best = a.algo === data.bestAlgo;
              return (
                <tr key={a.algo} className={`border-t border-border/40 ${best ? "bg-amber-500/5" : ""}`}>
                  <td className="px-3 py-1.5">
                    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${ALGO_STYLE[a.algo]}`}>
                      {a.label}
                    </span>
                  </td>
                  {a.cv.perFold.map((f) => (
                    <td key={f.fold} className="px-3 py-1.5 text-right tabular-nums">{f.macroF1.toFixed(3)}</td>
                  ))}
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums">
                    {fmtMS(a.cv.meanMacroF1, a.cv.stdMacroF1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

