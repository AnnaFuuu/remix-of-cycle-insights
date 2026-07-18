import * as React from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Bot, Send, Sparkles, Wrench, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useHormonalStore } from "@/lib/hormonal/store";
import { buildSnapshot } from "@/lib/agent/context";
import { useCopilot } from "./CopilotProvider";
import { useI18n } from "@/lib/i18n";

const MSG_KEY = "hnhh.copilot.messages.v1";

function loadPersisted(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MSG_KEY);
    return raw ? (JSON.parse(raw) as UIMessage[]) : [];
  } catch { return []; }
}

export function CopilotDrawer() {
  const { open, setOpen, consumePrefill } = useCopilot();
  const { entries, profile } = useHormonalStore();
  const { t, locale } = useI18n();

  const snapshotRef = React.useRef(buildSnapshot(entries, profile));
  React.useEffect(() => { snapshotRef.current = buildSnapshot(entries, profile); }, [entries, profile]);

  const [initial] = React.useState<UIMessage[]>(() => loadPersisted());

  const transport = React.useMemo(
    () => new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages }) => ({ body: { messages, context: snapshotRef.current, locale } }),
    }),
    [locale],
  );

  const { messages, sendMessage, status, setMessages, error } = useChat({
    transport,
    messages: initial,
    onError: (e) => console.error("copilot error", e),
  });

  React.useEffect(() => {
    try { localStorage.setItem(MSG_KEY, JSON.stringify(messages)); } catch {}
  }, [messages]);

  const [input, setInput] = React.useState("");
  const taRef = React.useRef<HTMLTextAreaElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // consume prefill when drawer opens
  React.useEffect(() => {
    if (!open) return;
    const p = consumePrefill();
    if (p) setInput(p);
    setTimeout(() => taRef.current?.focus(), 50);
  }, [open, consumePrefill]);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, status]);

  const submit = () => {
    const text = input.trim();
    if (!text || status === "streaming" || status === "submitted") return;
    setInput("");
    void sendMessage({ text });
    setTimeout(() => taRef.current?.focus(), 30);
  };

  const clear = () => { setMessages([]); try { localStorage.removeItem(MSG_KEY); } catch {} };

  return (
    <>
      {/* Floating toggle */}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Toggle Cycle Copilot"
        className={cn(
          "fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105",
          open && "opacity-0 pointer-events-none",
        )}
      >
        <Bot className="h-6 w-6" />
      </button>

      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l bg-background shadow-xl transition-transform",
          open ? "translate-x-0" : "translate-x-full",
        )}
        role="dialog"
        aria-label="Cycle Copilot"
      >
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-semibold">{t("copilot.title")} <Badge variant="outline" className="h-4 px-1.5 text-[9px] uppercase tracking-wider">beta</Badge></div>
            <div className="truncate text-[11px] text-muted-foreground">{t("copilot.sub")}</div>
          </div>
          <Button size="icon" variant="ghost" onClick={clear} title={t("copilot.new")}><RefreshCw className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => setOpen(false)} title={t("copilot.close")}><X className="h-4 w-4" /></Button>
        </div>

        <ScrollArea className="flex-1">
          <div ref={scrollRef} className="space-y-4 px-4 py-4">
            {messages.length === 0 && <EmptyState onPick={(q) => { setInput(q); setTimeout(() => taRef.current?.focus(), 20); }} />}
            {messages.map((m) => <MessageBubble key={m.id} m={m} />)}
            {(status === "submitted" || status === "streaming") && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                <span>{t("copilot.thinking")}</span>
              </div>
            )}
            {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">{error.message}</div>}
          </div>
        </ScrollArea>

        <div className="border-t p-3">
          <div className="rounded-lg border bg-secondary/30 p-2 focus-within:ring-2 focus-within:ring-primary/30">
            <Textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              rows={2}
              placeholder={t("copilot.placeholder")}
              className="min-h-[60px] resize-none border-0 bg-transparent p-1 text-sm shadow-none focus-visible:ring-0"
              disabled={status === "streaming" || status === "submitted"}
            />
            <div className="mt-1 flex items-center justify-between">
              <div className="text-[10px] text-muted-foreground">{t("copilot.disclaimer")}</div>
              <Button size="icon" onClick={submit} disabled={!input.trim() || status === "streaming" || status === "submitted"} className="h-8 w-8">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {open && <div className="fixed inset-0 z-40 bg-background/40 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} />}
    </>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  const { t } = useI18n();
  const prompts = [t("copilot.prompt.1"), t("copilot.prompt.2"), t("copilot.prompt.3"), t("copilot.prompt.4")];
  return (
    <div className="rounded-xl border bg-secondary/30 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> {t("copilot.starters")}</div>
      <div className="grid gap-2">
        {prompts.map((p) => (
          <button key={p} onClick={() => onPick(p)} className="rounded-md border bg-background px-3 py-2 text-left text-xs text-foreground hover:border-primary/40 hover:bg-primary/5">
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ m }: { m: UIMessage }) {
  const isUser = m.role === "user";
  const text = m.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("");
  const toolParts = m.parts.filter((p) => typeof p.type === "string" && (p.type as string).startsWith("tool-"));
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[85%] space-y-1", isUser ? "" : "w-full")}>
        {toolParts.map((p, i) => <ToolChip key={i} part={p as unknown as { type: string; state?: string }} />)}
        {text && (
          <div className={cn(
            "whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed",
            isUser ? "bg-primary text-primary-foreground" : "text-foreground",
          )}>
            {text}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolChip({ part }: { part: { type: string; state?: string } }) {
  const name = part.type.replace(/^tool-/, "");
  const done = part.state === "output-available" || part.state === "result";
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-mono text-primary">
      <Wrench className="h-3 w-3" />
      <span>{name}</span>
      <span className="text-muted-foreground">{done ? "· done" : "· running"}</span>
    </div>
  );
}