import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Database } from "lucide-react";

export function EmptyData({
  title = "N/A",
  hint = "No data ingested yet. Import a dataset from the Research Portal or log an entry in the Telemetry Log.",
}: { title?: string; hint?: string }) {
  return (
    <div className="px-6 pb-8 sm:px-8">
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-2 py-14 text-center">
          <Database className="h-6 w-6 text-muted-foreground" />
          <div className="text-lg font-semibold tracking-tight">{title}</div>
          <p className="max-w-md text-sm text-muted-foreground">{hint}</p>
        </CardContent>
      </Card>
    </div>
  );
}
