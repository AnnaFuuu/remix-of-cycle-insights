CREATE TABLE public.mcphases_trained_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL UNIQUE,
  algo text NOT NULL,
  predictors jsonb NOT NULL,
  medians jsonb NOT NULL,
  classes jsonb NOT NULL,
  artifact jsonb NOT NULL,
  metrics jsonb NOT NULL,
  n_train integer NOT NULL,
  trained_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.mcphases_trained_models TO service_role;

ALTER TABLE public.mcphases_trained_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only" ON public.mcphases_trained_models
  FOR ALL TO service_role USING (true) WITH CHECK (true);