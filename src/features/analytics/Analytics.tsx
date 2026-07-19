import { useHormonalStore } from "@/lib/hormonal/store";
import { PageHeader } from "@/components/hnhh/PageHeader";
import { PageSkeleton } from "@/components/hnhh/PageSkeleton";
import { EmptyData } from "@/components/hnhh/EmptyData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ScatterChart, Scatter, ZAxis, BarChart, Bar,
} from "recharts";
import { byPhase, mean, pearson, rollingAvg } from "@/lib/hormonal/analytics";
import { PHASE_ACCENT } from "@/lib/hormonal/phase";
import type { HormonalPhase } from "@/lib/hormonal/types";
import { TrainValTestSplit } from "./TrainValTestSplit";

const PHASES: HormonalPhase[] = ["Menstrual", "Follicular", "Ovulatory", "Luteal"];

export function Analytics() {
  const { ready, entries } = useHormonalStore();
  if (!ready) return <PageSkeleton />;
  if (!entries.length) {
    return (
      <>
        <PageHeader eyebrow="Model training" title="Analytics · Step 1 dataset split" description="Participant-level stratified 60/20/20 split over the mcPHASES cohort. Local telemetry is empty — longitudinal charts below become active once entries are logged." />
        <TrainValTestSplit />
        <EmptyData />
      </>
    );
  }

  const trend = entries.map((e) => ({
    date: e.date.slice(5),
    mood: e.subjective.mood,
    energy: e.subjective.energy,
    stress: e.subjective.stress,
    sleep: e.objective.sleepQuality,
    bbt: e.objective.bbt,
  }));
  const moodRoll = rollingAvg(trend.map((t) => t.mood), 5);
  trend.forEach((t, i) => ((t as { moodRoll?: number | null }).moodRoll = moodRoll[i]));

  const phaseMood = PHASES.map((p) => ({
    phase: p,
    mood: mean(byPhase(entries, (e) => e.subjective.mood)[p]),
    energy: mean(byPhase(entries, (e) => e.subjective.energy)[p]),
    sleep: mean(byPhase(entries, (e) => e.objective.sleepQuality)[p]),
    stress: mean(byPhase(entries, (e) => e.subjective.stress)[p]),
  }));

  const symTotals = ["cramps", "fatigue", "bloating", "headache", "nausea", "breastTenderness"].map((k) => {
    const key = k as keyof typeof entries[number]["subjective"]["symptoms"];
    const vals = entries.map((e) => e.subjective.symptoms[key]);
    return {
      symptom: k.replace(/([A-Z])/g, " $1"),
      frequency: vals.filter((v) => v > 2).length,
      severity: +mean(vals).toFixed(2),
    };
  });

  const scatterSleepMood = entries
    .filter((e) => e.objective.sleepQuality != null)
    .map((e) => ({ x: e.objective.sleepQuality as number, y: e.subjective.mood, phase: e.phase }));
  const scatterBbtCramps = entries
    .filter((e) => e.objective.bbt != null)
    .map((e) => ({ x: e.objective.bbt as number, y: e.subjective.symptoms.cramps, phase: e.phase }));

  const corrSleepMood = pearson(
    entries.map((e) => e.objective.sleepQuality ?? 0),
    entries.map((e) => e.subjective.mood),
  );
  const corrStressMood = pearson(
    entries.map((e) => e.subjective.stress),
    entries.map((e) => e.subjective.mood),
  );
  const corrBbtCramps = pearson(
    entries.map((e) => e.objective.bbt ?? 36.5),
    entries.map((e) => e.subjective.symptoms.cramps),
  );

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Analytics"
        title="Longitudinal analysis"
        description="Rolling averages, phase comparisons, and lightweight correlation summaries across the current window."
      />

      <TrainValTestSplit />

      <div className="grid grid-cols-1 gap-4 px-6 sm:grid-cols-3 sm:px-8">
        <CorrCard label="Sleep quality ↔ Mood" r={corrSleepMood} />
        <CorrCard label="Stress ↔ Mood" r={corrStressMood} />
        <CorrCard label="BBT ↔ Cramps" r={corrBbtCramps} />
      </div>

      <div className="grid grid-cols-1 gap-6 px-6 sm:px-8 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Subjective trends</CardTitle>
            <CardDescription>Mood, energy, stress with 5-day rolling mood.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pl-0">
            <ResponsiveContainer>
              <LineChart data={trend} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} width={30} />
                <Tooltip contentStyle={{ fontSize: 12, background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="mood" stroke="var(--chart-3)" dot={false} />
                <Line type="monotone" dataKey="energy" stroke="var(--chart-2)" dot={false} />
                <Line type="monotone" dataKey="stress" stroke="var(--chart-5)" dot={false} />
                <Line type="monotone" dataKey="moodRoll" stroke="var(--chart-1)" strokeDasharray="4 3" dot={false} name="Mood 5d avg" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Phase comparison</CardTitle>
            <CardDescription>Mean subjective and sleep scores per phase.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pl-0">
            <ResponsiveContainer>
              <BarChart data={phaseMood} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="phase" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} width={30} />
                <Tooltip contentStyle={{ fontSize: 12, background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="mood" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="energy" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sleep" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="stress" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Sleep quality vs mood</CardTitle>
            <CardDescription>Scatter colored by phase. Points near the diagonal suggest coupling.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pl-0">
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="x" name="Sleep" domain={[0, 10]} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} label={{ value: "Sleep quality", fontSize: 11, position: "insideBottom", offset: -4 }} />
                <YAxis dataKey="y" name="Mood" domain={[0, 10]} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} width={30} />
                <ZAxis range={[60, 60]} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ fontSize: 12, background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                {PHASES.map((p) => (
                  <Scatter key={p} name={p} data={scatterSleepMood.filter((d) => d.phase === p)} fill={PHASE_ACCENT[p]} />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">BBT vs cramp severity</CardTitle>
            <CardDescription>Explore whether temperature shifts co-occur with cramp reports.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pl-0">
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="x" name="BBT" domain={[36.2, 37.2]} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} label={{ value: "BBT °C", fontSize: 11, position: "insideBottom", offset: -4 }} />
                <YAxis dataKey="y" name="Cramps" domain={[0, 10]} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} width={30} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ fontSize: 12, background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                {PHASES.map((p) => (
                  <Scatter key={p} name={p} data={scatterBbtCramps.filter((d) => d.phase === p)} fill={PHASE_ACCENT[p]} />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="px-6 sm:px-8">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Symptom frequency & severity</CardTitle>
            <CardDescription>Days reported above severity 2 versus mean severity.</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] pl-0">
            <ResponsiveContainer>
              <BarChart data={symTotals} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="symptom" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis yAxisId="l" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} width={30} />
                <YAxis yAxisId="r" orientation="right" domain={[0, 10]} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} width={30} />
                <Tooltip contentStyle={{ fontSize: 12, background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="l" dataKey="frequency" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="r" dataKey="severity" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CorrCard({ label, r }: { label: string; r: number }) {
  const strength =
    Math.abs(r) > 0.6 ? "strong" : Math.abs(r) > 0.3 ? "moderate" : "weak";
  const dir = r > 0 ? "positive" : r < 0 ? "negative" : "none";
  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums">{r.toFixed(2)}</span>
          <span className="text-xs text-muted-foreground">Pearson r</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground capitalize">{strength} {dir} association</div>
      </CardContent>
    </Card>
  );
}