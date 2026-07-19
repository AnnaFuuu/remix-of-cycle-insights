import * as React from "react";
import { toast } from "sonner";
import { useHormonalStore } from "@/lib/hormonal/store";
import { PageHeader } from "@/components/hnhh/PageHeader";
import { PageSkeleton } from "@/components/hnhh/PageSkeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useResearcherMode } from "@/lib/researcher-mode";
import { KeyRound, Lock } from "lucide-react";

export function Settings() {
  const { ready, profile, setProfile, entries, resetSeed, clearAll } = useHormonalStore();
  const { isResearcher, unlock, lock } = useResearcherMode();
  
  const [draft, setDraft] = React.useState(profile);
  React.useEffect(() => setDraft(profile), [profile]);

  if (!ready) return <PageSkeleton />;

  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);

  const save = () => {
    if (!draft.alias.trim()) { toast.error("Alias cannot be empty"); return; }
    if (draft.cycleLength < 20 || draft.cycleLength > 45) { toast.error("Cycle length must be 20–45 days"); return; }
    if (draft.lutealLength < 8 || draft.lutealLength > 18) { toast.error("Luteal length must be 8–18 days"); return; }
    setProfile(draft);
    toast.success("Preferences saved");
  };

  const downloadAll = () => {
    const bundle = { profile, entries, exported_at: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hnhh-personal-data.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Personal data exported");
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Settings"
        title="Preferences & privacy"
        description="Local-first configuration. Nothing syncs unless you explicitly export."
      />

      <div className="grid grid-cols-1 gap-6 px-6 sm:px-8 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Profile & cycle</CardTitle>
            <CardDescription>Baseline anchors for phase estimation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Alias (anonymized subject id)</Label>
              <Input value={draft.alias} onChange={(e) => setDraft({ ...draft, alias: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Cycle length (days)</Label>
                <Input type="number" min={20} max={45} value={draft.cycleLength} onChange={(e) => setDraft({ ...draft, cycleLength: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">Luteal length (days)</Label>
                <Input type="number" min={8} max={18} value={draft.lutealLength} onChange={(e) => setDraft({ ...draft, lutealLength: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Temperature units</Label>
                <Select value={draft.units.temperature} onValueChange={(v) => setDraft({ ...draft, units: { temperature: v as "C" | "F" } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="C">Celsius</SelectItem>
                    <SelectItem value="F">Fahrenheit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Theme</Label>
                <Select value={draft.theme} onValueChange={(v) => setDraft({ ...draft, theme: v as "light" | "dark" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Privacy & consent</CardTitle>
            <CardDescription>Fine-grained control over anonymization and sharing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border bg-secondary/40 p-3">
              <div>
                <Label className="text-sm">Research opt-in</Label>
                <p className="text-xs text-muted-foreground">Allows export bundles to include your records.</p>
              </div>
              <Switch checked={draft.researchOptIn} onCheckedChange={(v) => setDraft({ ...draft, researchOptIn: v })} />
            </div>
            <div>
              <Label className="text-xs">Anonymization level</Label>
              <Select value={draft.anonymizationLevel} onValueChange={(v) => setDraft({ ...draft, anonymizationLevel: v as "standard" | "strict" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard (date + alias)</SelectItem>
                  <SelectItem value="strict">Strict (month-only, no notes)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border p-3 text-xs text-muted-foreground">
              This app is not a diagnostic medical device. It supports personal tracking and consented open-science contribution.
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Data management</CardTitle>
            <CardDescription>{entries.length} telemetry records stored locally.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadAll}>Export all data (JSON)</Button>
            <Button variant="outline" onClick={() => { resetSeed(); toast.success("Seed dataset regenerated"); }}>Regenerate seed data</Button>
            <Button variant="destructive" onClick={() => { if (confirm("Delete all telemetry records? This cannot be undone.")) { clearAll(); toast.success("All records deleted"); } }}>Delete all records</Button>
          </CardContent>
        </Card>

        <Card className="border-border/60 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {isResearcher ? <KeyRound className="h-4 w-4 text-primary" /> : <Lock className="h-4 w-4" />}
              Researcher mode
            </CardTitle>
            <CardDescription>
              {isResearcher
                ? "Model training pages are visible in the sidebar. Lock again to hide them."
                : "The Model training section (Data for training models · Analytics) is hidden by default. Enter the team passphrase to unlock it on this device."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant={isResearcher ? "outline" : "default"}
              onClick={() => {
                if (isResearcher) { lock(); toast.success("Researcher mode locked"); }
                else { unlock(); toast.success("Researcher mode unlocked"); }
              }}
            >
              {isResearcher ? "Lock researcher mode" : "Unlock researcher mode"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-0 border-t bg-background/95 px-6 py-3 backdrop-blur sm:px-8">
        <div className="flex items-center justify-end gap-2">
          <span className="mr-auto text-xs text-muted-foreground">{dirty ? "Unsaved changes" : "All changes saved"}</span>
          <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(profile)}>Reset</Button>
          <Button disabled={!dirty} onClick={save}>Save preferences</Button>
        </div>
      </div>
    </div>
  );
}