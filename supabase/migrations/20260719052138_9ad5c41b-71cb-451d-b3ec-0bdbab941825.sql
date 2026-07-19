
CREATE OR REPLACE FUNCTION public.refresh_mcphases_daily_features()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  REFRESH MATERIALIZED VIEW public.mcphases_daily_features;
$$;

REVOKE ALL ON FUNCTION public.refresh_mcphases_daily_features() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_mcphases_daily_features() TO service_role;
