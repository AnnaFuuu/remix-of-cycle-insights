
-- owner_id is a client-generated UUID stored in localStorage; no auth in this project.
-- We enforce per-row isolation by requiring the request to supply owner_id and
-- matching it via RLS using request GUC set from the server; simpler here we
-- gate all writes/reads through server functions (service_role) and use RLS
-- as defense-in-depth by disallowing direct anon access.

CREATE TABLE public.lab_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  report_date date NOT NULL,
  source_filename text NOT NULL,
  source_mime text NOT NULL,
  storage_path text NOT NULL,
  extracted jsonb NOT NULL DEFAULT '[]'::jsonb,
  pii_ciphertext text,
  ai_model text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lab_reports_owner_date_idx ON public.lab_reports (owner_id, report_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_reports TO authenticated;
GRANT ALL ON public.lab_reports TO service_role;
ALTER TABLE public.lab_reports ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies: all access goes through server functions
-- (service_role). Absence of policies denies direct client access by default.

CREATE TABLE public.prediction_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  predicted_at timestamptz NOT NULL DEFAULT now(),
  inputs jsonb NOT NULL,
  phase text NOT NULL,
  confidence numeric NOT NULL,
  probabilities jsonb NOT NULL,
  imputed jsonb NOT NULL DEFAULT '{}'::jsonb,
  matched_lab_report_id uuid REFERENCES public.lab_reports(id) ON DELETE SET NULL,
  actual_lh numeric,
  actual_estradiol numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prediction_history_owner_time_idx
  ON public.prediction_history (owner_id, predicted_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prediction_history TO authenticated;
GRANT ALL ON public.prediction_history TO service_role;
ALTER TABLE public.prediction_history ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER lab_reports_touch BEFORE UPDATE ON public.lab_reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
