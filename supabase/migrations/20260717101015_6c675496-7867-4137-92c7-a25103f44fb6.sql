
ALTER TABLE public.whatsapp_links
  ADD COLUMN IF NOT EXISTS verification_code_hash text,
  ADD COLUMN IF NOT EXISTS verification_code_salt text,
  ADD COLUMN IF NOT EXISTS verification_code_expires_at timestamptz;

-- Invalida qualquer código em texto puro previamente salvo.
UPDATE public.whatsapp_links SET verification_code = NULL WHERE verification_code IS NOT NULL;
