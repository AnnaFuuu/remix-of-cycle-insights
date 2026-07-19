import * as React from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  autoMapHeaders,
  projectRows,
  FIELD_LABELS,
  type FieldKey,
  type SleepRow,
  type DatasetSummary,
  type AggregateStats,
} from "@/lib/physionet/mapping";
import {
  importSleepCsv,
  listSleepDatasets,
  getSleepStats,
  deleteSleepDataset,
} from "@/lib/physionet/sleep.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, Database, Trash2, FileText, CheckCircle2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Props {
  variant: "import" | "quality";
}

const FIELDS: FieldKey[] = [
  "subject_id","recording_date","night_index","total_sleep_min","deep_min","light_min","rem_min","awake_min","sleep_efficiency","latency_min","waso_min","quality_score",
];

export function SleepDatasetsPanel({ variant }: Props) {
  const listFn = useServerFn(listSleepDatasets);
  const importFn = useServerFn(importSleepCsv);
  const statsFn = useServerFn(getSleepStats);
  const deleteFn = useServerFn(deleteSleepDataset);

  const [datasets, setDatasets] = React.useState<DatasetSummary[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [stats, setStats] = React.useState<AggregateStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [statsLoading, setStatsLoading] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listFn();
      setDatasets(rows);
      if (rows.length && !selectedId) setSelectedId(rows[0].id);
      if (!rows.length) { setSelectedId(null); setStats(null); }
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  }, [listFn, selectedId]);

  React.useEffect(() => { refresh(); }, [refresh]);

  React.useEffect(() => {
    if (!selectedId) return;
    setStatsLoading(true);
    statsFn({ data: { datasetId: selectedId } })
      .then(setStats)
      .catch((e) => { toast.error("Stats failed"); console.error(e); })
      .finally(() => setStatsLoading(false));
  }, [selectedId, statsFn]);

  // ---- Import state (only in "import" variant) ----
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [parsedRows, setParsedRows] = React.useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = React.useState<Partial<Record<FieldKey, string>>>({});
  const [meta, setMeta] = React.useState({ slug: "", name: "", description: "", citation: "", source_url: "" });
  const [uploading, setUploading] = React.useState(false);

  const onFile = (file: File) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (res) => {
        const fields = (res.meta.fields ?? []) as string[];
        setHeaders(fields);
        setParsedRows(res.data);
        setMapping(autoMapHeaders(fields));
        setMeta((m) => ({
          ...m,
          slug: m.slug || file.name.toLowerCase().replace(/\.csv$|\.tsv$/i, "").replace(/[^a-z0-9]+/g, "-").slice(0, 60),
          name: m.name || file.name.replace(/\.csv$|\.tsv$/i, ""),
        }));
        toast.success(`Parsed ${res.data.length} rows · ${fields.length} columns`);
      },
      error: (err) => toast.error(`Parse failed: ${err.message}`),
    });
  };

  const projected: SleepRow[] = React.useMemo(
    () => (parsedRows.length ? projectRows(parsedRows, mapping) : []),
    [parsedRows, mapping],
  );

  const upload = async () => {
    if (!meta.slug || !meta.name) return toast.error("Slug and name are required");
    if (!mapping.subject_id) return toast.error("Map the Subject ID column");
    setUploading(true);
    try {
      const res = await importFn({ data: { meta, rows: projected } });
      toast.success(`Imported ${res.inserted} rows · ${res.subjects} subjects`);
      setHeaders([]); setParsedRows([]); setMapping({});
      setMeta({ slug: "", name: "", description: "", citation: "", source_url: "" });
      setSelectedId(res.datasetId);
      await refresh();
    } catch (e) {
      toast.error(`Import failed: ${(e as Error).message}`);
    } finally { setUploading(false); }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this dataset and all its records?")) return;
    await deleteFn({ data: { datasetId: id } });
    toast.success("Dataset removed");
    if (selectedId === id) { setSelectedId(null); setStats(null); }
    await refresh();
  };

  const selected = datasets.find((d) => d.id === selectedId);

  return (
    <div className="space-y-6">
      {variant === "import" && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4 text-primary" /> Import PhysioNet sleep CSV
            </CardTitle>
            <CardDescription>
              Upload a per-night summary CSV (Sleep-EDF, SHHS, MESA, or any per-record export). Columns are auto-mapped; unknown columns are preserved in <code className="font-mono">raw</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Input
                type="file"
                accept=".csv,.tsv,text/csv,text/tab-separated-values"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                className="max-w-sm"
              />
              {headers.length > 0 && (
                <Badge variant="outline" className="rounded-full font-mono text-[10px]">
                  {parsedRows.length} rows · {headers.length} cols
                </Badge>
              )}
            </div>

            {headers.length > 0 && (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <Label className="text-xs">Slug *</Label>
                    <Input value={meta.slug} onChange={(e) => setMeta({ ...meta, slug: e.target.value })} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Display name *</Label>
                    <Input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Source URL</Label>
                    <Input value={meta.source_url} onChange={(e) => setMeta({ ...meta, source_url: e.target.value })} className="h-8" placeholder="https://physionet.org/content/..." />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <Label className="text-xs">Citation</Label>
                    <Input value={meta.citation} onChange={(e) => setMeta({ ...meta, citation: e.target.value })} className="h-8" placeholder="Kemp et al., 2000. Analysis of a sleep-dependent neuronal feedback loop." />
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold text-foreground">Column mapping</div>
                  <div className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-3">
                    {FIELDS.map((f) => (
                      <div key={f} className="flex items-center gap-2 text-xs">
                        <span className="w-40 shrink-0 text-muted-foreground">
                          {FIELD_LABELS[f]} {f === "subject_id" && <span className="text-red-500">*</span>}
                        </span>
                        <Select
                          value={mapping[f] ?? "__none__"}
                          onValueChange={(v) => setMapping({ ...mapping, [f]: v === "__none__" ? undefined : v })}
                        >
                          <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue placeholder="— none —" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— none —</SelectItem>
                            {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border bg-secondary/30 p-3 text-xs">
                  <span className="text-muted-foreground">
                    Preview: {projected.length} rows · sample subject <span className="font-mono">{projected[0]?.subject_id ?? "—"}</span>
                    {projected[0]?.total_sleep_min != null && <> · TST {projected[0].total_sleep_min}m</>}
                  </span>
                  <Button size="sm" onClick={upload} disabled={uploading} className="gap-1">
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Import into Cloud
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4 text-primary" /> PhysioNet datasets
              <Badge variant="outline" className="rounded-full border-emerald-300 bg-emerald-50 text-[10px] text-emerald-700">Real data</Badge>
            </CardTitle>
            <CardDescription>Stored in Lovable Cloud · publicly readable · {datasets.length} dataset(s)</CardDescription>
          </div>
          <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Refresh"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {!datasets.length ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
              <FileText className="mx-auto mb-2 h-5 w-5" />
              No datasets yet. {variant === "import" ? "Upload a CSV above to get started." : "Go to Research Portal → Import to upload a CSV."}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {datasets.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedId(d.id)}
                    className={`rounded-lg border p-3 text-left transition ${d.id === selectedId ? "border-primary bg-primary/5" : "hover:bg-secondary/50"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">{d.name}</div>
                      {variant === "import" && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); onDelete(d.id); }}
                          className="text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-1 font-mono text-[11px] text-muted-foreground">
                      <span>records</span><span className="text-right tabular-nums">{d.row_count.toLocaleString()}</span>
                      <span>subjects</span><span className="text-right tabular-nums">{d.subjects_count ?? "—"}</span>
                      <span>variables</span><span className="text-right tabular-nums">{d.variables_count ?? "—"}</span>
                    </div>
                    {d.citation && <div className="mt-1 line-clamp-2 text-[10px] italic text-muted-foreground">{d.citation}</div>}
                  </button>
                ))}
              </div>

              {selected && (
                <div className="rounded-lg border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">{selected.name}</div>
                      {selected.source_url && (
                        <a href={selected.source_url} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline">
                          {selected.source_url}
                        </a>
                      )}
                    </div>
                    {statsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  </div>

                  {stats && (
                    <>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <StatTile label="Records" value={stats.nRecords.toLocaleString()} />
                        <StatTile label="Subjects" value={String(stats.nSubjects)} />
                        <StatTile label="Mean TST (min)" value={stats.meanTST != null ? stats.meanTST.toFixed(0) : "—"} />
                        <StatTile label="Mean SE (%)" value={stats.meanSE != null ? stats.meanSE.toFixed(1) : "—"} />
                      </div>

                      {variant === "quality" && (
                        <div className="mt-4">
                          <div className="mb-2 text-xs font-semibold">Field completeness</div>
                          <div className="space-y-1">
                            {FIELDS.map((f) => (
                              <div key={f} className="grid grid-cols-[180px_1fr_50px] items-center gap-2 text-[11px]">
                                <span className="text-muted-foreground">{FIELD_LABELS[f]}</span>
                                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                                  <div className="h-full bg-primary" style={{ width: `${Math.round(stats.completeness[f] * 100)}%` }} />
                                </div>
                                <span className="text-right font-mono tabular-nums">{Math.round(stats.completeness[f] * 100)}%</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 text-[11px] text-muted-foreground">
                            Coverage: <span className="font-mono">{stats.dateStart ?? "—"}</span> → <span className="font-mono">{stats.dateEnd ?? "—"}</span>
                          </div>
                        </div>
                      )}

                      {variant === "import" && stats.qualityBins.length > 0 && (
                        <div className="mt-4 h-[200px]">
                          <div className="mb-2 text-xs font-semibold">Sleep quality distribution</div>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.qualityBins} margin={{ top: 5, right: 20, bottom: 0, left: 0 }}>
                              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                              <XAxis dataKey="bin" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                              <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} width={30} />
                              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", fontSize: 12 }} />
                              <Bar dataKey="count" fill="var(--chart-2)" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-secondary/30 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg tabular-nums">{value}</div>
    </div>
  );
}
