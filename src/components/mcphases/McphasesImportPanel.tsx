import * as React from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, Database } from "lucide-react";
import { MCPHASES_TABLES } from "@/lib/mcphases/registry";
import { ingestMcphasesCsv } from "@/lib/mcphases/ingest.functions";

export function McphasesImportPanel({ onIngested }: { onIngested?: () => void }) {
  const [tableKey, setTableKey] = React.useState<string>("sleep_score");
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<{ headers: string[]; rows: Record<string, string>[]; total: number } | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [result, setResult] = React.useState<{ inserted: number; skipped: number; participants: number; totalRows: number } | null>(null);
  const ingest = useServerFn(ingestMcphasesCsv);
  const spec = MCPHASES_TABLES.find((t) => t.key === tableKey)!;

  const onFile = async (f: File | null) => {
    setFile(f); setPreview(null); setResult(null);
    if (!f) return;
    const text = await f.slice(0, 32 * 1024).text();
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
    const headers = parsed.meta.fields ?? [];
    setPreview({ headers, rows: (parsed.data ?? []).slice(0, 5), total: parsed.data.length });
  };

  const submit = async () => {
    if (!file) return;
    if (spec.status !== "active") { toast.error(`${spec.label} is a scaffolded slot — column mapping not yet wired.`); return; }
    setUploading(true);
    try {
      const csvText = await file.text();
      const res = await ingest({ data: { tableKey, csvText, filename: file.name } });
      setResult(res);
      toast.success(`Ingested ${res.inserted} rows into ${spec.label} (${res.participants} participants).`);
      onIngested?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Upload failed: ${message}`);
    } finally { setUploading(false); }
  };

  const mappedHeaders = new Set(spec.csvColumns.map((c) => c.csv));
  const matched = preview ? preview.headers.filter((h) => mappedHeaders.has(h)).length : 0;
  const expected = spec.csvColumns.length;

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <Database className="h-4 w-4 text-primary" />
          Import mcPHASES CSV
        </CardTitle>
        <CardDescription className="text-xs">
          Upload one PhysioNet mcPHASES table at a time. Every table from the study README is registered — active ones ingest end-to-end; scaffolded slots reserve their schema until the mapping is enabled.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Target table</label>
            <Select value={tableKey} onValueChange={setTableKey}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-[360px]">
                {MCPHASES_TABLES.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    <span className="flex items-center gap-2">
                      <span>{t.label}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-mono ${t.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{t.status}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-muted-foreground">{spec.description}</p>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">CSV file</label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              className="block w-full cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-xs file:mr-3 file:rounded file:border-0 file:bg-primary file:px-2 file:py-1 file:text-xs file:text-primary-foreground"
            />
            {file && (
              <p className="mt-1 text-[11px] text-muted-foreground">{file.name} · {(file.size / 1024).toFixed(1)} KB</p>
            )}
          </div>
        </div>

        {preview && (
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Preview · first 5 rows of ~{preview.total}</span>
              {spec.status === "active" && (
                <Badge variant="outline" className={`font-mono text-[10px] ${matched === expected ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                  {matched}/{expected} columns mapped
                </Badge>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border/40 text-left">
                    {preview.headers.slice(0, 10).map((h) => (
                      <th key={h} className={`px-2 py-1 font-mono ${mappedHeaders.has(h) ? "text-emerald-700" : "text-muted-foreground"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, i) => (
                    <tr key={i} className="border-b border-border/20">
                      {preview.headers.slice(0, 10).map((h) => (
                        <td key={h} className="px-2 py-1 font-mono">{String(row[h] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button onClick={submit} disabled={!file || uploading || spec.status !== "active"} className="gap-2">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Ingesting…" : `Ingest into ${spec.label}`}
          </Button>
          {spec.status !== "active" && (
            <span className="text-[11px] text-muted-foreground">This slot is scaffolded — schema is ready, column mapping activates once you upload it.</span>
          )}
        </div>

        {result && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-900">
            <div className="font-semibold">Ingest complete</div>
            <div className="mt-1 font-mono text-[11px]">
              inserted {result.inserted} / parsed {result.totalRows} · {result.participants} participants · {result.skipped} skipped
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}