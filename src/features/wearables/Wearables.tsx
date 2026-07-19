import * as React from "react";
import { PageHeader } from "@/components/hnhh/PageHeader";
import { PageSkeleton } from "@/components/hnhh/PageSkeleton";
import { StatCard } from "@/components/hnhh/StatCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useHormonalStore } from "@/lib/hormonal/store";
import { useClinical } from "@/lib/clinical/use-clinical";
import { EmptyData } from "@/components/hnhh/EmptyData";
import { UserEntriesPanel } from "@/components/hnhh/UserEntriesPanel";
import { HeartPulse, Thermometer, Wind, Activity, Moon, Footprints } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend, AreaChart, Area } from "recharts";

export function Wearables() {
  const { ready } = useHormonalStore();
  const { wearables } = useClinical();
  if (!ready) return <PageSkeleton />;
  if (!wearables.length) {
    return (
      <div className="pb-10">
        <PageHeader eyebrow="Data · Wearables" title="Wearable signals" description="N/A — no wearable telemetry ingested." />
        <div className="px-6 sm:px-8"><WearableEntriesPanel /></div>
      </div>
    );
  }

  const w = wearables.slice(-60);
  const last = w[w.length - 1];
  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
  const hrv7 = mean(w.slice(-7).map((x) => x.hrv)).toFixed(1);
  const rhr7 = mean(w.slice(-7).map((x) => x.restingHR)).toFixed(1);
  const steps7 = Math.round(mean(w.slice(-7).map((x) => x.steps)));
  const sleep7 = Math.round(mean(w.slice(-7).map((x) => x.sleepStages.deep + x.sleepStages.light + x.sleepStages.rem + x.sleepStages.awake)));

  const chart = w.map((s) => ({
    date: s.date.slice(5),
    hrv: s.hrv,
    rhr: s.restingHR,
    tempDelta: s.skinTempDelta,
    resp: s.respRate,
    spo2: s.spo2,
    steps: s.steps,
    active: s.activeMinutes,
    deep: s.sleepStages.deep,
    light: s.sleepStages.light,
    rem: s.sleepStages.rem,
    awake: s.sleepStages.awake,
  }));

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow="Wearable signals"
        title="Continuous physiological telemetry"
        description="60-day rolling window from wrist-worn sensor: cardiovascular, thermoregulatory, respiratory, activity, and sleep architecture streams."
      />

      <div className="grid grid-cols-2 gap-4 px-6 py-6 sm:px-8 lg:grid-cols-4">
        <StatCard label="HRV · 7d (RMSSD)" value={`${hrv7} ms`} hint={`latest ${last.hrv} ms`} icon={<HeartPulse className="h-4 w-4" />} />
        <StatCard label="Resting HR · 7d" value={`${rhr7} bpm`} hint={`latest ${last.restingHR} bpm`} icon={<HeartPulse className="h-4 w-4" />} />
        <StatCard label="Skin temp Δ" value={`${last.skinTempDelta > 0 ? "+" : ""}${last.skinTempDelta}°C`} hint="from personal baseline" icon={<Thermometer className="h-4 w-4" />} />
        <StatCard label="SpO₂ · latest" value={`${last.spo2}%`} hint={`resp ${last.respRate}/min`} icon={<Wind className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-1 gap-6 px-6 sm:px-8 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm">HRV vs Resting HR</CardTitle>
            <CardDescription>Autonomic tone, dual-axis.</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px] pl-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 5, right: 20, bottom: 0, left: 0 }} syncId="wearables">
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                <YAxis yAxisId="hrv" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} width={30} />
                <YAxis yAxisId="rhr" orientation="right" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} width={30} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="hrv" dataKey="hrv" name="HRV (ms)" stroke="var(--chart-1)" dot={false} strokeWidth={1.5} />
                <Line yAxisId="rhr" dataKey="rhr" name="Resting HR (bpm)" stroke="var(--chart-3)" dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm">Skin temperature Δ + Respiratory rate</CardTitle>
            <CardDescription>Thermogenic & respiratory shifts around ovulation.</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px] pl-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 5, right: 20, bottom: 0, left: 0 }} syncId="wearables">
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                <YAxis yAxisId="t" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} width={30} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} width={30} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="t" dataKey="tempDelta" name="Skin temp Δ (°C)" stroke="var(--chart-4)" dot={false} strokeWidth={1.5} />
                <Line yAxisId="r" dataKey="resp" name="Resp. (bpm)" stroke="var(--chart-2)" dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm">Activity · steps & active minutes</CardTitle>
            <CardDescription>Daily activity load.</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px] pl-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 5, right: 20, bottom: 0, left: 0 }} syncId="wearables">
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} width={40} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="steps" name="Steps" fill="var(--chart-2)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm">Sleep architecture</CardTitle>
            <CardDescription>Stacked stages (deep · light · REM · awake), minutes.</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px] pl-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 5, right: 20, bottom: 0, left: 0 }} syncId="wearables">
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} width={30} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area dataKey="deep" stackId="s" name="Deep" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.7} />
                <Area dataKey="light" stackId="s" name="Light" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.5} />
                <Area dataKey="rem" stackId="s" name="REM" stroke="var(--chart-5)" fill="var(--chart-5)" fillOpacity={0.5} />
                <Area dataKey="awake" stackId="s" name="Awake" stroke="var(--chart-3)" fill="var(--chart-3)" fillOpacity={0.4} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="px-6 pt-6 sm:px-8">
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <span><Activity className="mr-1 inline h-3 w-3" /> Sampling: 1-minute PPG, 24/7</span>
          <span><Footprints className="mr-1 inline h-3 w-3" /> Steps: onboard accelerometer</span>
          <span><Moon className="mr-1 inline h-3 w-3" /> Sleep staging: PPG + actigraphy fusion</span>
        </div>
      </div>

      <div className="px-6 pt-6 sm:px-8">
        <WearableEntriesPanel />
      </div>
    </div>
  );
}

function WearableEntriesPanel() {
  return (
    <UserEntriesPanel
      storageKey="hnhh.userWearables.v1"
      labels={{
        cardTitle: "My wearable signals entry",
        cardDescription: "Log a wearable reading by date or upload an export from your device.",
        addButton: "Add wearable entry",
        uploadButton: "Upload file",
        addDialogTitle: "Add wearable signal",
        addDialogDescription: "Group all readings for one date together.",
        uploadDialogTitle: "Upload wearable export",
        uploadDialogDescription: "CSV, PDF, image, or document — up to 5 MB.",
        itemLabel: "Signal",
        itemPlaceholder: "e.g. Resting HR, HRV, Sleep score",
        resultLabel: "Value",
        resultPlaceholder: "e.g. 62 bpm",
        addAnother: "Add another signal",
        emptyState: "N/A — no entries yet. Click Add wearable entry or Upload file to start.",
        tableItemHeader: "Signal",
        tableResultHeader: "Value",
      }}
    />
  );
}