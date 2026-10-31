-- Chatty Orders & Payments Table (Industrial Sales & Transaction Management)
CREATE TABLE IF NOT EXISTS chatty_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID REFERENCES chatty_bots(id) ON DELETE CASCADE NOT NULL,
  session_id TEXT,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'paypal', 'lemonsqueezy', 'polar')),
  order_type TEXT NOT NULL DEFAULT 'custom_checkout' CHECK (order_type IN ('custom_checkout', 'product_checkout', 'booking_payment', 'subscription')),
  attributed_to TEXT NOT NULL DEFAULT 'ai_agent' CHECK (attributed_to IN ('ai_agent', 'human_agent')),
  agent_email TEXT,
  channel TEXT NOT NULL DEFAULT 'web',
  title TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_country TEXT,
  checkout_url TEXT NOT NULL,
  gateway_order_id TEXT,
  gateway_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded', 'cancelled')),
  metadata JSONB DEFAULT '{}'::jsonb,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatty_orders_bot ON chatty_orders(bot_id);
CREATE INDEX IF NOT EXISTS idx_chatty_orders_session ON chatty_orders(session_id);
CREATE INDEX IF NOT EXISTS idx_chatty_orders_created ON chatty_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatty_orders_status ON chatty_orders(status);

ALTER TABLE chatty_orders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chatty_orders' AND policyname = 'Users can manage orders for their own bots'
  ) THEN
    CREATE POLICY "Users can manage orders for their own bots" ON chatty_orders
      FOR ALL TO authenticated
      USING (
        bot_id IN (SELECT id FROM chatty_bots WHERE user_id = auth.uid())
      )
      WITH CHECK (
        bot_id IN (SELECT id FROM chatty_bots WHERE user_id = auth.uid())
      );
  END IF;
END $$;
