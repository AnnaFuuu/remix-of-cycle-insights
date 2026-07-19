import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Upload, ShieldCheck, Trash2, FileText, ExternalLink, Sparkles, Eye, EyeOff } from "lucide-react";
import {
  uploadLabReport, listLabReports, deleteLabReport, signLabReport, getLabReportPii,
  type LabReportRow, type PiiFields,
} from "@/lib/labs/lab-reports.functions";
import { getOwnerId } from "@/lib/owner-id";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = reader.result as string;
      const idx = s.indexOf(",");
      resolve(idx >= 0 ? s.slice(idx + 1) : s);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ExamCalendar() {
  const ownerId = React.useMemo(() => getOwnerId(), []);
  const qc = useQueryClient();
  const list = useServerFn(listLabReports);
  const upload = useServerFn(uploadLabReport);
  const del = useServerFn(deleteLabReport);

  const reports = useQuery({
    queryKey: ["lab-reports", ownerId],
    queryFn: () => list({ data: { ownerId } }),
    refetchOnWindowFocus: false,
  });

  const reportsByDate = React.useMemo(() => {
    const m = new Map<string, LabReportRow[]>();
    for (const r of reports.data ?? []) {
      const arr = m.get(r.report_date) ?? [];
      arr.push(r);
      m.set(r.report_date, arr);
    }
    return m;
  }, [reports.data]);

  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(undefined);
  const selectedKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const selectedReports = (selectedKey && reportsByDate.get(selectedKey)) || [];

  const uploadMut = useMutation({
    mutationFn: async (input: { file: File; reportDateHint?: string }) => {
      const b64 = await fileToBase64(input.file);
      return upload({ data: {
        ownerId, filename: input.file.name, mime: input.file.type || "application/pdf",
        fileBase64: b64, reportDateHint: input.reportDateHint,
      } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lab-reports", ownerId] }),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { ownerId, id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lab-reports", ownerId] }),
  });

  const modifiers = React.useMemo(() => ({
    hasReport: Array.from(reportsByDate.keys()).map((d) => parseISO(d)),
  }), [reportsByDate]);

  return (
    <div className="space-y-4">
      <Alert className="border-primary/20 bg-primary/5">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <AlertTitle className="text-sm">Privacy-first extraction</AlertTitle>
        <AlertDescription className="text-xs">
          Reports upload to a private storage bucket. On the server, AI extracts the biomarker
          values and separates identifying fields (name, id number, hospital, doctor), which are
          then encrypted with AES-256-GCM before being written to the database. Only the
          encrypted blob is stored; the plaintext PII never lands on disk.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Exam calendar</CardTitle>
                <CardDescription>Dates with uploaded reports are marked.</CardDescription>
              </div>
              <UploadDialog
                busy={uploadMut.isPending}
                onSubmit={(file, hint) => uploadMut.mutateAsync({ file, reportDateHint: hint })}
                initialDate={selectedDate}
              />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              modifiers={modifiers}
              modifiersClassNames={{ hasReport: "bg-primary/15 text-primary font-semibold ring-1 ring-primary/30 rounded-md" }}
            />
            {uploadMut.error && (
              <div className="w-full rounded-md border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive">
                {(uploadMut.error as Error).message}
              </div>
            )}
            {uploadMut.data && (
              <div className="w-full rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 text-[11px]">
                Extracted <span className="font-mono">{uploadMut.data.biomarker_count}</span> biomarkers ·{" "}
                {uploadMut.data.pii_present ? "PII encrypted" : "no PII found"} · report_date{" "}
                <span className="font-mono">{uploadMut.data.report_date}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {selectedKey ? `Reports on ${selectedKey}` : "Select a date"}
            </CardTitle>
            <CardDescription>
              {reports.isLoading ? "Loading…" :
                `${reports.data?.length ?? 0} total report(s) across ${reportsByDate.size} date(s).`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedReports.length === 0 && (
              <p className="rounded-md border border-dashed border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
                {selectedKey
                  ? "No reports on this date. Pick another date or upload one."
                  : "Pick a date on the calendar to view its reports."}
              </p>
            )}
            {selectedReports.map((r) => (
              <ReportCard key={r.id} r={r} ownerId={ownerId} onDelete={() => delMut.mutate(r.id)} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function UploadDialog({
  onSubmit, busy, initialDate,
}: {
  onSubmit: (file: File, dateHint?: string) => Promise<unknown>;
  busy: boolean;
  initialDate?: Date;
}) {
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [dateHint, setDateHint] = React.useState<string>(
    initialDate ? format(initialDate, "yyyy-MM-dd") : "",
  );
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (initialDate) setDateHint(format(initialDate, "yyyy-MM-dd"));
  }, [initialDate]);

  const submit = async () => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB > 8 MB).`);
      return;
    }
    setError(null);
    try {
      await onSubmit(file, dateHint || undefined);
      setOpen(false); setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Upload className="mr-1.5 h-3.5 w-3.5" /> Upload report</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload lab report</DialogTitle>
          <DialogDescription>PDF, PNG, JPG or WEBP · up to 8 MB. AI will extract biomarkers server-side.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">File</Label>
            <Input type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <Label className="text-xs">Report date (optional — override AI)</Label>
            <Input type="date" value={dateHint} onChange={(e) => setDateHint(e.target.value)} />
          </div>
          {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!file || busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Upload & extract
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReportCard({ r, ownerId, onDelete }: { r: LabReportRow; ownerId: string; onDelete: () => void }) {
  const sign = useServerFn(signLabReport);
  const pii = useServerFn(getLabReportPii);
  const [signBusy, setSignBusy] = React.useState(false);
  const [piiOpen, setPiiOpen] = React.useState(false);
  const [piiData, setPiiData] = React.useState<PiiFields | null>(null);
  const [piiBusy, setPiiBusy] = React.useState(false);

  const openFile = async () => {
    setSignBusy(true);
    try {
      const s = await sign({ data: { ownerId, id: r.id } });
      if (s?.url) window.open(s.url, "_blank", "noopener");
    } finally { setSignBusy(false); }
  };

  const togglePii = async () => {
    if (piiOpen) { setPiiOpen(false); return; }
    setPiiBusy(true);
    try {
      const p = await pii({ data: { ownerId, id: r.id } });
      setPiiData(p); setPiiOpen(true);
    } finally { setPiiBusy(false); }
  };

  return (
    <div className="rounded-lg border border-border/60">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">{r.source_filename}</span>
          <Badge variant="outline" className="text-[10px]">{r.extracted.length} biomarkers</Badge>
          {r.pii && <Badge variant="outline" className="border-primary/40 text-[10px] text-primary">PII encrypted</Badge>}
          {r.ai_model && <Badge variant="outline" className="text-[10px] font-mono">{r.ai_model.split("/")[1] ?? r.ai_model}</Badge>}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={openFile} disabled={signBusy}>
            {signBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
            <span className="ml-1 text-xs">Original</span>
          </Button>
          {r.pii && (
            <Button size="sm" variant="ghost" onClick={togglePii} disabled={piiBusy}>
              {piiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
                piiOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              <span className="ml-1 text-xs">PII</span>
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this report?</AlertDialogTitle>
                <AlertDialogDescription>
                  The original file and its encrypted PII will be permanently removed. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {piiOpen && piiData && (
        <div className="border-b border-border/60 bg-amber-500/5 px-3 py-2 text-[11px]">
          <div className="mb-1 font-medium text-amber-800 dark:text-amber-200">Decrypted PII (session-only, not cached)</div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            {(["name", "id_number", "hospital", "doctor", "other"] as const).map((k) =>
              piiData[k] ? (
                <div key={k}><dt className="inline text-muted-foreground">{k}: </dt><dd className="inline font-mono">{piiData[k]}</dd></div>
              ) : null,
            )}
          </dl>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/20 text-muted-foreground">
            <tr className="text-left">
              <th className="px-3 py-1.5 font-medium">Analyte</th>
              <th className="px-3 py-1.5 text-right font-medium">Value</th>
              <th className="px-3 py-1.5 font-medium">Unit</th>
              <th className="px-3 py-1.5 font-medium">Reference</th>
              <th className="px-3 py-1.5 font-medium">Flag</th>
            </tr>
          </thead>
          <tbody>
            {r.extracted.map((b, i) => (
              <tr key={i} className="border-t border-border/40">
                <td className="px-3 py-1.5">{b.name}</td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums">{b.value ?? "—"}</td>
                <td className="px-3 py-1.5 font-mono text-muted-foreground">{b.unit ?? "—"}</td>
                <td className="px-3 py-1.5 font-mono text-muted-foreground">{b.reference_range ?? "—"}</td>
                <td className="px-3 py-1.5">
                  {b.flag ? (
                    <span className={
                      "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono " +
                      (b.flag === "H" ? "bg-red-100 text-red-700 border-red-200"
                        : b.flag === "L" ? "bg-amber-100 text-amber-700 border-amber-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200")
                    }>{b.flag}</span>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border/40 bg-muted/20 px-3 py-1 text-[10px] text-muted-foreground">
        <Sparkles className="mr-1 inline h-3 w-3" /> Extracted server-side · original stored privately · PII encrypted with AES-256-GCM
      </div>
    </div>
  );
}
