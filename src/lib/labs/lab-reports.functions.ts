import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// -----------------------------------------------------------------------------
// Lab report ingestion:
//   1. Client sends { ownerId, filename, mime, fileBase64 }
//   2. Server uploads to private `lab-reports` bucket at `${ownerId}/${uuid}.ext`
//   3. Server calls Lovable AI (gpt-5.5) multimodal to extract structured
//      biomarkers + PII fields (name / id / hospital / doctor)
//   4. PII gets AES-256-GCM encrypted using LAB_PII_ENCRYPTION_KEY
//   5. Row inserted into public.lab_reports
// -----------------------------------------------------------------------------

const UUID = z.string().uuid();

export interface Biomarker {
  name: string;
  value: number | null;
  unit: string | null;
  reference_range: string | null;
  flag: "L" | "N" | "H" | null;
}

export interface PiiFields {
  name: string | null;
  id_number: string | null;
  hospital: string | null;
  doctor: string | null;
  other: string | null;
}

export interface LabReportRow {
  id: string;
  report_date: string;
  source_filename: string;
  source_mime: string;
  storage_path: string;
  extracted: Biomarker[];
  ai_model: string | null;
  notes: string | null;
  created_at: string;
  // PII is decrypted only when explicitly requested (getLabReport).
  pii?: PiiFields | null;
}

const UploadInput = z.object({
  ownerId: UUID,
  filename: z.string().min(1).max(200),
  mime: z.string().min(1).max(120),
  fileBase64: z.string().min(1), // raw base64, no data: prefix
  reportDateHint: z.string().optional(), // client override, YYYY-MM-DD
});

// Model output schema — kept minimal because we only need biomarker rows +
// four PII slots for redaction/storage.
const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    report_date: { type: ["string", "null"], description: "YYYY-MM-DD if the report shows a collection date" },
    pii: {
      type: "object",
      additionalProperties: false,
      properties: {
        name:      { type: ["string", "null"] },
        id_number: { type: ["string", "null"] },
        hospital:  { type: ["string", "null"] },
        doctor:    { type: ["string", "null"] },
        other:     { type: ["string", "null"], description: "Phone, address, insurance id — anything else identifying" },
      },
      required: ["name", "id_number", "hospital", "doctor", "other"],
    },
    biomarkers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name:            { type: "string" },
          value:           { type: ["number", "null"] },
          unit:            { type: ["string", "null"] },
          reference_range: { type: ["string", "null"] },
          flag:            { type: ["string", "null"], enum: ["L", "N", "H", null] },
        },
        required: ["name", "value", "unit", "reference_range", "flag"],
      },
    },
  },
  required: ["report_date", "pii", "biomarkers"],
} as const;

