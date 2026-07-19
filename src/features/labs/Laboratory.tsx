import * as React from "react";
import { PageHeader } from "@/components/hnhh/PageHeader";
import { PageSkeleton } from "@/components/hnhh/PageSkeleton";
import { PhaseBadge } from "@/components/hnhh/PhaseBadge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHormonalStore } from "@/lib/hormonal/store";
import { useClinical } from "@/lib/clinical/use-clinical";

import { ANALYTE_LABEL } from "@/lib/clinical/reference-ranges";
import type { AssayFlag, LabPanel } from "@/lib/clinical/types";
import { UserLabsPanel } from "./UserLabsPanel";
import { ExamCalendar } from "./ExamCalendar";
import { PredictionHistoryPanel } from "./PredictionHistoryPanel";
import { FileText, CalendarDays, History } from "lucide-react";

function FlagPill({ flag }: { flag: AssayFlag }) {
  const cls = flag === "H"
    ? "bg-red-100 text-red-700 border-red-200"
    : flag === "L"
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";
  return <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono ${cls}`}>{flag}</span>;
}

function EndocrinePanelsCard({ panels, selected, setSelected }: { panels: LabPanel[]; selected: LabPanel; setSelected: (p: LabPanel) => void }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Collected panels</CardTitle>
          <CardDescription>{panels.length} panels · {panels[0].lab.split(" ")[0]}/{panels[panels.length-1].lab.split(" ")[0]}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 p-2">
          {panels.slice().reverse().map((p) => {
            const abnormal = p.assays.filter((a) => a.flag !== "N").length;
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className={`w-full rounded-md border px-3 py-2 text-left transition ${selected.id === p.id ? "border-primary bg-primary/5" : "border-transparent hover:bg-secondary"}`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono">{p.collectedAt}</span>
                  <PhaseBadge phase={p.phase} />
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Day {p.cycleDay} · {p.fasting ? "fasting" : "non-fast"}</span>
                  {abnormal > 0 && <span className="font-mono text-amber-700">{abnormal} flag</span>}
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div>
            <CardTitle className="text-base">Panel · {selected.collectedAt}</CardTitle>
            <CardDescription>{selected.lab} · cycle day {selected.cycleDay} · {selected.assays.length} analytes</CardDescription>
          </div>
          <PhaseBadge phase={selected.phase} />
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-secondary/60 text-muted-foreground">
                <tr className="text-left">
                  <th className="p-2 font-medium">Analyte</th>
                  <th className="p-2 text-right font-medium">Value</th>
                  <th className="p-2 font-medium">Unit</th>
                  <th className="p-2 text-right font-medium">Reference range</th>
                  <th className="p-2 font-medium">Flag</th>
                  <th className="p-2 font-medium">Method</th>
                </tr>
              </thead>
              <tbody>
                {selected.assays.map((a) => (
                  <tr key={a.analyte} className="border-t">
                    <td className="p-2">{ANALYTE_LABEL[a.analyte]}</td>
                    <td className="p-2 text-right font-mono tabular-nums">{a.value}</td>
                    <td className="p-2 font-mono text-muted-foreground">{a.unit}</td>
                    <td className="p-2 text-right font-mono tabular-nums text-muted-foreground">{a.refLow}–{a.refHigh}</td>
                    <td className="p-2"><FlagPill flag={a.flag} /></td>
                    <td className="p-2 font-mono text-[10px] text-muted-foreground">{a.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function Laboratory() {
  const { ready } = useHormonalStore();
  const { panels } = useClinical();
  const [selected, setSelected] = React.useState<LabPanel | null>(panels[panels.length - 1] ?? null);

  if (!ready) return <PageSkeleton />;

  const flagCounts = panels.reduce(
    (acc, p) => { for (const a of p.assays) acc[a.flag]++; return acc; },
    { L: 0, N: 0, H: 0 } as Record<AssayFlag, number>,
  );

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow="Laboratory"
        title="Endocrine assay panels"
        description="Serum reproductive endocrine profile, uploaded exam reports, and prediction history — all in one place."
        actions={
          panels.length > 0 ? (
            <div className="flex items-center gap-2 text-xs font-mono">
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">N {flagCounts.N}</Badge>
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">L {flagCounts.L}</Badge>
              <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">H {flagCounts.H}</Badge>
            </div>
          ) : null
        }
      />

      <div className="px-6 py-6 sm:px-8">
        <Tabs defaultValue="calendar" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="calendar"><CalendarDays className="mr-1.5 h-4 w-4" /> Exam calendar</TabsTrigger>
            <TabsTrigger value="history"><History className="mr-1.5 h-4 w-4" /> Prediction history</TabsTrigger>
            <TabsTrigger value="entries"><FileText className="mr-1.5 h-4 w-4" /> My entries</TabsTrigger>
            {panels.length > 0 && <TabsTrigger value="panels">Endocrine panels</TabsTrigger>}
          </TabsList>

          <TabsContent value="calendar" className="mt-0">
            <ExamCalendar />
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <PredictionHistoryPanel />
          </TabsContent>

          <TabsContent value="entries" className="mt-0">
            <UserLabsPanel />
          </TabsContent>

          {panels.length > 0 && selected && (
            <TabsContent value="panels" className="mt-0">
              <EndocrinePanelsCard panels={panels} selected={selected} setSelected={setSelected} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
