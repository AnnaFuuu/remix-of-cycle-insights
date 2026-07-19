import * as React from "react";
import { toast } from "sonner";
import { useHormonalStore, toExportPacket } from "@/lib/hormonal/store";
import { PageHeader } from "@/components/hnhh/PageHeader";
import { PageSkeleton } from "@/components/hnhh/PageSkeleton";
import { PhaseBadge } from "@/components/hnhh/PhaseBadge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EXPORT_SCHEMA_VERSION } from "@/lib/hormonal/types";
import { BASELINE } from "@/lib/hormonal/analytics";
import { generateCohort } from "@/lib/hormonal/seed";
import { PHASE_ACCENT } from "@/lib/hormonal/phase";
import { Copy, Download, ShieldCheck, Database, BookOpen } from "lucide-react";
import { Sparkles, Loader2, Bot } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateNarrative } from "@/lib/agent/actions.functions";
import { buildSnapshot } from "@/lib/agent/context";
import type { HormonalPhase } from "@/lib/hormonal/types";
import { DATASETS } from "@/lib/clinical/datasets";
import { McphasesImportPanel } from "@/components/mcphases/McphasesImportPanel";
import { IngestRunsTable } from "@/components/mcphases/IngestRunsTable";
import { useQueryClient } from "@tanstack/react-query";

const PHASES: HormonalPhase[] = ["Menstrual", "Follicular", "Ovulatory", "Luteal"];

