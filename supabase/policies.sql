-- ============================================================================
-- NEBA Cafe -- Row-Level Security (RLS) Policies
-- ============================================================================
--
-- HOW TO APPLY
-- ────────────
-- 1. Go to https://supabase.com/dashboard/project/evpigfgyjedevisqoche
-- 2. Click "SQL Editor" in the left sidebar
-- 3. Paste this entire file and click "Run"
--
-- WHEN TO APPLY
-- ─────────────
-- Run this SQL if:
--   (a) You do NOT have SUPABASE_SERVICE_ROLE_KEY set in your .env, OR
--   (b) You want anon/browser clients to read their own orders
--
-- If SUPABASE_SERVICE_ROLE_KEY is set, the server API bypasses RLS automatically
-- and these policies become defence-in-depth (still recommended to apply).
--
-- This script is idempotent -- safe to run multiple times.
-- ============================================================================

-- 1. Enable RLS on all relevant tables
--    (No-op if already enabled; safe to re-run)
ALTER TABLE public.orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers     ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Drop existing policies (prevents duplicate-policy errors on re-run)
-- ─────────────────────────────────────────────────────────────────────────────

-- orders
DROP POLICY IF EXISTS "Allow anon insert on orders"  ON public.orders;
DROP POLICY IF EXISTS "Allow anon select on orders"  ON public.orders;
DROP POLICY IF EXISTS "Allow anon update on orders"  ON public.orders;

-- order_items
DROP POLICY IF EXISTS "Allow anon insert on order_items" ON public.order_items;
DROP POLICY IF EXISTS "Allow anon select on order_items" ON public.order_items;

-- payments
DROP POLICY IF EXISTS "Allow anon insert on payments" ON public.payments;
DROP POLICY IF EXISTS "Allow anon select on payments" ON public.payments;
DROP POLICY IF EXISTS "Allow anon update on payments" ON public.payments;

-- customers
DROP POLICY IF EXISTS "Allow anon insert on customers" ON public.customers;
DROP POLICY IF EXISTS "Allow anon select on customers" ON public.customers;
DROP POLICY IF EXISTS "Allow anon update on customers" ON public.customers;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ORDERS policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Server API (and customers) can insert new orders
CREATE POLICY "Allow anon insert on orders"
  ON public.orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status IN ('received', 'confirmed')
    AND total_amount >= 0
  );

-- Anyone can read any order (order ID acts as the secret token for tracking)
CREATE POLICY "Allow anon select on orders"
  ON public.orders
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Status and payment updates from server API
CREATE POLICY "Allow anon update on orders"
  ON public.orders
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ORDER_ITEMS policies
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Allow anon insert on order_items"
  ON public.order_items
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (quantity > 0 AND unit_price >= 0);

CREATE POLICY "Allow anon select on order_items"
  ON public.order_items
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. PAYMENTS policies
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Allow anon insert on payments"
  ON public.payments
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (amount >= 0);

CREATE POLICY "Allow anon select on payments"
  ON public.payments
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anon update on payments"
  ON public.payments
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. CUSTOMERS policies
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Allow anon insert on customers"
  ON public.customers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (name IS NOT NULL AND phone IS NOT NULL);

CREATE POLICY "Allow anon select on customers"
  ON public.customers
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allows updating customer name/contact info (e.g. from account page)
CREATE POLICY "Allow anon update on customers"
  ON public.customers
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
