import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shuffle } from "lucide-react";
import { getTrainValTestSplit, PHASES, type SplitResult, type PhaseKey } from "@/lib/model/split.functions";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

const PHASE_COLOR: Record<PhaseKey, string> = {
  Menstrual: "var(--chart-5)",
  Follicular: "var(--chart-2)",
  Fertility: "var(--chart-3)",
  Luteal: "var(--chart-1)",
};

const SPLIT_TONE: Record<"train" | "validation" | "test", string> = {
  train: "bg-primary/10 text-primary border-primary/30",
  validation: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  test: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
};

export function TrainValTestSplit() {
  const [seedInput, setSeedInput] = useState("42");
  const [seed, setSeed] = useState(42);
  const [data, setData] = useState<SplitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getTrainValTestSplit({ data: { seed } })
      .then((res) => { if (!cancelled) setData(res); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [seed]);

  const proportionData = data
    ? data.splits.map((s) => {
        const row: Record<string, number | string> = { split: s.name };
        for (const p of PHASES) row[p] = +(s.phaseProportions[p] * 100).toFixed(1);
        return row;
      })
    : [];

  return (
    <div className="px-6 sm:px-8">
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Step 1 · Train / Validation / Test split</CardTitle>
            <CardDescription>
              Participant-level stratified split (70 / 15 / 15). Same subject never appears in more than one set — prevents day-level leakage. Stratified by dominant menstrual phase so phase proportions stay balanced across splits.
            </CardDescription>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="seed" className="text-xs">Random seed</Label>
              <Input
                id="seed"
                type="number"
                className="h-9 w-24"
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { const n = Number(seedInput); if (Number.isFinite(n)) setSeed(n); } }}
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const n = Math.floor(Math.random() * 100000);
                setSeedInput(String(n));
                setSeed(n);
              }}
            >
              <Shuffle className="mr-1 h-3.5 w-3.5" /> Re-shuffle
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading participant labels…
            </div>
          )}
          {error && <div className="text-sm text-destructive">Failed to load split: {error}</div>}

          {data && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {data.splits.map((s) => (
                  <div key={s.name} className={`rounded-lg border p-4 ${SPLIT_TONE[s.name]}`}>
                    <div className="text-xs font-medium uppercase tracking-wider">{s.name}</div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-3xl font-semibold tabular-nums">{s.participantCount}</span>
                      <span className="text-xs opacity-70">subjects · {((s.participantCount / data.totalParticipants) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="mt-1 text-xs opacity-80">{s.dayCount.toLocaleString()} phase-labeled days</div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {s.participantIds.map((pid) => (
                        <Badge key={pid} variant="outline" className="border-current/40 bg-background/40 text-current text-[10px] font-mono">
                          {pid}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Phase distribution per split (% of days)
                </div>
                <div className="h-[260px]">
                  <ResponsiveContainer>
                    <BarChart data={proportionData} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                      <XAxis dataKey="split" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                      <YAxis unit="%" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} width={40} />
                      <Tooltip contentStyle={{ fontSize: 12, background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {PHASES.map((p) => (
                        <Bar key={p} dataKey={p} stackId="pct" fill={PHASE_COLOR[p]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Overall reference —{" "}
                  {PHASES.map((p, i) => (
                    <span key={p}>
                      {i > 0 ? " · " : ""}
                      {p} {(data.overallPhaseProportions[p] * 100).toFixed(1)}%
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                Split is deterministic for seed <span className="font-mono">{data.seed}</span>. Total: {data.totalParticipants} subjects · {data.totalDays.toLocaleString()} labeled days. Rows across every mcPHASES table (hormones, sleep, HRV, RHR, respiratory rate, stress, glucose, height/weight) are assigned to a split by <span className="font-mono">participant_id</span> — no subject crosses splits.
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}