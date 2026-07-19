import * as React from "react";
import { Plus, Trash2, Upload, FileText, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useUserLabs, type LabFile, type LabWorkItem } from "@/lib/labs/user-labs-store";

const MAX_FILE_MB = 5;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function AddLabDialog({ onSaved }: { onSaved: () => void }) {
  const { addEntry } = useUserLabs();
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState(todayISO());
  const [items, setItems] = React.useState<LabWorkItem[]>([
    { id: crypto.randomUUID(), test: "", result: "" },
  ]);

  const reset = () => {
    setDate(todayISO());
    setItems([{ id: crypto.randomUUID(), test: "", result: "" }]);
  };

  const updateItem = (id: string, patch: Partial<LabWorkItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const addRow = () =>
    setItems((prev) => [...prev, { id: crypto.randomUUID(), test: "", result: "" }]);

  const removeRow = (id: string) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));

  const handleSave = () => {
    const cleaned = items
      .map((i) => ({ ...i, test: i.test.trim(), result: i.result.trim() }))
      .filter((i) => i.test || i.result);
    if (!date) return toast.error("Please pick a date");
    if (!cleaned.length) return toast.error("Add at least one lab work / result");
    addEntry({ date, items: cleaned, files: [] });
    toast.success("Lab entry saved");
    setOpen(false);
    reset();
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <Plus className="h-4 w-4" /> Add lab entry
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add lab work</DialogTitle>
          <DialogDescription>All results under one date are grouped together.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="lab-date">Date</Label>
            <Input id="lab-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={item.id} className="rounded-md border border-border/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Entry {idx + 1}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(item.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`test-${item.id}`} className="text-xs">Lab work</Label>
                  <Input
                    id={`test-${item.id}`}
                    placeholder="e.g. TSH, Ferritin, Vitamin D"
                    value={item.test}
                    onChange={(e) => updateItem(item.id, { test: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`res-${item.id}`} className="text-xs">Results</Label>
                  <Input
                    id={`res-${item.id}`}
                    placeholder="e.g. 2.1 mIU/L"
                    value={item.result}
                    onChange={(e) => updateItem(item.id, { result: e.target.value })}
                  />
                </div>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={addRow} className="gap-1 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add another lab work
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadFileDialog() {
  const { addEntry } = useUserLabs();
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState(todayISO());
  const [file, setFile] = React.useState<File | null>(null);

  const reset = () => { setDate(todayISO()); setFile(null); };

  const handleUpload = async () => {
    if (!date) return toast.error("Please pick a date");
    if (!file) return toast.error("Please choose a file");
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      return toast.error(`File must be under ${MAX_FILE_MB} MB`);
    }
    const dataUrl = await fileToDataUrl(file);
    const labFile: LabFile = {
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      dataUrl,
    };
    addEntry({ date, items: [], files: [labFile] });
    toast.success("File uploaded");
    setOpen(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <Upload className="h-4 w-4" /> Upload file
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload lab file</DialogTitle>
          <DialogDescription>PDF, image, or document — up to {MAX_FILE_MB} MB.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="file-date">Date</Label>
            <Input id="file-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="file-input">File</Label>
            <Input
              id="file-input"
              type="file"
              accept="application/pdf,image/*,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} · {(file.size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleUpload}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UserLabsPanel() {
  const { entries, removeEntry } = useUserLabs();

  // Group by date
  const grouped = React.useMemo(() => {
    const m = new Map<string, typeof entries>();
    for (const e of entries) {
      const arr = m.get(e.date) ?? [];
      arr.push(e);
      m.set(e.date, arr);
    }
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  return (
    <Card className="border-border/60">
      <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div>
          <CardTitle className="text-base">My lab entries</CardTitle>
          <CardDescription>Log lab work by date or upload your own reports.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AddLabDialog onSaved={() => {}} />
          <UploadFileDialog />
        </div>
      </CardHeader>
      <CardContent>
        {grouped.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            N/A — no entries yet. Click <span className="font-medium">Add lab entry</span> or <span className="font-medium">Upload file</span> to start.
          </p>
        ) : (
          <div className="space-y-4">
            {grouped.map(([date, list]) => {
              const items = list.flatMap((e) => e.items.map((i) => ({ ...i, entryId: e.id })));
              const files = list.flatMap((e) => e.files.map((f) => ({ ...f, entryId: e.id })));
              return (
                <div key={date} className="rounded-md border border-border/60">
                  <div className="flex items-center justify-between border-b bg-secondary/40 px-3 py-1.5">
                    <span className="font-mono text-xs">{date}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {items.length} result{items.length === 1 ? "" : "s"} · {files.length} file{files.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {items.length > 0 && (
                    <table className="w-full text-xs">
                      <thead className="text-muted-foreground">
                        <tr className="text-left">
                          <th className="px-3 py-1.5 font-medium">Lab work</th>
                          <th className="px-3 py-1.5 font-medium">Results</th>
                          <th className="w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((i) => (
                          <tr key={i.id} className="border-t">
                            <td className="px-3 py-1.5">{i.test || <span className="text-muted-foreground">—</span>}</td>
                            <td className="px-3 py-1.5 font-mono tabular-nums">{i.result || <span className="text-muted-foreground">—</span>}</td>
                            <td className="px-2 py-1.5 text-right">
                              <button
                                onClick={() => removeEntry(i.entryId)}
                                className="text-muted-foreground hover:text-destructive"
                                aria-label="Delete entry"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {files.length > 0 && (
                    <ul className="divide-y">
                      {files.map((f) => (
                        <li key={f.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                          <a
                            href={f.dataUrl}
                            download={f.name}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex min-w-0 items-center gap-2 text-xs hover:underline"
                          >
                            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{f.name}</span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">({(f.size / 1024).toFixed(1)} KB)</span>
                          </a>
                          <button
                            onClick={() => removeEntry(f.entryId)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="Delete file"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
