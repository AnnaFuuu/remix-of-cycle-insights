import * as React from "react";
import { Plus, Trash2, Upload, FileText, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

const MAX_FILE_MB = 5;

export type EntryItem = { id: string; test: string; result: string };
export type EntryFile = { id: string; name: string; type: string; size: number; dataUrl: string };
export type UserEntry = {
  id: string;
  date: string;
  items: EntryItem[];
  files: EntryFile[];
  createdAt: number;
};

export type EntryLabels = {
  cardTitle: string;
  cardDescription: string;
  addButton: string;
  uploadButton: string;
  addDialogTitle: string;
  addDialogDescription: string;
  uploadDialogTitle: string;
  uploadDialogDescription: string;
  itemLabel: string;
  itemPlaceholder: string;
  resultLabel: string;
  resultPlaceholder: string;
  addAnother: string;
  emptyState: string;
  tableItemHeader: string;
  tableResultHeader: string;
};

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

export function useUserEntries(storageKey: string) {
  const [entries, setEntries] = React.useState<UserEntry[]>(() => read(storageKey));
  const eventName = `hnhh:user-entries-changed:${storageKey}`;

  React.useEffect(() => {
    const sync = () => setEntries(read(storageKey));
    window.addEventListener(eventName, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(eventName, sync);
      window.removeEventListener("storage", sync);
    };
  }, [storageKey, eventName]);

  const addEntry = React.useCallback(
    (entry: Omit<UserEntry, "id" | "createdAt">) => {
      const next: UserEntry = { ...entry, id: crypto.randomUUID(), createdAt: Date.now() };
      const all = [...read(storageKey), next].sort((a, b) => b.date.localeCompare(a.date));
      write(storageKey, eventName, all);
    },
    [storageKey, eventName],
  );

  const removeEntry = React.useCallback(
    (id: string) => write(storageKey, eventName, read(storageKey).filter((e) => e.id !== id)),
    [storageKey, eventName],
  );

  return { entries, addEntry, removeEntry };
}

function read(key: string): UserEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as UserEntry[]) : [];
  } catch {
    return [];
  }
}
function write(key: string, event: string, entries: UserEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(entries));
  window.dispatchEvent(new Event(event));
}

function AddEntryDialog({ labels, onAdd }: { labels: EntryLabels; onAdd: (e: Omit<UserEntry, "id" | "createdAt">) => void }) {
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState(todayISO());
  const [items, setItems] = React.useState<EntryItem[]>([{ id: crypto.randomUUID(), test: "", result: "" }]);

  const reset = () => {
    setDate(todayISO());
    setItems([{ id: crypto.randomUUID(), test: "", result: "" }]);
  };

  const updateItem = (id: string, patch: Partial<EntryItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const addRow = () => setItems((prev) => [...prev, { id: crypto.randomUUID(), test: "", result: "" }]);
  const removeRow = (id: string) => setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));

  const handleSave = () => {
    const cleaned = items
      .map((i) => ({ ...i, test: i.test.trim(), result: i.result.trim() }))
      .filter((i) => i.test || i.result);
    if (!date) return toast.error("Please pick a date");
    if (!cleaned.length) return toast.error("Add at least one entry");
    onAdd({ date, items: cleaned, files: [] });
    toast.success("Entry saved");
    setOpen(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <Plus className="h-4 w-4" /> {labels.addButton}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{labels.addDialogTitle}</DialogTitle>
          <DialogDescription>{labels.addDialogDescription}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="entry-date">Date</Label>
            <Input id="entry-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={item.id} className="rounded-md border border-border/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Entry {idx + 1}</span>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeRow(item.id)} className="text-muted-foreground hover:text-destructive" aria-label="Remove">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`test-${item.id}`} className="text-xs">{labels.itemLabel}</Label>
                  <Input id={`test-${item.id}`} placeholder={labels.itemPlaceholder} value={item.test} onChange={(e) => updateItem(item.id, { test: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`res-${item.id}`} className="text-xs">{labels.resultLabel}</Label>
                  <Input id={`res-${item.id}`} placeholder={labels.resultPlaceholder} value={item.result} onChange={(e) => updateItem(item.id, { result: e.target.value })} />
                </div>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={addRow} className="gap-1 text-xs">
              <Plus className="h-3.5 w-3.5" /> {labels.addAnother}
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

function UploadDialog({ labels, onAdd }: { labels: EntryLabels; onAdd: (e: Omit<UserEntry, "id" | "createdAt">) => void }) {
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState(todayISO());
  const [file, setFile] = React.useState<File | null>(null);
  const reset = () => { setDate(todayISO()); setFile(null); };

  const handleUpload = async () => {
    if (!date) return toast.error("Please pick a date");
    if (!file) return toast.error("Please choose a file");
    if (file.size > MAX_FILE_MB * 1024 * 1024) return toast.error(`File must be under ${MAX_FILE_MB} MB`);
    const dataUrl = await fileToDataUrl(file);
    onAdd({
      date,
      items: [],
      files: [{ id: crypto.randomUUID(), name: file.name, type: file.type || "application/octet-stream", size: file.size, dataUrl }],
    });
    toast.success("File uploaded");
    setOpen(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <Upload className="h-4 w-4" /> {labels.uploadButton}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{labels.uploadDialogTitle}</DialogTitle>
          <DialogDescription>{labels.uploadDialogDescription}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="file-date">Date</Label>
            <Input id="file-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="file-input">File</Label>
            <Input id="file-input" type="file" accept="application/pdf,image/*,.doc,.docx,.csv,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file && <p className="text-xs text-muted-foreground">{file.name} · {(file.size / 1024).toFixed(1)} KB</p>}
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

export function UserEntriesPanel({ storageKey, labels }: { storageKey: string; labels: EntryLabels }) {
  const { entries, addEntry, removeEntry } = useUserEntries(storageKey);

  const grouped = React.useMemo(() => {
    const m = new Map<string, UserEntry[]>();
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
          <CardTitle className="text-base">{labels.cardTitle}</CardTitle>
          <CardDescription>{labels.cardDescription}</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AddEntryDialog labels={labels} onAdd={addEntry} />
          <UploadDialog labels={labels} onAdd={addEntry} />
        </div>
      </CardHeader>
      <CardContent>
        {grouped.length === 0 ? (
          <p className="text-xs text-muted-foreground">{labels.emptyState}</p>
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
                      {items.length} entr{items.length === 1 ? "y" : "ies"} · {files.length} file{files.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {items.length > 0 && (
                    <table className="w-full text-xs">
                      <thead className="text-muted-foreground">
                        <tr className="text-left">
                          <th className="px-3 py-1.5 font-medium">{labels.tableItemHeader}</th>
                          <th className="px-3 py-1.5 font-medium">{labels.tableResultHeader}</th>
                          <th className="w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((i) => (
                          <tr key={i.id} className="border-t">
                            <td className="px-3 py-1.5">{i.test || <span className="text-muted-foreground">—</span>}</td>
                            <td className="px-3 py-1.5 font-mono tabular-nums">{i.result || <span className="text-muted-foreground">—</span>}</td>
                            <td className="px-2 py-1.5 text-right">
                              <button onClick={() => removeEntry(i.entryId)} className="text-muted-foreground hover:text-destructive" aria-label="Delete entry">
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
                          <a href={f.dataUrl} download={f.name} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-2 text-xs hover:underline">
                            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{f.name}</span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">({(f.size / 1024).toFixed(1)} KB)</span>
                          </a>
                          <button onClick={() => removeEntry(f.entryId)} className="text-muted-foreground hover:text-destructive" aria-label="Delete file">
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
