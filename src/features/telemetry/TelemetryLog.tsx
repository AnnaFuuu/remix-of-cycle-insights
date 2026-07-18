import * as React from "react";
import { toast } from "sonner";
import { useHormonalStore } from "@/lib/hormonal/store";
import { PageHeader } from "@/components/hnhh/PageHeader";
import { NLQuickLog } from "@/components/agent/NLQuickLog";
import { useI18n } from "@/lib/i18n";
import { PageSkeleton } from "@/components/hnhh/PageSkeleton";
import { PhaseBadge } from "@/components/hnhh/PhaseBadge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { TelemetryEntry, HormonalPhase } from "@/lib/hormonal/types";
import { computePhase } from "@/lib/hormonal/phase";

function emptyEntry(cycleLength: number, lutealLength: number): TelemetryEntry {
  const date = new Date().toISOString().slice(0, 10);
  const cycleDay = 1;
  return {
    id: "new-" + Math.random().toString(36).slice(2, 8),
    date, cycleDay,
    phase: computePhase(cycleDay, cycleLength, lutealLength),
    subjective: { mood: 6, energy: 6, stress: 4, symptoms: { cramps: 0, fatigue: 0, bloating: 0, headache: 0, nausea: 0, breastTenderness: 0 }, notes: "" },
    objective: { bbt: 36.6, sleepHours: 7, sleepQuality: 7, steps: 7000, restingHR: 64, hrv: 55 },
    biomarkers: { estrogen: null, progesterone: null, lh: null, fsh: null, notes: "" },
    researchConsent: true, anonymized: true,
    createdAt: "", updatedAt: "",
  };
}

