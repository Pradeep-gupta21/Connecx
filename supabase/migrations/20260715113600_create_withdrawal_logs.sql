-- Migration to create withdrawal_logs table to track full history of withdrawal status transitions

CREATE TABLE IF NOT EXISTS public.withdrawal_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id uuid NOT NULL REFERENCES public.withdrawals(id) ON DELETE CASCADE,
  status text NOT NULL,
  admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  payout_provider text,
  gateway_reference text,
  provider_response jsonb,
  ip_address text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast timeline queries
CREATE INDEX IF NOT EXISTS withdrawal_logs_withdrawal_id_idx ON public.withdrawal_logs(withdrawal_id);
CREATE INDEX IF NOT EXISTS withdrawal_logs_created_at_idx ON public.withdrawal_logs(created_at DESC);

-- Enable RLS and grant permissions
GRANT SELECT, INSERT ON public.withdrawal_logs TO authenticated;
GRANT ALL ON public.withdrawal_logs TO service_role;

ALTER TABLE public.withdrawal_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "withdrawal_logs_select" ON public.withdrawal_logs 
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.withdrawals w
      WHERE w.id = withdrawal_logs.withdrawal_id
        AND (w.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "withdrawal_logs_admin_insert" ON public.withdrawal_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);
