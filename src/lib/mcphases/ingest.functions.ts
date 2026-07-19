import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Papa from "papaparse";
import { MCPHASES_TABLES, type McphasesTable, type ColumnMap } from "./registry";

const InputSchema = z.object({
  tableKey: z.string().min(1),
  csvText: z.string().min(1),
  filename: z.string().optional(),
});

function coerce(value: unknown, kind: ColumnMap["coerce"]) {
  if (value === undefined || value === null || value === "") return null;
  const s = String(value).trim();
  if (s === "" || s.toLowerCase() === "nan" || s.toLowerCase() === "null") return null;
  switch (kind) {
    case "string": return s;
    case "number": {
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    }
    case "int": {
      const n = Number(s);
      return Number.isFinite(n) ? Math.trunc(n) : null;
    }
    case "bool": {
      const l = s.toLowerCase();
      if (l === "true" || l === "1" || l === "yes" || l === "t") return true;
      if (l === "false" || l === "0" || l === "no" || l === "f") return false;
      return null;
    }
    case "json": {
      try { return JSON.parse(s); } catch { return s; }
    }
  }
}

function mapRow(row: Record<string, unknown>, spec: McphasesTable): { ok: true; record: Record<string, unknown> } | { ok: false; reason: string } {
  const record: Record<string, unknown> = {};
  for (const col of spec.csvColumns) {
    const raw = row[col.csv];
    const val = coerce(raw, col.coerce);
    if (col.required && (val === null || val === undefined)) {
      return { ok: false, reason: `missing required column ${col.csv}` };
    }
    record[col.db] = val;
  }
  return { ok: true, record };
}

export const ingestMcphasesCsv = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const spec = MCPHASES_TABLES.find((t) => t.key === data.tableKey);
    if (!spec) throw new Error(`Unknown mcPHASES table: ${data.tableKey}`);
    if (spec.status !== "active" || spec.csvColumns.length === 0) {
      throw new Error(`Table ${spec.key} is scaffolded but not yet active for ingest.`);
    }

    const parsed = Papa.parse<Record<string, unknown>>(data.csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });
    if (parsed.errors.length && parsed.data.length === 0) {
      throw new Error(`CSV parse failed: ${parsed.errors[0]?.message}`);
    }

    const rows = parsed.data;
    const participants = new Set<number>();
    const good: Record<string, unknown>[] = [];
    const errors: { row: number; reason: string }[] = [];

    rows.forEach((r, idx) => {
      const m = mapRow(r, spec);
      if (!m.ok) {
        if (errors.length < 20) errors.push({ row: idx + 2, reason: m.reason });
        return;
      }
      const pid = m.record.participant_id;
      if (typeof pid === "number") participants.add(pid);
      good.push(m.record);
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Upsert participants first (satisfies FK)
    if (participants.size > 0) {
      const participantRows = Array.from(participants).map((participant_id) => ({ participant_id }));
      const { error: pErr } = await supabaseAdmin
        .from("mcphases_participants")
        .upsert(participantRows, { onConflict: "participant_id", ignoreDuplicates: true });
      if (pErr) throw new Error(`Participant upsert failed: ${pErr.message}`);
    }

    // Batch upsert data rows
    const conflictCols = spec.conflictColumns.join(",");
    let inserted = 0;
    const BATCH = 500;
    for (let i = 0; i < good.length; i += BATCH) {
      const chunk = good.slice(i, i + BATCH);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error, count } = await (supabaseAdmin.from(spec.table as any) as any)
        .upsert(chunk, { onConflict: conflictCols, count: "exact" });
      if (error) throw new Error(`Row upsert failed at batch ${i}: ${error.message}`);
      inserted += count ?? chunk.length;
    }

    // Compute simple stats
    const dayValues = good
      .map((r) => (typeof r.day_in_study === "number" ? r.day_in_study : null))
      .filter((v): v is number => v !== null);
    const stats: { participants: number; day_min: number | null; day_max: number | null } = {
      participants: participants.size,
      day_min: dayValues.length ? Math.min(...dayValues) : null,
      day_max: dayValues.length ? Math.max(...dayValues) : null,
    };

    // Audit
    await supabaseAdmin.from("mcphases_ingest_runs").insert({
      table_name: spec.table,
      filename: data.filename ?? null,
      rows_inserted: inserted,
      rows_updated: 0,
      rows_skipped: errors.length,
      participants: participants.size,
      errors: errors,
      stats,
    });

    return {
      table: spec.table,
      inserted,
      skipped: errors.length,
      participants: participants.size,
      totalRows: rows.length,
      errors: errors.slice(0, 5),
      stats,
    };
  });