import { createServerFn } from "@tanstack/react-start";

// Cache the latest result of each pipeline step so the training panels
// can hydrate from disk instead of re-running heavy compute on every mount.

export type PipelineStep =
  | "split"
  | "features"
  | "preprocess"
  | "regression"
  | "classification";

export interface PipelineRun<T = unknown> {
  step: PipelineStep;
  result: T;
  ranAt: string;
}

export const getPipelineRun = createServerFn({ method: "GET" })
  .inputValidator((input: { step: PipelineStep }) => input)
  .handler(async ({ data }): Promise<PipelineRun | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabaseAdmin.from("mcphases_pipeline_runs" as any) as any)
      .select("step, result, ran_at")
      .eq("step", data.step)
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;
    return { step: row.step as PipelineStep, result: row.result, ranAt: row.ran_at };
  });

// Server-only helper (not a server fn) used by the training handlers.
export async function savePipelineRun(step: PipelineStep, result: unknown): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin.from("mcphases_pipeline_runs" as any) as any)
    .upsert({ step, result, ran_at: new Date().toISOString() }, { onConflict: "step" });
  if (error) throw error;
}
