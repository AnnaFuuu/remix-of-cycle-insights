
-- 1) Remove public read policies on mcphases_* tables and replace with authenticated-only
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies
           WHERE schemaname='public' AND tablename LIKE 'mcphases_%'
             AND 'public' = ANY(roles)
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Revoke anon access, keep authenticated + service_role
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'mcphases_%'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('CREATE POLICY "authenticated read %s" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
  END LOOP;
END $$;

-- 2) Materialized view: remove from Data API
REVOKE ALL ON public.mcphases_daily_features FROM anon, authenticated;
GRANT SELECT ON public.mcphases_daily_features TO service_role;

-- 3) SECURITY DEFINER function: restrict execute to service_role only
REVOKE ALL ON FUNCTION public.refresh_mcphases_daily_features() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_mcphases_daily_features() TO service_role;

-- 4) Storage policies for lab-reports bucket (owner-scoped by first path segment = user id)
DROP POLICY IF EXISTS "lab-reports owner read" ON storage.objects;
DROP POLICY IF EXISTS "lab-reports owner insert" ON storage.objects;
DROP POLICY IF EXISTS "lab-reports owner update" ON storage.objects;
DROP POLICY IF EXISTS "lab-reports owner delete" ON storage.objects;

CREATE POLICY "lab-reports owner read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'lab-reports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "lab-reports owner insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lab-reports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "lab-reports owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'lab-reports' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'lab-reports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "lab-reports owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'lab-reports' AND (storage.foldername(name))[1] = auth.uid()::text);
