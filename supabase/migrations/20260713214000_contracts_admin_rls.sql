-- Allow admins to read and update contracts under RLS
CREATE POLICY "Admins read all contracts" ON public.contracts 
  FOR SELECT TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update all contracts" ON public.contracts 
  FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin')) 
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
