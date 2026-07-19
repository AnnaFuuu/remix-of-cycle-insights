
CREATE TABLE public.physionet_datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  source_url text,
  description text,
  citation text,
  subjects_count integer,
  variables_count integer,
  row_count integer NOT NULL DEFAULT 0,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.physionet_sleep_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL REFERENCES public.physionet_datasets(id) ON DELETE CASCADE,
  subject_id text NOT NULL,
  recording_date date,
  night_index integer,
  total_sleep_min numeric,
  deep_min numeric,
  light_min numeric,
  rem_min numeric,
  awake_min numeric,
  sleep_efficiency numeric,
  latency_min numeric,
  waso_min numeric,
  quality_score numeric,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_physionet_sleep_dataset_subject ON public.physionet_sleep_records(dataset_id, subject_id);
CREATE INDEX idx_physionet_sleep_date ON public.physionet_sleep_records(recording_date);

GRANT SELECT ON public.physionet_datasets TO anon, authenticated;
GRANT SELECT ON public.physionet_sleep_records TO anon, authenticated;
GRANT ALL ON public.physionet_datasets TO service_role;
GRANT ALL ON public.physionet_sleep_records TO service_role;

ALTER TABLE public.physionet_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physionet_sleep_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read datasets" ON public.physionet_datasets FOR SELECT USING (true);
CREATE POLICY "Public read sleep records" ON public.physionet_sleep_records FOR SELECT USING (true);
