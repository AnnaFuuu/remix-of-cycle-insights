CREATE TABLE public.mcphases_pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  step text unique not null,
  result jsonb not null,
  ran_at timestamptz not null default now()
);

GRANT ALL ON public.mcphases_pipeline_runs TO service_role;

ALTER TABLE public.mcphases_pipeline_runs ENABLE ROW LEVEL SECURITY;

-- No user policies — reads/writes go through server functions using supabaseAdmin.