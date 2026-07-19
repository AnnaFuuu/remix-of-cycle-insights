import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getMcphasesOverview, type TableCoverage } from "@/lib/mcphases/summary.functions";
import { CheckCircle2, Circle, Clock } from "lucide-react";

const CATEGORY_STYLES: Record<string, string> = {
  sleep: "border-indigo-200 bg-indigo-50 text-indigo-700",
  cardio: "border-rose-200 bg-rose-50 text-rose-700",
  activity: "border-emerald-200 bg-emerald-50 text-emerald-700",
  temperature: "border-amber-200 bg-amber-50 text-amber-700",
  respiratory: "border-cyan-200 bg-cyan-50 text-cyan-700",
  metabolic: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
  endocrine: "border-purple-200 bg-purple-50 text-purple-700",
  demographic: "border-slate-200 bg-slate-50 text-slate-700",
};

export function TableCoverageGrid() {
  const fn = useServerFn(getMcphasesOverview);
  const q = useQuery({ queryKey: ["mcphases", "overview"], queryFn: () => fn(), refetchOnWindowFocus: false });

  const data = q.data;

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold tracking-tight">mcPHASES table coverage</CardTitle>
        <CardDescription className="text-xs">
          Real data ingested from PhysioNet mcPHASES. Populated tables feed the phase-prediction feature builder.
          {data && (
            <span className="ml-2 font-mono text-[10px]">{data.populatedTables}/{data.tables.length} populated · {data.totalRows.toLocaleString()} rows</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted/40" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.tables.map((t) => <CoverageCard key={t.key} t={t} />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CoverageCard({ t }: { t: TableCoverage }) {
  const catStyle = CATEGORY_STYLES[t.category] ?? "border-slate-200 bg-slate-50 text-slate-700";
  return (
    <div className={`rounded-lg border p-3 transition ${t.populated ? "border-emerald-200 bg-emerald-50/40" : "border-border/60 bg-muted/20"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            {t.populated ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : t.status === "active" ? <Clock className="h-3.5 w-3.5 text-muted-foreground" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className="truncate">{t.label}</span>
          </div>
          <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{t.table}</p>
        </div>
        <Badge variant="outline" className={`shrink-0 rounded-full px-1.5 py-0 text-[9px] font-mono ${catStyle}`}>{t.category}</Badge>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1 text-[10px]">
        <div><div className="font-mono text-sm">{t.rows.toLocaleString()}</div><div className="text-muted-foreground">rows</div></div>
        <div><div className="font-mono text-sm">{t.participants}</div><div className="text-muted-foreground">subjects</div></div>
        <div><div className="font-mono text-sm">{t.dayMin !== null && t.dayMax !== null ? `${t.dayMin}–${t.dayMax}` : "—"}</div><div className="text-muted-foreground">days</div></div>
      </div>
      {!t.populated && (
        <div className="mt-2 text-[10px] text-muted-foreground">
          {t.status === "active" ? "Awaiting upload." : "Scaffolded slot."}
        </div>
      )}
    </div>
  );
}