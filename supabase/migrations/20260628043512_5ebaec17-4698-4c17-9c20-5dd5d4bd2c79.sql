-- ============================================================
-- Finding 1: Restrict financial table policies to authenticated
-- ============================================================

-- goals
DROP POLICY IF EXISTS "Users can view own goals" ON public.goals;
DROP POLICY IF EXISTS "Users can insert own goals" ON public.goals;
DROP POLICY IF EXISTS "Users can update own goals" ON public.goals;
DROP POLICY IF EXISTS "Users can delete own goals" ON public.goals;
CREATE POLICY "Users can view own goals" ON public.goals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON public.goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON public.goals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON public.goals FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- cards
DROP POLICY IF EXISTS "Users can view own cards" ON public.cards;
DROP POLICY IF EXISTS "Users can insert own cards" ON public.cards;
DROP POLICY IF EXISTS "Users can update own cards" ON public.cards;
DROP POLICY IF EXISTS "Users can delete own cards" ON public.cards;
CREATE POLICY "Users can view own cards" ON public.cards FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cards" ON public.cards FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cards" ON public.cards FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own cards" ON public.cards FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- assets
DROP POLICY IF EXISTS "Users can view own assets" ON public.assets;
DROP POLICY IF EXISTS "Users can insert own assets" ON public.assets;
DROP POLICY IF EXISTS "Users can update own assets" ON public.assets;
DROP POLICY IF EXISTS "Users can delete own assets" ON public.assets;
CREATE POLICY "Users can view own assets" ON public.assets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own assets" ON public.assets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own assets" ON public.assets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own assets" ON public.assets FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- debts
DROP POLICY IF EXISTS "Users can view own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can insert own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can update own debts" ON public.debts;
DROP POLICY IF EXISTS "Users can delete own debts" ON public.debts;
CREATE POLICY "Users can view own debts" ON public.debts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own debts" ON public.debts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own debts" ON public.debts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own debts" ON public.debts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- installment_purchases
DROP POLICY IF EXISTS "Users can view own installments" ON public.installment_purchases;
DROP POLICY IF EXISTS "Users can insert own installments" ON public.installment_purchases;
DROP POLICY IF EXISTS "Users can update own installments" ON public.installment_purchases;
DROP POLICY IF EXISTS "Users can delete own installments" ON public.installment_purchases;
CREATE POLICY "Users can view own installments" ON public.installment_purchases FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own installments" ON public.installment_purchases FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own installments" ON public.installment_purchases FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own installments" ON public.installment_purchases FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- Finding 2: Stop exposing plaintext verification_code to clients
-- Remove table-wide SELECT and grant only non-sensitive columns.
-- verification_code stays readable only via server-side (service role).
-- ============================================================

REVOKE SELECT ON public.whatsapp_links FROM authenticated;
REVOKE SELECT ON public.whatsapp_links FROM anon;
GRANT SELECT (id, user_id, phone, verified, created_at, updated_at) ON public.whatsapp_links TO authenticated;