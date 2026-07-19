
REVOKE SELECT ON public.mcphases_daily_features FROM anon, authenticated;
REFRESH MATERIALIZED VIEW public.mcphases_daily_features;
