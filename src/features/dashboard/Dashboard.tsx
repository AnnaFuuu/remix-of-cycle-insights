import * as React from "react";
import { useHormonalStore } from "@/lib/hormonal/store";
import { PageHeader } from "@/components/hnhh/PageHeader";
import { ProactiveInsights } from "@/components/agent/ProactiveInsights";
import { LongitudinalPanel } from "./LongitudinalPanel";
import { PredictorPanel } from "./PredictorPanel";
import { useI18n } from "@/lib/i18n";
import { PageSkeleton } from "@/components/hnhh/PageSkeleton";
import { StatCard } from "@/components/hnhh/StatCard";
import { PhaseBadge } from "@/components/hnhh/PhaseBadge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Thermometer, Moon, HeartPulse, Sparkles, TrendingDown, TrendingUp, Activity } from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceArea,
} from "recharts";
import { PHASE_COLORS, PHASE_ACCENT } from "@/lib/hormonal/phase";
import { rollingAvg, mean } from "@/lib/hormonal/analytics";
import type { HormonalPhase } from "@/lib/hormonal/types";

export function Dashboard() {
  const { ready, entries } = useHormonalStore();
  const { t } = useI18n();
  if (!ready) return <PageSkeleton />;
  if (!entries.length) {
    return (
      <>
        <PageHeader eyebrow="Dashboard" title="Know your menstrual phase" description="Log a first entry to populate telemetry." />
        <PredictorPanel />
        <div className="px-6 py-6 sm:px-8 text-sm text-muted-foreground">No telemetry yet — enter predictor variables above or log an entry to populate the trend charts.</div>
      </>
    );
  }

  const latest = entries[entries.length - 1];
  const last7 = entries.slice(-7);
  const prev7 = entries.slice(-14, -7);

  const avg = (arr: typeof entries, f: (e: typeof entries[number]) => number | null) => {
    const xs = arr.map(f).filter((x): x is number => x != null);
    return xs.length ? mean(xs) : 0;
  };

  const moodNow = avg(last7, (e) => e.subjective.mood);
  const moodPrev = avg(prev7, (e) => e.subjective.mood);
  const sleepNow = avg(last7, (e) => e.objective.sleepQuality);
  const sleepPrev = avg(prev7, (e) => e.objective.sleepQuality);
  const bbtNow = avg(last7, (e) => e.objective.bbt);

  const chartData = entries.map((e) => ({
    date: e.date.slice(5),
    fullDate: e.date,
    phase: e.phase,
    bbt: e.objective.bbt,
    mood: e.subjective.mood,
    sleep: e.objective.sleepQuality,
    energy: e.subjective.energy,
  }));
  const bbtRoll = rollingAvg(chartData.map((d) => d.bbt), 3);
  chartData.forEach((d, i) => ((d as { bbtRoll?: number | null }).bbtRoll = bbtRoll[i]));

  // phase shaded bands
  const bands: { start: number; end: number; phase: HormonalPhase }[] = [];
  let cur: HormonalPhase | null = null;
  let startIdx = 0;
  chartData.forEach((d, i) => {
    if (d.phase !== cur) {
      if (cur) bands.push({ start: startIdx, end: i - 1, phase: cur });
      cur = d.phase;
      startIdx = i;
    }
    if (i === chartData.length - 1 && cur) bands.push({ start: startIdx, end: i, phase: cur });
  });

  // insights
  const insights: { title: string; body: string; tone: "info" | "warn" | "good" }[] = [];
  if (latest.phase === "Ovulatory") insights.push({
    title: "Estimated ovulation detected",
    body: `BBT rise trending on day ${latest.cycleDay}. LH reading ${latest.biomarkers.lh ?? "n/a"} mIU/mL is consistent with ovulatory window.`,
    tone: "good",
  });
  const moodStd = (() => {
    const luteal = entries.filter((e) => e.phase === "Luteal").map((e) => e.subjective.mood);
    const foll = entries.filter((e) => e.phase === "Follicular").map((e) => e.subjective.mood);
    return { luteal: mean(luteal), foll: mean(foll) };
  })();
  if (moodStd.foll - moodStd.luteal > 1.2) insights.push({
    title: "Mood volatility increased during luteal phase",
    body: `Mean mood dropped from ${moodStd.foll} (follicular) to ${moodStd.luteal} (luteal) across logged cycles.`,
    tone: "warn",
  });
  if (sleepNow < sleepPrev - 0.5) insights.push({
    title: "Sleep quality declined over the last 7 days",
    body: `7-day average sleep quality ${sleepNow}/10 vs ${sleepPrev}/10 the week prior.`,
    tone: "warn",
  });
  if (!insights.length) insights.push({
    title: "Telemetry is stable",
    body: "No significant shifts detected across the last 14 days of subjective and objective signals.",
    tone: "info",
  });

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow={t("dash.eyebrow")}
        title={t("dash.title")}
        description={t("dash.desc")}
        actions={<PhaseBadge phase={latest.phase} />}
      />
      <ProactiveInsights />
      <PredictorPanel />
      <div className="grid grid-cols-1 gap-4 px-6 py-6 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
        <StatCard
          label={t("dash.cycleDay")}
          value={latest.cycleDay}
          hint={<>{t("dash.phase")}: <span style={{ color: PHASE_ACCENT[latest.phase] }}>{latest.phase}</span></>}
          icon={<Sparkles className="h-4 w-4" />}
        />
        <StatCard
          label={t("dash.bbt7")}
          value={`${bbtNow.toFixed(2)}°`}
          hint={`${t("dash.bbt.latest")} ${latest.objective.bbt?.toFixed(2) ?? "-"}°C`}
          icon={<Thermometer className="h-4 w-4" />}
        />
        <StatCard
          label={t("dash.mood7")}
          value={`${moodNow.toFixed(1)}/10`}
          hint={`${(moodNow - moodPrev).toFixed(1)} ${t("dash.vsPrior")}`}
          trend={moodNow > moodPrev ? "up" : moodNow < moodPrev ? "down" : "flat"}
          icon={moodNow >= moodPrev ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        />
        <StatCard
          label={t("dash.sleep7")}
          value={`${sleepNow.toFixed(1)}/10`}
          hint={`${(sleepNow - sleepPrev).toFixed(1)} ${t("dash.vsPrior")}`}
          trend={sleepNow > sleepPrev ? "up" : sleepNow < sleepPrev ? "down" : "flat"}
          icon={<Moon className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 px-6 sm:px-8 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader>
            <CardTitle className="text-base">BBT · Mood · Sleep quality</CardTitle>
            <CardDescription>Phase-shaded 30-day telemetry. 3-day rolling BBT overlay.</CardDescription>
          </CardHeader>
          <CardContent className="h-[380px] pl-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 24, bottom: 0, left: 8 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                {bands.map((b, i) => (
                  <ReferenceArea
                    key={i}
                    x1={chartData[b.start].date}
                    x2={chartData[b.end].date}
                    fill={PHASE_COLORS[b.phase]}
                    stroke="none"
                  />
                ))}
                <XAxis dataKey="date" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                <YAxis yAxisId="bbt" domain={[36.2, 37.2]} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} width={44} />
                <YAxis yAxisId="score" orientation="right" domain={[0, 10]} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} width={30} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area yAxisId="score" type="monotone" dataKey="sleep" name="Sleep quality" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.15} />
                <Line yAxisId="score" type="monotone" dataKey="mood" name="Mood" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
                <Line yAxisId="bbt" type="monotone" dataKey="bbt" name="BBT" stroke="var(--chart-1)" strokeWidth={1.5} dot={{ r: 2 }} />
                <Line yAxisId="bbt" type="monotone" dataKey="bbtRoll" name="BBT 3d avg" stroke="var(--chart-5)" strokeDasharray="4 3" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          {insights.map((ins, i) => (
            <Card key={i} className="border-border/60">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: ins.tone === "good" ? "oklch(0.85 0.12 160 / 0.3)" : ins.tone === "warn" ? "oklch(0.85 0.12 60 / 0.35)" : "oklch(0.85 0.05 220 / 0.35)" }}
                  >
                    {ins.tone === "good" ? <HeartPulse className="h-4 w-4 text-emerald-700" /> : ins.tone === "warn" ? <Activity className="h-4 w-4 text-amber-700" /> : <Sparkles className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">{ins.title}</div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{ins.body}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="px-6 pt-6 sm:px-8">
        <LongitudinalPanel />
      </div>
    </div>
  );
}