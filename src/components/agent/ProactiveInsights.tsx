import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, ShieldAlert, HeartPulse, Sparkles } from "lucide-react";
import { useHormonalStore } from "@/lib/hormonal/store";
import { generateInsights } from "@/lib/agent/insights";
import { useCopilot } from "./CopilotProvider";
import { useI18n } from "@/lib/i18n";

export function ProactiveInsights() {
  const { entries, profile } = useHormonalStore();
  const { ask } = useCopilot();
  const { t } = useI18n();
  const insights = React.useMemo(() => generateInsights(entries, profile), [entries, profile]);
  if (!insights.length) return null;

  return (
    <Card className="mx-6 mb-2 mt-4 border-primary/30 bg-primary/[0.03] sm:mx-8">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">{t("insights.title")}</div>
            <div className="text-[11px] text-muted-foreground">{t("insights.sub")}</div>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {insights.map((ins) => {
            const Icon = ins.tone === "warn" ? ShieldAlert : ins.tone === "good" ? HeartPulse : Sparkles;
            return (
              <div key={ins.id} className="flex flex-col justify-between rounded-lg border bg-background p-3">
                <div>
                  <div className="mb-1 flex items-center gap-1.5">
                    <Icon className={`h-3.5 w-3.5 ${ins.tone === "warn" ? "text-amber-600" : ins.tone === "good" ? "text-emerald-600" : "text-primary"}`} />
                    <div className="text-xs font-semibold">{ins.title}</div>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{ins.body}</p>
                </div>
                <Button size="sm" variant="ghost" className="mt-2 h-7 justify-start px-2 text-[11px] text-primary hover:text-primary" onClick={() => ask(ins.ask)}>
                  {t("insights.ask")}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}