export function TelemetryLog() {
  const { ready, entries, profile, upsertEntry, deleteEntry } = useHormonalStore();
  const { t } = useI18n();
  const [editing, setEditing] = React.useState<TelemetryEntry | null>(null);
  const [open, setOpen] = React.useState(false);
  const [filterPhase, setFilterPhase] = React.useState<"all" | HormonalPhase>("all");
  const [filterSymptom, setFilterSymptom] = React.useState<"all" | "with" | "without">("all");

  if (!ready) return <PageSkeleton />;

  const filtered = entries
    .filter((e) => filterPhase === "all" || e.phase === filterPhase)
    .filter((e) => {
      const hasSymptoms = Object.values(e.subjective.symptoms).some((v) => v > 2);
      if (filterSymptom === "with") return hasSymptoms;
      if (filterSymptom === "without") return !hasSymptoms;
      return true;
    })
    .slice().reverse();

  const openNew = () => { setEditing(emptyEntry(profile.cycleLength, profile.lutealLength)); setOpen(true); };
  const openEdit = (e: TelemetryEntry) => { setEditing({ ...e }); setOpen(true); };

  const save = (e: TelemetryEntry) => {
    // validate
    if (!e.date) { toast.error("Date is required"); return; }
    if (e.cycleDay < 1 || e.cycleDay > 60) { toast.error("Cycle day out of range"); return; }
    if (e.objective.bbt != null && (e.objective.bbt < 34 || e.objective.bbt > 40)) { toast.error("BBT unrealistic"); return; }
    upsertEntry({ ...e, phase: computePhase(e.cycleDay, profile.cycleLength, profile.lutealLength) });
    toast.success("Telemetry saved");
    setOpen(false);
  };

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow={t("tel.eyebrow")}
        title={t("tel.title")}
        description={t("tel.desc")}
        actions={
          <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> {t("tel.new")}</Button>
        }
      />

      <div className="px-6 pt-4 sm:px-8"><NLQuickLog /></div>

      <div className="grid grid-cols-1 gap-3 px-6 py-4 sm:flex sm:flex-wrap sm:items-center sm:px-8">
        <div className="flex items-center gap-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("tel.filter.phase")}</Label>
          <Select value={filterPhase} onValueChange={(v) => setFilterPhase(v as typeof filterPhase)}>
            <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All phases</SelectItem>
              <SelectItem value="Menstrual">Menstrual</SelectItem>
              <SelectItem value="Follicular">Follicular</SelectItem>
              <SelectItem value="Ovulatory">Ovulatory</SelectItem>
              <SelectItem value="Luteal">Luteal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("tel.filter.symptoms")}</Label>
          <Select value={filterSymptom} onValueChange={(v) => setFilterSymptom(v as typeof filterSymptom)}>
            <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entries</SelectItem>
              <SelectItem value="with">With symptoms</SelectItem>
              <SelectItem value="without">Without symptoms</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground sm:ml-auto">{filtered.length} of {entries.length} entries</div>
      </div>

      <div className="px-6 sm:px-8">
        <Card className="border-border/60">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Cycle day</TableHead>
                  <TableHead>Phase</TableHead>
                  <TableHead>BBT</TableHead>
                  <TableHead>Mood</TableHead>
                  <TableHead>Sleep</TableHead>
                  <TableHead>Symptoms</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => {
                  const sym = Object.entries(e.subjective.symptoms).filter(([, v]) => v > 2).map(([k]) => k);
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs">{e.date}</TableCell>
                      <TableCell className="tabular-nums">{e.cycleDay}</TableCell>
                      <TableCell><PhaseBadge phase={e.phase} /></TableCell>
                      <TableCell className="tabular-nums">{e.objective.bbt?.toFixed(2) ?? "-"}°</TableCell>
                      <TableCell className="tabular-nums">{e.subjective.mood}/10</TableCell>
                      <TableCell className="tabular-nums">{e.objective.sleepHours?.toFixed(1) ?? "-"}h</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{sym.length ? sym.slice(0, 3).join(", ") : "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { deleteEntry(e.id); toast.success("Entry removed"); }}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          {editing && (
            <EntryForm key={editing.id} entry={editing} onSubmit={save} onCancel={() => setOpen(false)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EntryForm({ entry, onSubmit, onCancel }: { entry: TelemetryEntry; onSubmit: (e: TelemetryEntry) => void; onCancel: () => void }) {
  const [e, setE] = React.useState<TelemetryEntry>(entry);
  const upd = <K extends keyof TelemetryEntry>(k: K, v: TelemetryEntry[K]) => setE((x) => ({ ...x, [k]: v }));
  const updSub = <K extends keyof TelemetryEntry["subjective"]>(k: K, v: TelemetryEntry["subjective"][K]) =>
    setE((x) => ({ ...x, subjective: { ...x.subjective, [k]: v } }));
  const updSym = (k: keyof TelemetryEntry["subjective"]["symptoms"], v: number) =>
    setE((x) => ({ ...x, subjective: { ...x.subjective, symptoms: { ...x.subjective.symptoms, [k]: v } } }));
  const updObj = <K extends keyof TelemetryEntry["objective"]>(k: K, v: TelemetryEntry["objective"][K]) =>
    setE((x) => ({ ...x, objective: { ...x.objective, [k]: v } }));
  const updBio = <K extends keyof TelemetryEntry["biomarkers"]>(k: K, v: TelemetryEntry["biomarkers"][K]) =>
    setE((x) => ({ ...x, biomarkers: { ...x.biomarkers, [k]: v } }));

  const numOrNull = (s: string): number | null => (s === "" ? null : Number(s));

  return (
    <>
      <DialogHeader>
        <DialogTitle>Telemetry entry</DialogTitle>
        <DialogDescription>Capture subjective, objective, and biomarker data for a single day.</DialogDescription>
      </DialogHeader>
      <div className="max-h-[65vh] space-y-6 overflow-y-auto pr-2">
        <section>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={e.date} onChange={(ev) => upd("date", ev.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Cycle day</Label>
              <Input type="number" min={1} max={45} value={e.cycleDay} onChange={(ev) => upd("cycleDay", Number(ev.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Phase (auto)</Label>
              <div className="pt-2"><PhaseBadge phase={e.phase} /></div>
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">A · Subjective</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(["mood", "energy", "stress"] as const).map((k) => (
              <div key={k}>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="capitalize text-xs">{k}</Label>
                  <span className="text-xs font-mono tabular-nums">{e.subjective[k]}/10</span>
                </div>
                <Slider min={1} max={10} step={1} value={[e.subjective[k]]} onValueChange={([v]) => updSub(k, v)} />
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(Object.keys(e.subjective.symptoms) as (keyof TelemetryEntry["subjective"]["symptoms"])[]).map((k) => (
              <div key={k}>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-xs capitalize">{k.replace(/([A-Z])/g, " $1")}</Label>
                  <span className="text-xs font-mono tabular-nums">{e.subjective.symptoms[k]}</span>
                </div>
                <Slider min={0} max={10} step={1} value={[e.subjective.symptoms[k]]} onValueChange={([v]) => updSym(k, v)} />
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={e.subjective.notes} onChange={(ev) => updSub("notes", ev.target.value)} />
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">B · Objective</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <NumField label="BBT (°C)" v={e.objective.bbt} step="0.01" onChange={(v) => updObj("bbt", v)} />
            <NumField label="Sleep (h)" v={e.objective.sleepHours} step="0.1" onChange={(v) => updObj("sleepHours", v)} />
            <NumField label="Sleep quality" v={e.objective.sleepQuality} step="1" onChange={(v) => updObj("sleepQuality", v)} />
            <NumField label="Steps" v={e.objective.steps} step="100" onChange={(v) => updObj("steps", v)} />
            <NumField label="Resting HR" v={e.objective.restingHR} step="1" onChange={(v) => updObj("restingHR", v)} />
            <NumField label="HRV (ms)" v={e.objective.hrv} step="1" onChange={(v) => updObj("hrv", v)} />
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">C · Biomarker overrides</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <NumField label="Estrogen (pg/mL)" v={e.biomarkers.estrogen} step="0.1" onChange={(v) => updBio("estrogen", v)} />
            <NumField label="Progesterone (ng/mL)" v={e.biomarkers.progesterone} step="0.01" onChange={(v) => updBio("progesterone", v)} />
            <NumField label="LH (mIU/mL)" v={e.biomarkers.lh} step="0.1" onChange={(v) => updBio("lh", v)} />
            <NumField label="FSH (mIU/mL)" v={e.biomarkers.fsh} step="0.1" onChange={(v) => updBio("fsh", v)} />
          </div>
          <div className="mt-3">
            <Label className="text-xs">Biomarker notes</Label>
            <Input value={e.biomarkers.notes} onChange={(ev) => updBio("notes", ev.target.value)} />
          </div>
        </section>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSubmit(e)}>Save entry</Button>
      </DialogFooter>
    </>
  );
}

function NumField({ label, v, step, onChange }: { label: string; v: number | null; step: string; onChange: (v: number | null) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        step={step}
        value={v == null ? "" : v}
        onChange={(ev) => onChange(ev.target.value === "" ? null : Number(ev.target.value))}
      />
    </div>
  );
}