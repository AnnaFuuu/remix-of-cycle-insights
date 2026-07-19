import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMcphasesOverview } from "@/lib/mcphases/summary.functions";

export function IngestRunsTable() {
  const fn = useServerFn(getMcphasesOverview);
  const q = useQuery({ queryKey: ["mcphases", "overview"], queryFn: () => fn(), refetchOnWindowFocus: false });
  const runs = q.data?.runs ?? [];

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold tracking-tight">Ingest history</CardTitle>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No ingest runs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-border/60 text-left text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">When</th>
                  <th className="py-1.5 pr-3 font-medium">Table</th>
                  <th className="py-1.5 pr-3 font-medium">File</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Rows</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Subjects</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Skipped</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {runs.map((r) => (
                  <tr key={r.id} className="border-b border-border/20">
                    <td className="py-1.5 pr-3">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="py-1.5 pr-3">{r.table_name}</td>
                    <td className="py-1.5 pr-3 truncate max-w-[220px]">{r.filename ?? "—"}</td>
                    <td className="py-1.5 pr-3 text-right">{r.rows_inserted.toLocaleString()}</td>
                    <td className="py-1.5 pr-3 text-right">{r.participants}</td>
                    <td className="py-1.5 pr-3 text-right">{r.rows_skipped}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}