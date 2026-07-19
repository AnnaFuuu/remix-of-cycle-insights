import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useHormonalStore } from "@/lib/hormonal/store";
import { useClinical } from "@/lib/clinical/use-clinical";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine } from "recharts";
import { PHASE_ACCENT } from "@/lib/hormonal/phase";

type Window = "7d" | "30d" | "90d" | "1y";
const WINDOWS: { key: Window; label: string; days: number }[] = [
  { key: "7d", label: "7d", days: 7 },
  { key: "30d", label: "30d", days: 30 },
  { key: "90d", label: "90d", days: 90 },
  { key: "1y", label: "1y", days: 365 },
];

export function LongitudinalPanel() {
  const { entries } = useHormonalStore();
  const { wearables, panels } = useClinical();
  const [w, setW] = React.useState<Window>("30d");
  const days = WINDOWS.find((x) => x.key === w)!.days;

  const wear = wearables.slice(-days);
  const wearByDate = new Map(wear.map((x) => [x.date, x]));
  const entryByDate = new Map(entries.map((x) => [x.date, x]));

  // build unified daily series by wearable date spine
  const spine = wear.map((s) => {
    const e = entryByDate.get(s.date);
    return {
      date: s.date.slice(5),
      fullDate: s.date,
      bbt: e?.objective.bbt ?? null,
      mood: e?.subjective.mood ?? null,
      symptomLoad: e ? (e.subjective.symptoms.cramps + e.subjective.symptoms.fatigue + e.subjective.symptoms.headache) / 3 : null,
      hrv: s.hrv,
      rhr: s.restingHR,
      tempDelta: s.skinTempDelta,
      phase: e?.phase,
      isMenses: e?.phase === "Menstrual",
    };
  });

  const panelPoints = panels.filter((p) => wearByDate.has(p.collectedAt));

  return (
    <Card className="border-border/60">
      <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div>
          <CardTitle className="text-base">Longitudinal research view</CardTitle>
          <CardDescription>Synchronized hormones · wearables · symptoms · BBT · cycle events.</CardDescription>
        </div>
        <div className="flex gap-1">
          {WINDOWS.map((x) => (
            <button key={x.key} onClick={() => setW(x.key)} className={`rounded-md border px-2.5 py-1 text-[11px] font-mono transition ${w === x.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}>{x.label}</button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pl-0">
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spine} margin={{ top: 5, right: 20, bottom: 0, left: 0 }} syncId="longitudinal">
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} width={40} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line dataKey="bbt" name="BBT (°C)" stroke="var(--chart-1)" dot={false} strokeWidth={1.5} connectNulls />
              {panelPoints.map((p) => (
                <ReferenceLine key={p.id} x={p.collectedAt.slice(5)} stroke={PHASE_ACCENT[p.phase]} strokeDasharray="2 2" label={{ value: "lab", fontSize: 9, fill: "var(--color-muted-foreground)", position: "top" }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spine} margin={{ top: 5, right: 20, bottom: 0, left: 0 }} syncId="longitudinal">
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
              <YAxis yAxisId="l" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} width={40} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} width={30} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="l" dataKey="hrv" name="HRV" stroke="var(--chart-2)" dot={false} strokeWidth={1.5} />
              <Line yAxisId="r" dataKey="rhr" name="Resting HR" stroke="var(--chart-3)" dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spine} margin={{ top: 5, right: 20, bottom: 0, left: 0 }} syncId="longitudinal">
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} width={40} domain={[0, 10]} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line dataKey="mood" name="Mood" stroke="var(--chart-4)" dot={false} strokeWidth={1.5} connectNulls />
              <Line dataKey="symptomLoad" name="Symptom load" stroke="var(--chart-5)" dot={false} strokeWidth={1.5} connectNulls />
              {spine.filter((s) => s.isMenses).map((s, i) => (
                <ReferenceLine key={i} x={s.date} stroke="var(--chart-3)" strokeOpacity={0.35} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="px-4 text-[10px] text-muted-foreground">Vertical accents = lab collection (top) · menses days (bottom). Charts share a time axis; hover to sync tooltip across all three.</p>
      </CardContent>
    </Card>
  );
}