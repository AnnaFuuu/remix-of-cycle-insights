import { createServerFn } from "@tanstack/react-start";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createLovableGateway, COPILOT_MODEL } from "@/lib/ai-gateway.server";
import type { AgentContextSnapshot } from "./context";

const symptomsShape = z.object({
  cramps: z.number().min(0).max(10).nullable(),
  fatigue: z.number().min(0).max(10).nullable(),
  bloating: z.number().min(0).max(10).nullable(),
  headache: z.number().min(0).max(10).nullable(),
  nausea: z.number().min(0).max(10).nullable(),
  breastTenderness: z.number().min(0).max(10).nullable(),
});

const draftShape = z.object({
  date: z.string().nullable().describe("ISO yyyy-mm-dd date the entry refers to. Null if the user did not specify."),
  mood: z.number().min(1).max(10).nullable(),
  energy: z.number().min(1).max(10).nullable(),
  stress: z.number().min(1).max(10).nullable(),
  symptoms: symptomsShape,
  bbt: z.number().nullable(),
  sleepHours: z.number().nullable(),
  sleepQuality: z.number().min(1).max(10).nullable(),
  notes: z.string(),
  confidence: z.number().min(0).max(1),
});

export type EntryDraft = z.infer<typeof draftShape>;

const emptyDraft: EntryDraft = {
  date: null, mood: null, energy: null, stress: null,
  symptoms: { cramps: null, fatigue: null, bloating: null, headache: null, nausea: null, breastTenderness: null },
  bbt: null, sleepHours: null, sleepQuality: null, notes: "", confidence: 0,
};

export const parseEntryFromText = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ text: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableGateway(key);
    const today = new Date().toISOString().slice(0, 10);
    try {
      const { output } = await generateText({
        model: gateway(COPILOT_MODEL),
        output: Output.object({ schema: draftShape }),
        prompt: [
          `Today is ${today}. Parse the following natural-language telemetry description into structured fields.`,
          "Return json only. Fields you cannot infer must be null. Symptom severities are 0-10. Mood/energy/stress are 1-10. Sleep quality is 1-10. BBT is in degrees Celsius. Include a brief 'notes' summary and a confidence score 0-1.",
          `Input: """${data.text}"""`,
        ].join("\n\n"),
      });
      return output as EntryDraft;
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err)) return emptyDraft;
      throw err;
    }
  });

export const generateNarrative = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      context: z.custom<AgentContextSnapshot>(),
      recordCount: z.number(),
      schemaVersion: z.string(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableGateway(key);
    const result = await generateText({
      model: gateway(COPILOT_MODEL),
      prompt: [
        "Write a concise (120-180 word) methods-and-findings paragraph for a research-grade export bundle of women's hormonal telemetry.",
        "Cover: subject cohort of 1 (self-tracked), collection window, cycle phases represented, data modalities (subjective, objective, biomarkers), anonymization posture, and 1-2 phase-conditioned observations from the data.",
        "Do NOT diagnose. Use neutral scientific tone. No bullet points.",
        `SCHEMA: ${data.schemaVersion}. RECORDS: ${data.recordCount}. ANONYMIZATION: ${data.context.profile.anonymizationLevel}.`,
        `CONTEXT JSON: ${JSON.stringify(data.context)}`,
      ].join("\n\n"),
    });
    return { narrative: result.text };
  });