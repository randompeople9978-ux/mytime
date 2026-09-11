CREATE POLICY "public read ads bucket" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'ads');
CREATE POLICY "admins upload ads bucket" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ads' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update ads bucket" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'ads' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete ads bucket" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ads' AND public.has_role(auth.uid(), 'admin'));