async function extractWithAi(
  apiKey: string,
  mime: string,
  base64: string,
  filename: string,
): Promise<{ report_date: string | null; pii: PiiFields; biomarkers: Biomarker[]; model: string }> {
  const model = "openai/gpt-5.5";
  const isImage = mime.startsWith("image/");

  const contentBlock = isImage
    ? { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } }
    : { type: "file", file: { filename, file_data: `data:${mime};base64,${base64}` } };

  const systemPrompt =
    "You are a medical-lab-report extraction engine. From the attached document extract " +
    "every laboratory analyte / biomarker with its numeric value, unit, reference range, " +
    "and abnormal-flag (L/N/H). Also isolate personally identifying fields (name, id number, " +
    "hospital, doctor, and anything else identifying) into the `pii` object so we can encrypt " +
    "them separately. If a field is missing, return null — never fabricate. Return ONLY the " +
    "JSON described by the schema.";

  const body = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: [
        { type: "text", text: "Extract all biomarkers and PII from this lab report." },
        contentBlock,
      ] },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "lab_report_extraction", schema: EXTRACT_SCHEMA, strict: true },
    },
  };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI extraction failed [${res.status}]: ${text.slice(0, 500)}`);
  }
  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content;
  if (typeof raw !== "string") throw new Error("AI response missing content");
  const parsed = JSON.parse(raw) as {
    report_date: string | null;
    pii: PiiFields;
    biomarkers: Biomarker[];
  };
  return { ...parsed, model };
}

export const uploadLabReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => UploadInput.parse(input))
  .handler(async ({ data }): Promise<{ id: string; report_date: string; biomarker_count: number; pii_present: boolean }> => {
    const aiKey = process.env.LOVABLE_API_KEY;
    if (!aiKey) throw new Error("LOVABLE_API_KEY is not set");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { encryptPii } = await import("./pii-crypto.server");

    // 1. Upload original to private bucket
    const buf = Buffer.from(data.fileBase64, "base64");
    const ext = (data.filename.split(".").pop() || "bin").toLowerCase().slice(0, 8);
    const objectId = crypto.randomUUID();
    const storagePath = `${data.ownerId}/${objectId}.${ext}`;
    const up = await supabaseAdmin.storage
      .from("lab-reports")
      .upload(storagePath, buf, { contentType: data.mime, upsert: false });
    if (up.error) throw up.error;

    // 2. AI extract
    const extraction = await extractWithAi(aiKey, data.mime, data.fileBase64, data.filename);

    // 3. Encrypt PII
    const hasPii = Object.values(extraction.pii).some((v) => v && String(v).trim().length > 0);
    const piiCiphertext = hasPii ? encryptPii(extraction.pii) : null;

    // 4. Resolve report_date
    const reportDate =
      data.reportDateHint ||
      extraction.report_date ||
      new Date().toISOString().slice(0, 10);

    // 5. Insert row
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ins = await (supabaseAdmin.from("lab_reports" as any) as any).insert({
      owner_id: data.ownerId,
      report_date: reportDate,
      source_filename: data.filename,
      source_mime: data.mime,
      storage_path: storagePath,
      extracted: extraction.biomarkers,
      pii_ciphertext: piiCiphertext,
      ai_model: extraction.model,
    }).select("id").single();
    if (ins.error) throw ins.error;

    return {
      id: ins.data.id,
      report_date: reportDate,
      biomarker_count: extraction.biomarkers.length,
      pii_present: hasPii,
    };
  });

export const listLabReports = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ ownerId: UUID }).parse(input))
  .handler(async ({ data }): Promise<LabReportRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (supabaseAdmin.from("lab_reports" as any) as any)
      .select("id, report_date, source_filename, source_mime, storage_path, extracted, ai_model, notes, created_at, pii_ciphertext")
      .eq("owner_id", data.ownerId)
      .order("report_date", { ascending: false })
      .limit(500);
    if (error) throw error;
    return (rows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      report_date: r.report_date as string,
      source_filename: r.source_filename as string,
      source_mime: r.source_mime as string,
      storage_path: r.storage_path as string,
      extracted: (r.extracted ?? []) as Biomarker[],
      ai_model: (r.ai_model ?? null) as string | null,
      notes: (r.notes ?? null) as string | null,
      created_at: r.created_at as string,
      pii: r.pii_ciphertext ? { name: "[encrypted]", id_number: null, hospital: null, doctor: null, other: null } : null,
    }));
  });

export const getLabReportPii = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ ownerId: UUID, id: UUID }).parse(input))
  .handler(async ({ data }): Promise<PiiFields | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decryptPii } = await import("./pii-crypto.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabaseAdmin.from("lab_reports" as any) as any)
      .select("pii_ciphertext, owner_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!row || row.owner_id !== data.ownerId) return null;
    if (!row.pii_ciphertext) return null;
    return decryptPii<PiiFields>(row.pii_ciphertext);
  });

export const signLabReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ ownerId: UUID, id: UUID }).parse(input))
  .handler(async ({ data }): Promise<{ url: string } | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabaseAdmin.from("lab_reports" as any) as any)
      .select("storage_path, owner_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!row || row.owner_id !== data.ownerId) return null;
    const signed = await supabaseAdmin.storage
      .from("lab-reports")
      .createSignedUrl(row.storage_path, 60 * 10);
    if (signed.error) throw signed.error;
    return { url: signed.data.signedUrl };
  });

export const deleteLabReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ ownerId: UUID, id: UUID }).parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row } = await (supabaseAdmin.from("lab_reports" as any) as any)
      .select("storage_path, owner_id")
      .eq("id", data.id)
      .maybeSingle();
    if (row && row.owner_id === data.ownerId) {
      await supabaseAdmin.storage.from("lab-reports").remove([row.storage_path]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin.from("lab_reports" as any) as any)
        .delete().eq("id", data.id).eq("owner_id", data.ownerId);
    }
    return { ok: true };
  });
