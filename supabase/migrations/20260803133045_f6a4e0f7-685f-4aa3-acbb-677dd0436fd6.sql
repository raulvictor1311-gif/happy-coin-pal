ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS debit_mode text NOT NULL DEFAULT 'on_payment';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS invoice_paid boolean NOT NULL DEFAULT false;
ALTER TABLE public.installment_purchases ADD COLUMN IF NOT EXISTS card_id_ref uuid;