export function Research() {
  const { ready, entries, profile, setProfile } = useHormonalStore();
  const [cohort] = React.useState(() => generateCohort(40, 28, 14));
  const narrateFn = useServerFn(generateNarrative);
  const [narrative, setNarrative] = React.useState<string | null>(null);
  const [narrating, setNarrating] = React.useState(false);
  const qc = useQueryClient();

  const runNarrative = async () => {
    setNarrating(true);
    try {
      const ctx = buildSnapshot(entries, profile, 30);
      const res = await narrateFn({ data: { context: ctx, recordCount: entries.length, schemaVersion: EXPORT_SCHEMA_VERSION } });
      setNarrative(res.narrative);
    } catch (err) {
      toast.error("Copilot narrative failed");
      console.error(err);
    } finally { setNarrating(false); }
  };

  if (!ready) return <PageSkeleton />;

  const packets = entries.map((e) => toExportPacket(e, profile));
  const exportBundle = {
    schema: EXPORT_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    subject_alias: profile.researchOptIn ? profile.alias : "OPTED-OUT",
    anonymization_level: profile.anonymizationLevel,
    consent: profile.researchOptIn,
    records: profile.researchOptIn ? packets : [],
  };
  const previewJson = JSON.stringify(profile.researchOptIn ? exportBundle : { ...exportBundle, note: "Research contribution disabled. Enable to preview payload." }, null, 2);

  const copyJson = async () => {
    await navigator.clipboard.writeText(previewJson);
    toast.success("JSON copied to clipboard");
  };
  const downloadJson = () => {
    const blob = new Blob([previewJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hnhh-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const latest = entries[entries.length - 1];

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Research Portal"
        title="Open science export & benchmarks"
        description="Compare your telemetry against normative endocrine baselines and export a strict, anonymized JSON schema for downstream pipelines."
        actions={
          <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/5 font-mono text-[10px] text-primary">
            schema {EXPORT_SCHEMA_VERSION}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-6 px-6 sm:px-8 lg:grid-cols-3">
        <Card className="border-border/60 lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" /> Consent & anonymization
            </CardTitle>
            <CardDescription>You control every packet that leaves the device.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border bg-secondary/30 p-3">
              <div>
                <Label className="text-sm">Contribute to research</Label>
                <p className="text-xs text-muted-foreground">Enables anonymized export bundle.</p>
              </div>
              <Switch checked={profile.researchOptIn} onCheckedChange={(v) => setProfile({ ...profile, researchOptIn: v })} />
            </div>
            <div className="rounded-lg border p-3">
              <Label className="text-sm">Anonymization level</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["standard", "strict"] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setProfile({ ...profile, anonymizationLevel: lvl })}
                    className={`rounded-md border px-3 py-2 text-xs capitalize transition ${profile.anonymizationLevel === lvl ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"}`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Strict mode masks free-text notes and truncates dates to month granularity.
              </p>
            </div>
            <div className="rounded-lg border p-3 text-xs text-muted-foreground">
              <div className="mb-1 font-semibold text-foreground">Subject alias</div>
              <div className="font-mono">{profile.researchOptIn ? profile.alias : "—"}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 lg:col-span-2">
          <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <div className="min-w-0">
              <CardTitle className="text-base">JSON research export</CardTitle>
              <CardDescription>Strict schema · {packets.length} records · {profile.researchOptIn ? "active" : "gated"}</CardDescription>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="outline" onClick={runNarrative} disabled={narrating || !profile.researchOptIn} className="gap-1">
                {narrating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Narrative
              </Button>
              <Button size="sm" variant="outline" onClick={copyJson} className="gap-1"><Copy className="h-3.5 w-3.5" /> Copy</Button>
              <Button size="sm" onClick={downloadJson} className="gap-1"><Download className="h-3.5 w-3.5" /> Export</Button>
            </div>
          </CardHeader>
          <CardContent>
            {narrative && (
              <div className="mb-3 rounded-lg border border-primary/30 bg-primary/[0.04] p-3 text-xs leading-relaxed text-foreground">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-primary"><Bot className="h-3 w-3" /> Copilot research narrative</div>
                <div className="whitespace-pre-wrap">{narrative}</div>
              </div>
            )}
            <pre className="max-h-[380px] overflow-auto rounded-lg border bg-secondary/40 p-4 font-mono text-[11px] leading-relaxed text-foreground">
              {previewJson.split("\n").slice(0, 300).join("\n")}
            </pre>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 px-6 sm:px-8 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Endocrine baseline comparison</CardTitle>
            <CardDescription>Latest biomarker read vs population normative range for phase <span style={{ color: PHASE_ACCENT[latest.phase] }}>{latest.phase}</span>.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(["estrogen", "progesterone", "lh", "fsh"] as const).map((k) => {
              const range = BASELINE[k][latest.phase];
              const v = latest.biomarkers[k];
              const min = range[0], max = range[1];
              const clamped = v == null ? null : Math.max(min * 0.5, Math.min(max * 1.2, v));
              const pct = clamped == null ? 0 : ((clamped - min * 0.5) / (max * 1.2 - min * 0.5)) * 100;
              const rangeStart = ((min - min * 0.5) / (max * 1.2 - min * 0.5)) * 100;
              const rangeEnd = ((max - min * 0.5) / (max * 1.2 - min * 0.5)) * 100;
              return (
                <div key={k}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium uppercase tracking-wider text-muted-foreground">{k}</span>
                    <span className="font-mono tabular-nums">
                      {v ?? "—"} <span className="text-muted-foreground">(range {min}–{max})</span>
                    </span>
                  </div>
                  <div className="relative h-2 rounded-full bg-secondary">
                    <div className="absolute top-0 h-full rounded-full bg-primary/30" style={{ left: `${rangeStart}%`, width: `${rangeEnd - rangeStart}%` }} />
                    {v != null && <div className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded bg-foreground" style={{ left: `${pct}%` }} />}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4 text-primary" /> Synthetic benchmark cohort</CardTitle>
            <CardDescription>{cohort.length} deterministic synthetic subjects for pipeline testing.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="preview">
              <TabsList>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="dictionary">Data dictionary</TabsTrigger>
                <TabsTrigger value="method">Methodology</TabsTrigger>
              </TabsList>
              <TabsContent value="preview" className="mt-3">
                <div className="max-h-[280px] overflow-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/60 text-muted-foreground">
                      <tr>
                        <th className="p-2 text-left">Subject</th>
                        <th className="p-2 text-left">Day</th>
                        <th className="p-2 text-left">Phase</th>
                        <th className="p-2 text-right">BBT</th>
                        <th className="p-2 text-right">E2</th>
                        <th className="p-2 text-right">P4</th>
                        <th className="p-2 text-right">LH</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cohort.slice(0, 20).map((c) => (
                        <tr key={c.subject_id} className="border-t">
                          <td className="p-2 font-mono">{c.subject_id}</td>
                          <td className="p-2 tabular-nums">{c.cycle_day}</td>
                          <td className="p-2"><PhaseBadge phase={c.phase} /></td>
                          <td className="p-2 text-right tabular-nums">{c.bbt}</td>
                          <td className="p-2 text-right tabular-nums">{c.estrogen}</td>
                          <td className="p-2 text-right tabular-nums">{c.progesterone}</td>
                          <td className="p-2 text-right tabular-nums">{c.lh}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
              <TabsContent value="dictionary" className="mt-3 space-y-2 text-xs">
                {[
                  ["subject_id", "Opaque alias. Never links to identity or device."],
                  ["collection_date", "Day of observation. Strict mode truncates to month."],
                  ["cycle_day", "1-indexed day within the tracked menstrual cycle."],
                  ["phase", "Derived phase (Menstrual · Follicular · Ovulatory · Luteal)."],
                  ["subjective", "Self-reported mood, energy, stress, symptom severities (0-10)."],
                  ["objective", "BBT (°C), sleep, activity, HR/HRV telemetry."],
                  ["biomarkers", "Optional exogenous endocrine measurements."],
                  ["consent", "Explicit opt-in flags and anonymization level."],
                ].map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[140px_1fr] gap-3">
                    <span className="font-mono text-primary">{k}</span>
                    <span className="text-muted-foreground">{v}</span>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="method" className="mt-3 text-xs text-muted-foreground space-y-2">
                <p>Records are generated deterministically from a seeded PRNG for reproducibility. Phase-conditioned distributions approximate the population midranges reported by NIH/NIDDK for BBT, LH, FSH, estradiol, and progesterone.</p>
                <p>All export packets are local-first: nothing leaves the device unless the user exports or copies the JSON. Strict mode drops free-text notes and reduces date granularity to prevent re-identification.</p>
                <p><strong>Not a medical device.</strong> This platform is telemetry infrastructure for personal insight and consented open-science research. It does not diagnose, treat, cure, or prevent any condition.</p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div className="px-6 sm:px-8">
        <Card className="border-border/60 bg-primary/5">
          <CardContent className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-4">
            {PHASES.map((p) => (
              <div key={p} className="rounded-lg border bg-background p-4">
                <PhaseBadge phase={p} />
                <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                  <div>E2 {BASELINE.estrogen[p][0]}–{BASELINE.estrogen[p][1]} pg/mL</div>
                  <div>P4 {BASELINE.progesterone[p][0]}–{BASELINE.progesterone[p][1]} ng/mL</div>
                  <div>LH {BASELINE.lh[p][0]}–{BASELINE.lh[p][1]} mIU/mL</div>
                  <div>FSH {BASELINE.fsh[p][0]}–{BASELINE.fsh[p][1]} mIU/mL</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="px-6 sm:px-8">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4 text-primary" /> Reference datasets & pretraining corpora</CardTitle>
            <CardDescription>Provenance of the corpora used for CycloFM pretraining and downstream validation.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {DATASETS.map((d) => (
              <div key={d.id} className="rounded-lg border bg-background p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{d.name}</div>
                  {d.usedForPretraining && <Badge variant="outline" className="rounded-full text-[10px]">pretraining</Badge>}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-[11px] text-muted-foreground">
                  <span>n =</span><span className="text-right tabular-nums">{d.sampleSize.toLocaleString()}</span>
                  <span>variables</span><span className="text-right tabular-nums">{d.variables.toLocaleString()}</span>
                  <span>license</span><span className="text-right">{d.license.split(" ")[0]}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {d.modalities.map((m) => (
                    <span key={m} className="rounded border px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{m}</span>
                  ))}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{d.description}</p>
                <p className="mt-2 text-[10px] italic text-muted-foreground">{d.citation}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6 px-6 sm:px-8">
        <McphasesImportPanel onIngested={() => qc.invalidateQueries({ queryKey: ["mcphases", "overview"] })} />
        <IngestRunsTable />
      </div>
    </div>
  );
}