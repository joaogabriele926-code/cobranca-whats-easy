CREATE TABLE public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  evolution_url text NOT NULL DEFAULT '',
  instance_name text NOT NULL DEFAULT '',
  api_key text NOT NULL DEFAULT '',
  admin_number text NOT NULL DEFAULT '',
  pix_key text NOT NULL DEFAULT '',
  pix_holder text NOT NULL DEFAULT '',
  bank text NOT NULL DEFAULT '',
  webhook_token text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.debtors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  whatsapp text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debtors TO authenticated;
GRANT ALL ON public.debtors TO service_role;
ALTER TABLE public.debtors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins logados gerenciam devedores" ON public.debtors FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debtor_id uuid NOT NULL REFERENCES public.debtors(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  installment integer NOT NULL DEFAULT 1,
  total_installments integer NOT NULL DEFAULT 1,
  due_date date NOT NULL,
  monthly boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pendente',
  paid_at timestamptz,
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.charges TO authenticated;
GRANT ALL ON public.charges TO service_role;
ALTER TABLE public.charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins logados gerenciam cobrancas" ON public.charges FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id uuid NOT NULL REFERENCES public.charges(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  confirmed_by text NOT NULL DEFAULT 'admin',
  note text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins logados gerenciam pagamentos" ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.messages_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL,
  number text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  event text,
  charge_id uuid REFERENCES public.charges(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages_log TO authenticated;
GRANT ALL ON public.messages_log TO service_role;
ALTER TABLE public.messages_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins logados veem historico" ON public.messages_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_charges_updated_at BEFORE UPDATE ON public.charges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.settings (singleton) VALUES (true);