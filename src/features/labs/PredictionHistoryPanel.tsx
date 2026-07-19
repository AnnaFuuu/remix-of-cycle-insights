import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  listPredictions, deletePrediction, savePrediction,
  readLocalPredictions, writeLocalPredictions, markLocalSynced,
  type LocalPrediction, type StoredPrediction,
} from "@/lib/predictions/prediction-history.functions";
import { getOwnerId } from "@/lib/owner-id";
import { Cloud, CloudUpload, HardDrive, Sparkles, Trash2, Wand2 } from "lucide-react";

export function PredictionHistoryPanel() {
  const ownerId = React.useMemo(() => getOwnerId(), []);
  const qc = useQueryClient();
  const list = useServerFn(listPredictions);
  const save = useServerFn(savePrediction);
  const del = useServerFn(deletePrediction);

  const cloud = useQuery({
    queryKey: ["prediction-history", ownerId],
    queryFn: () => list({ data: { ownerId } }),
    refetchOnWindowFocus: false,
  });

  const [local, setLocal] = React.useState<LocalPrediction[]>(() => readLocalPredictions());
  React.useEffect(() => {
    const onStorage = () => setLocal(readLocalPredictions());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const syncMut = useMutation({
    mutationFn: async (p: LocalPrediction) => {
      const saved = await save({ data: {
        ownerId,
        predictedAt: p.predicted_at,
        inputs: p.inputs as unknown as Record<string, number | null>,
        phase: p.result.phase,
        confidence: p.result.confidence,
        probabilities: p.result.probabilities,
        imputed: p.result.imputed ?? {},
      } });
      markLocalSynced(p.id, saved.id);
      setLocal(readLocalPredictions());
      return saved;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prediction-history", ownerId] }),
  });

  const deleteLocal = (id: string) => {
    const filtered = readLocalPredictions().filter((p) => p.id !== id);
    writeLocalPredictions(filtered);
    setLocal(filtered);
  };
  const deleteCloud = useMutation({
    mutationFn: (id: string) => del({ data: { ownerId, id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prediction-history", ownerId] }),
  });

  const cloudById = new Map((cloud.data ?? []).map((c) => [c.id, c]));

  // Merge: show local entries first (with sync status); then any cloud-only rows.
  const localSyncedIds = new Set(local.map((l) => l.synced_id).filter(Boolean) as string[]);
  const cloudOnly = (cloud.data ?? []).filter((c) => !localSyncedIds.has(c.id));

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Prediction history</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Every Dashboard prediction is kept locally on this device. You may sync any
            prediction to the cloud database; on sync we look up the nearest lab report and
            compare the predicted vs measured LH / estradiol so you can see how the model did.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {local.length === 0 && cloudOnly.length === 0 && (
            <p className="rounded-md border border-dashed border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
              No predictions yet. Run a prediction on the Dashboard to populate this history.
            </p>
          )}

          {local.map((p) => (
            <LocalRow
              key={p.id}
              p={p}
              cloudRow={p.synced_id ? cloudById.get(p.synced_id) ?? null : null}
              syncBusy={syncMut.isPending && syncMut.variables?.id === p.id}
              onSync={() => syncMut.mutate(p)}
              onDelete={() => deleteLocal(p.id)}
            />
          ))}

          {cloudOnly.map((c) => (
            <CloudRow key={c.id} c={c} onDelete={() => deleteCloud.mutate(c.id)} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function InputChips({ inputs, imputed }: { inputs: Record<string, unknown>; imputed: { lh?: number; estradiol?: number } }) {
  const entries = Object.entries(inputs)
    .filter(([, v]) => v !== null && v !== undefined && v !== "" && !Number.isNaN(Number(v)))
    .map(([k, v]) => [k, Number(v)] as const);
  return (
    <div className="flex flex-wrap gap-1 text-[10px]">
      {entries.map(([k, v]) => (
        <span key={k} className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono">
          {k}=<span className="tabular-nums">{v}</span>
        </span>
      ))}
      {imputed.lh !== undefined && (
        <span className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-primary">
          <Wand2 className="mr-0.5 inline h-2.5 w-2.5" /> LH≈{imputed.lh}
        </span>
      )}
      {imputed.estradiol !== undefined && (
        <span className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-primary">
          <Wand2 className="mr-0.5 inline h-2.5 w-2.5" /> E₂≈{imputed.estradiol}
        </span>
      )}
    </div>
  );
}

function LocalRow({
  p, cloudRow, syncBusy, onSync, onDelete,
}: {
  p: LocalPrediction;
  cloudRow: StoredPrediction | null;
  syncBusy: boolean;
  onSync: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-lg border border-border/60">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {p.synced_id ? <Cloud className="mr-1 h-3 w-3" /> : <HardDrive className="mr-1 h-3 w-3" />}
            {p.synced_id ? "Local + Cloud" : "Local only"}
          </Badge>
          <span className="font-mono text-[11px] text-muted-foreground">{new Date(p.predicted_at).toLocaleString()}</span>
          <span className="text-sm font-semibold">{p.result.phase}</span>
          <Badge variant="secondary" className="text-[10px]">{(p.result.confidence * 100).toFixed(1)}%</Badge>
        </div>
        <div className="flex items-center gap-1">
          {!p.synced_id && (
            <Button size="sm" variant="secondary" onClick={onSync} disabled={syncBusy}>
              <CloudUpload className="mr-1 h-3.5 w-3.5" />
              {syncBusy ? "Syncing…" : "Sync to cloud"}
            </Button>
          )}
          <ConfirmDelete onConfirm={onDelete} label={p.synced_id ? "Delete local copy" : "Delete"} />
        </div>
      </div>
      <div className="space-y-2 px-3 py-2">
        <InputChips inputs={p.inputs as unknown as Record<string, unknown>} imputed={p.result.imputed ?? {}} />
        {cloudRow && (
          <ComparisonBlock cloudRow={cloudRow} imputed={p.result.imputed ?? {}} />
        )}
      </div>
    </div>
  );
}

function CloudRow({ c, onDelete }: { c: StoredPrediction; onDelete: () => void }) {
  return (
    <div className="rounded-lg border border-border/60">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]"><Cloud className="mr-1 h-3 w-3" /> Cloud only</Badge>
          <span className="font-mono text-[11px] text-muted-foreground">{new Date(c.predicted_at).toLocaleString()}</span>
          <span className="text-sm font-semibold">{c.phase}</span>
          <Badge variant="secondary" className="text-[10px]">{(c.confidence * 100).toFixed(1)}%</Badge>
        </div>
        <ConfirmDelete onConfirm={onDelete} label="Delete" />
      </div>
      <div className="space-y-2 px-3 py-2">
        <InputChips inputs={c.inputs as unknown as Record<string, unknown>} imputed={c.imputed} />
        <ComparisonBlock cloudRow={c} imputed={c.imputed} />
      </div>
    </div>
  );
}

function ComparisonBlock({ cloudRow, imputed }: { cloudRow: StoredPrediction; imputed: { lh?: number; estradiol?: number } }) {
  if (!cloudRow.matched_lab_report_id) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-muted/20 p-2 text-[11px] text-muted-foreground">
        No nearby lab report matched. Upload one on the Exam calendar tab within ±60 days of this prediction to enable comparison.
      </div>
    );
  }
  return (
    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 text-[11px]">
      <div className="mb-1 font-medium text-emerald-800 dark:text-emerald-200">Matched to lab report</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="LH imputed" value={imputed.lh} />
        <Metric label="LH measured" value={cloudRow.actual_lh ?? undefined} />
        <Metric label="E₂ imputed" value={imputed.estradiol} />
        <Metric label="E₂ measured" value={cloudRow.actual_estradiol ?? undefined} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value?: number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm tabular-nums">{value ?? "—"}</div>
    </div>
  );
}

function ConfirmDelete({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}?</AlertDialogTitle>
          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
