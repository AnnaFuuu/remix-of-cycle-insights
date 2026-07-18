import * as React from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bot, Sparkles, Check, X, Loader2 } from "lucide-react";
import { parseEntryFromText, type EntryDraft } from "@/lib/agent/actions.functions";
import { useHormonalStore } from "@/lib/hormonal/store";
import { computePhase } from "@/lib/hormonal/phase";
import type { TelemetryEntry } from "@/lib/hormonal/types";

export function NLQuickLog() {
  const { profile, upsertEntry, entries } = useHormonalStore();
  const parse = useServerFn(parseEntryFromText);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [draft, setDraft] = React.useState<EntryDraft | null>(null);

  const run = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const result = await parse({ data: { text: text.trim() } });
      setDraft(result);
    } catch (err) {
      toast.error("Copilot couldn't parse that entry");
      console.error(err);
    } finally { setBusy(false); }
  };

  const approve = () => {
    if (!draft) return;
    const date = draft.date ?? new Date().toISOString().slice(0, 10);
    // derive cycle day from most recent entry or fallback
    const anchor = entries[entries.length - 1];
    const anchorDate = anchor ? anchor.date : date;
    const anchorDay = anchor ? anchor.cycleDay : 1;
    const dayDiff = Math.round((new Date(date + "T00:00:00Z").getTime() - new Date(anchorDate + "T00:00:00Z").getTime()) / 86400000);
    const rawDay = anchorDay + dayDiff;
    const cycleDay = ((rawDay - 1) % profile.cycleLength + profile.cycleLength) % profile.cycleLength + 1;
    const phase = computePhase(cycleDay, profile.cycleLength, profile.lutealLength);

    const entry: TelemetryEntry = {
      id: "nl-" + Math.random().toString(36).slice(2, 8),
      date, cycleDay, phase,
      subjective: {
        mood: draft.mood ?? 6,
        energy: draft.energy ?? 6,
        stress: draft.stress ?? 4,
        symptoms: {
          cramps: draft.symptoms.cramps ?? 0,
          fatigue: draft.symptoms.fatigue ?? 0,
          bloating: draft.symptoms.bloating ?? 0,
          headache: draft.symptoms.headache ?? 0,
          nausea: draft.symptoms.nausea ?? 0,
          breastTenderness: draft.symptoms.breastTenderness ?? 0,
        },
        notes: draft.notes || text.trim(),
      },
      objective: {
        bbt: draft.bbt,
        sleepHours: draft.sleepHours,
        sleepQuality: draft.sleepQuality,
        steps: null, restingHR: null, hrv: null,
      },
      biomarkers: { estrogen: null, progesterone: null, lh: null, fsh: null, notes: "" },
      researchConsent: profile.researchOptIn, anonymized: true,
      createdAt: "", updatedAt: "",
    };
    upsertEntry(entry);
    toast.success("Entry created from natural language");
    setDraft(null); setText("");
  };

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardContent className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground"><Bot className="h-4 w-4" /></div>
          <div className="text-sm font-semibold">Log with natural language</div>
          <Badge variant="outline" className="h-4 px-1.5 text-[9px] uppercase tracking-wider">agent</Badge>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") run(); }}
            placeholder='e.g. "slept 6h poorly, bad cramps 7/10, mood 4, headache came back"'
            className="flex-1"
            disabled={busy}
          />
          <Button onClick={run} disabled={busy || !text.trim()} className="gap-1">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Parse
          </Button>
        </div>

        {draft && (
          <div className="mt-3 rounded-lg border bg-background p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold">Proposed entry <span className="ml-2 font-mono text-[10px] text-muted-foreground">confidence {(draft.confidence * 100).toFixed(0)}%</span></div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setDraft(null)}><X className="mr-1 h-3.5 w-3.5" /> Discard</Button>
                <Button size="sm" onClick={approve}><Check className="mr-1 h-3.5 w-3.5" /> Approve & save</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-4">
              <Field k="Date" v={draft.date ?? "today"} />
              <Field k="Mood" v={draft.mood} />
              <Field k="Energy" v={draft.energy} />
              <Field k="Stress" v={draft.stress} />
              <Field k="BBT" v={draft.bbt} unit="°C" />
              <Field k="Sleep h" v={draft.sleepHours} />
              <Field k="Sleep q" v={draft.sleepQuality} />
              {Object.entries(draft.symptoms).filter(([, v]) => v != null && v > 0).map(([k, v]) => (
                <Field key={k} k={k} v={v as number} />
              ))}
            </div>
            {draft.notes && <p className="mt-2 text-[11px] italic text-muted-foreground">"{draft.notes}"</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ k, v, unit }: { k: string; v: string | number | null; unit?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-dashed border-border/50 py-0.5">
      <span className="capitalize text-muted-foreground">{k}</span>
      <span className="font-mono tabular-nums">{v == null || v === "" ? "—" : v}{unit && v != null ? unit : ""}</span>
    </div>
  );
}