import { createServerFn } from "@tanstack/react-start";
import { MCPHASES_TABLES } from "./registry";

export interface TableCoverage {
  key: string;
  table: string;
  label: string;
  category: string;
  status: "active" | "scaffold";
  rows: number;
  participants: number;
  dayMin: number | null;
  dayMax: number | null;
  populated: boolean;
}

export interface IngestRunSummary {
  id: string;
  table_name: string;
  filename: string | null;
  rows_inserted: number;
  rows_skipped: number;
  participants: number;
  created_at: string;
}

export interface McphasesOverview {
  tables: TableCoverage[];
  runs: IngestRunSummary[];
  totalRows: number;
  activeTables: number;
  populatedTables: number;
}

export const getMcphasesOverview = createServerFn({ method: "GET" }).handler(async (): Promise<McphasesOverview> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const tables: TableCoverage[] = [];
  let totalRows = 0;

  for (const spec of MCPHASES_TABLES) {
    let rows = 0;
    let participants = 0;
    let dayMin: number | null = null;
    let dayMax: number | null = null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabaseAdmin.from(spec.table as any) as any)
      .select("*", { count: "exact", head: true });
    rows = count ?? 0;

    if (rows > 0) {
      // participant count via distinct
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pdata } = await (supabaseAdmin.from(spec.table as any) as any)
        .select("participant_id");
      if (Array.isArray(pdata)) {
        const s = new Set<number>();
        for (const r of pdata as { participant_id?: number }[]) {
          if (typeof r.participant_id === "number") s.add(r.participant_id);
        }
        participants = s.size;
      }
      // day range if column exists
      const hasDay = spec.keyStyle === "day" || spec.keyStyle === "day_ts";
      if (hasDay) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: dmin } = await (supabaseAdmin.from(spec.table as any) as any)
          .select("day_in_study").order("day_in_study", { ascending: true }).limit(1);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: dmax } = await (supabaseAdmin.from(spec.table as any) as any)
          .select("day_in_study").order("day_in_study", { ascending: false }).limit(1);
        const rowMin = (dmin?.[0] as { day_in_study?: number } | undefined)?.day_in_study;
        const rowMax = (dmax?.[0] as { day_in_study?: number } | undefined)?.day_in_study;
        dayMin = typeof rowMin === "number" ? rowMin : null;
        dayMax = typeof rowMax === "number" ? rowMax : null;
      }
    }

    totalRows += rows;
    tables.push({
      key: spec.key,
      table: spec.table,
      label: spec.label,
      category: spec.category,
      status: spec.status,
      rows,
      participants,
      dayMin,
      dayMax,
      populated: rows > 0,
    });
  }

  const { data: runsData } = await supabaseAdmin
    .from("mcphases_ingest_runs")
    .select("id, table_name, filename, rows_inserted, rows_skipped, participants, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  return {
    tables,
    runs: (runsData ?? []) as IngestRunSummary[],
    totalRows,
    activeTables: tables.filter((t) => t.status === "active").length,
    populatedTables: tables.filter((t) => t.populated).length,
  };
});