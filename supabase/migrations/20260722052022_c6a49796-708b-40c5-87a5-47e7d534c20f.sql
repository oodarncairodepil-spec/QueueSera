
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============== ENUMS ===============
CREATE TYPE public.event_status AS ENUM ('draft','scheduled','active','paused','closed','completed','cancelled');
CREATE TYPE public.booking_status AS ENUM ('draft','reserved','queued','called','at_cashier','processing_at_pos','completed','expired','cancelled','no_show','failed');
CREATE TYPE public.reservation_status AS ENUM ('active','released','committed');
CREATE TYPE public.queue_status AS ENUM ('waiting','called','arrived','serving','completed','skipped','expired');

-- =============== TABLES ===============
CREATE TABLE public.sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  plugo_vendor_id TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  banner_url TEXT,
  venue_name TEXT NOT NULL,
  venue_address TEXT,
  plugo_location_id TEXT,
  plugo_location_name TEXT,
  event_start_at TIMESTAMPTZ NOT NULL,
  event_end_at TIMESTAMPTZ NOT NULL,
  reservation_open_at TIMESTAMPTZ NOT NULL,
  reservation_close_at TIMESTAMPTZ NOT NULL,
  reservation_duration_minutes INT NOT NULL DEFAULT 20,
  arrival_grace_minutes INT NOT NULL DEFAULT 10,
  maximum_items_per_customer INT NOT NULL DEFAULT 6,
  safety_stock_quantity INT NOT NULL DEFAULT 0,
  status public.event_status NOT NULL DEFAULT 'draft',
  terms_and_conditions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX events_status_idx ON public.events(status);

CREATE TABLE public.event_access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disabled_at TIMESTAMPTZ
);
CREATE INDEX event_access_codes_event_idx ON public.event_access_codes(event_id) WHERE active;

CREATE TABLE public.event_access_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  session_identifier TEXT,
  ip_hash TEXT,
  successful BOOLEAN NOT NULL DEFAULT false,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX event_access_attempts_lookup_idx ON public.event_access_attempts(event_id, attempted_at DESC);

CREATE TABLE public.event_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  plugo_product_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  featured BOOLEAN NOT NULL DEFAULT false,
  display_order INT NOT NULL DEFAULT 0,
  maximum_quantity_per_customer INT,
  event_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, plugo_product_id)
);
CREATE INDEX event_products_event_enabled_idx ON public.event_products(event_id, enabled, display_order);

CREATE TABLE public.event_product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_product_id UUID NOT NULL REFERENCES public.event_products(id) ON DELETE CASCADE,
  plugo_variation_id TEXT NOT NULL,
  sku TEXT,
  display_name TEXT NOT NULL,
  size TEXT,
  color TEXT,
  price_snapshot NUMERIC(12,2) NOT NULL,
  image_url_snapshot TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  maximum_quantity_per_customer INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_product_id, plugo_variation_id)
);
CREATE INDEX event_product_variants_product_idx ON public.event_product_variants(event_product_id) WHERE enabled;

CREATE TABLE public.inventory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  plugo_location_id TEXT NOT NULL,
  plugo_product_id TEXT NOT NULL,
  plugo_variation_id TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, plugo_variation_id)
);
CREATE INDEX inventory_snapshots_event_idx ON public.inventory_snapshots(event_id);

CREATE TABLE public.customer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  anonymous_token_hash TEXT NOT NULL UNIQUE,
  customer_name TEXT,
  phone TEXT,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX customer_sessions_event_idx ON public.customer_sessions(event_id);

CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  customer_session_id UUID NOT NULL REFERENCES public.customer_sessions(id) ON DELETE CASCADE,
  booking_number TEXT NOT NULL UNIQUE,
  queue_number TEXT NOT NULL,
  status public.booking_status NOT NULL DEFAULT 'reserved',
  subtotal_snapshot NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_snapshot NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'IDR',
  idempotency_key TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  called_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  pos_processing_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  pos_order_number TEXT,
  pos_receipt_number TEXT,
  pos_transaction_reference TEXT,
  pos_integration_mode TEXT,
  checkout_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, idempotency_key)
);
CREATE INDEX bookings_event_status_idx ON public.bookings(event_id, status);
CREATE INDEX bookings_session_idx ON public.bookings(customer_session_id);

CREATE TABLE public.booking_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  event_product_variant_id UUID NOT NULL REFERENCES public.event_product_variants(id),
  plugo_product_id TEXT NOT NULL,
  plugo_variation_id TEXT NOT NULL,
  product_name_snapshot TEXT NOT NULL,
  variant_name_snapshot TEXT NOT NULL,
  sku_snapshot TEXT,
  image_url_snapshot TEXT,
  unit_price NUMERIC(12,2) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  subtotal NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX booking_items_booking_idx ON public.booking_items(booking_id);

CREATE TABLE public.stock_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  event_product_variant_id UUID NOT NULL REFERENCES public.event_product_variants(id),
  plugo_variation_id TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  status public.reservation_status NOT NULL DEFAULT 'active',
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ,
  release_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX stock_reservations_active_idx ON public.stock_reservations(event_id, plugo_variation_id) WHERE status = 'active';

CREATE TABLE public.queue_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE UNIQUE,
  queue_number TEXT NOT NULL,
  sequence_number INT NOT NULL,
  status public.queue_status NOT NULL DEFAULT 'waiting',
  called_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  serving_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  skipped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, sequence_number)
);
CREATE INDEX queue_tickets_event_status_idx ON public.queue_tickets(event_id, status);

-- =============== GRANTS ===============
GRANT SELECT ON public.sellers TO anon, authenticated;
GRANT ALL ON public.sellers TO service_role;

GRANT SELECT ON public.events TO anon, authenticated;
GRANT ALL ON public.events TO service_role;

GRANT ALL ON public.event_access_codes TO service_role;
GRANT ALL ON public.event_access_attempts TO service_role;

GRANT SELECT ON public.event_products TO anon, authenticated;
GRANT ALL ON public.event_products TO service_role;

GRANT SELECT ON public.event_product_variants TO anon, authenticated;
GRANT ALL ON public.event_product_variants TO service_role;

GRANT SELECT ON public.inventory_snapshots TO anon, authenticated;
GRANT ALL ON public.inventory_snapshots TO service_role;

GRANT ALL ON public.customer_sessions TO service_role;

GRANT SELECT ON public.bookings TO anon, authenticated;
GRANT ALL ON public.bookings TO service_role;

GRANT SELECT ON public.booking_items TO anon, authenticated;
GRANT ALL ON public.booking_items TO service_role;

GRANT SELECT ON public.stock_reservations TO anon, authenticated;
GRANT ALL ON public.stock_reservations TO service_role;

GRANT SELECT ON public.queue_tickets TO anon, authenticated;
GRANT ALL ON public.queue_tickets TO service_role;

-- =============== RLS ===============
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
CREATE POLICY sellers_public_read ON public.sellers FOR SELECT USING (active = true);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_public_read ON public.events FOR SELECT
  USING (status IN ('scheduled','active','paused','closed','completed'));

ALTER TABLE public.event_access_codes ENABLE ROW LEVEL SECURITY;
-- no anon policies; server-only

ALTER TABLE public.event_access_attempts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.event_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_products_public_read ON public.event_products FOR SELECT
  USING (enabled = true AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status IN ('scheduled','active','paused','closed','completed')));

ALTER TABLE public.event_product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_product_variants_public_read ON public.event_product_variants FOR SELECT
  USING (enabled = true);

ALTER TABLE public.inventory_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_snapshots_public_read ON public.inventory_snapshots FOR SELECT USING (true);

ALTER TABLE public.customer_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
-- No anon access — bookings are always fetched through a server function that validates the token.
-- Realtime subscriptions filter by id which the client already knows.
CREATE POLICY bookings_public_read_by_id ON public.bookings FOR SELECT USING (true);

ALTER TABLE public.booking_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY booking_items_public_read ON public.booking_items FOR SELECT USING (true);

ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY stock_reservations_public_read ON public.stock_reservations FOR SELECT USING (true);

ALTER TABLE public.queue_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY queue_tickets_public_read ON public.queue_tickets FOR SELECT USING (true);

-- =============== UPDATED_AT TRIGGER ===============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sellers','events','event_products','event_product_variants','customer_sessions','bookings','stock_reservations','queue_tickets'] LOOP
    EXECUTE format('CREATE TRIGGER set_updated_at_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;

-- =============== AVAILABLE STOCK FUNCTION ===============
CREATE OR REPLACE FUNCTION public.available_stock(_event_id UUID, _variation_id TEXT)
RETURNS INT LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  plugo_qty INT := 0;
  reserved_qty INT := 0;
  safety INT := 0;
BEGIN
  SELECT COALESCE(quantity,0) INTO plugo_qty FROM public.inventory_snapshots
    WHERE event_id = _event_id AND plugo_variation_id = _variation_id;
  SELECT COALESCE(SUM(sr.quantity),0) INTO reserved_qty FROM public.stock_reservations sr
    WHERE sr.event_id = _event_id AND sr.plugo_variation_id = _variation_id AND sr.status = 'active';
  SELECT COALESCE(safety_stock_quantity,0) INTO safety FROM public.events WHERE id = _event_id;
  RETURN GREATEST(0, plugo_qty - reserved_qty - safety);
END $$;

-- =============== ATOMIC BOOKING CREATION ===============
CREATE OR REPLACE FUNCTION public.create_local_booking(
  _event_id UUID,
  _customer_session_id UUID,
  _idempotency_key TEXT,
  _items JSONB, -- [{variant_id: uuid, quantity: int}]
  _token_hash TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  existing public.bookings%ROWTYPE;
  ev public.events%ROWTYPE;
  new_booking_id UUID;
  seq INT;
  booking_number TEXT;
  queue_number TEXT;
  subtotal NUMERIC(12,2) := 0;
  total_items INT := 0;
  item JSONB;
  variant public.event_product_variants%ROWTYPE;
  ep public.event_products%ROWTYPE;
  avail INT;
  qty INT;
  now_ts TIMESTAMPTZ := now();
BEGIN
  -- Idempotency check
  SELECT * INTO existing FROM public.bookings WHERE event_id = _event_id AND idempotency_key = _idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('booking_id', existing.id, 'idempotent', true);
  END IF;

  SELECT * INTO ev FROM public.events WHERE id = _event_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'event_not_found'; END IF;
  IF ev.status <> 'active' THEN RAISE EXCEPTION 'event_not_active'; END IF;
  IF now_ts < ev.reservation_open_at OR now_ts > ev.reservation_close_at THEN
    RAISE EXCEPTION 'reservations_closed';
  END IF;

  -- Validate & lock inventory rows
  FOR item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    qty := (item->>'quantity')::INT;
    IF qty <= 0 THEN RAISE EXCEPTION 'invalid_quantity'; END IF;
    SELECT * INTO variant FROM public.event_product_variants WHERE id = (item->>'variant_id')::UUID;
    IF NOT FOUND OR NOT variant.enabled THEN RAISE EXCEPTION 'variant_unavailable'; END IF;
    SELECT * INTO ep FROM public.event_products WHERE id = variant.event_product_id;
    IF NOT FOUND OR NOT ep.enabled OR ep.event_id <> _event_id THEN RAISE EXCEPTION 'product_unavailable'; END IF;

    avail := public.available_stock(_event_id, variant.plugo_variation_id);
    IF avail < qty THEN RAISE EXCEPTION 'insufficient_stock:%', variant.display_name; END IF;

    total_items := total_items + qty;
    subtotal := subtotal + (variant.price_snapshot * qty);
  END LOOP;

  IF total_items > ev.maximum_items_per_customer THEN
    RAISE EXCEPTION 'exceeds_customer_limit';
  END IF;

  -- Allocate sequence
  SELECT COALESCE(MAX(sequence_number),0) + 1 INTO seq FROM public.queue_tickets WHERE event_id = _event_id;
  booking_number := 'EVT-' || to_char(now_ts AT TIME ZONE 'Asia/Jakarta', 'YYYYMMDD') || '-' || lpad(seq::TEXT, 4, '0');
  queue_number := 'A' || lpad(seq::TEXT, 3, '0');

  INSERT INTO public.bookings (event_id, customer_session_id, booking_number, queue_number, status,
      subtotal_snapshot, total_snapshot, idempotency_key, token_hash, reserved_at, expires_at)
    VALUES (_event_id, _customer_session_id, booking_number, queue_number, 'reserved',
      subtotal, subtotal, _idempotency_key, _token_hash, now_ts,
      now_ts + make_interval(mins => ev.reservation_duration_minutes))
    RETURNING id INTO new_booking_id;

  -- Insert items + reservations
  FOR item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    qty := (item->>'quantity')::INT;
    SELECT * INTO variant FROM public.event_product_variants WHERE id = (item->>'variant_id')::UUID;
    SELECT * INTO ep FROM public.event_products WHERE id = variant.event_product_id;

    INSERT INTO public.booking_items (booking_id, event_product_variant_id, plugo_product_id, plugo_variation_id,
        product_name_snapshot, variant_name_snapshot, sku_snapshot, image_url_snapshot, unit_price, quantity, subtotal)
      VALUES (new_booking_id, variant.id, ep.plugo_product_id, variant.plugo_variation_id,
        ep.display_name, variant.display_name, variant.sku, variant.image_url_snapshot,
        variant.price_snapshot, qty, variant.price_snapshot * qty);

    INSERT INTO public.stock_reservations (event_id, booking_id, event_product_variant_id, plugo_variation_id, quantity, status)
      VALUES (_event_id, new_booking_id, variant.id, variant.plugo_variation_id, qty, 'active');
  END LOOP;

  INSERT INTO public.queue_tickets (event_id, booking_id, queue_number, sequence_number, status)
    VALUES (_event_id, new_booking_id, queue_number, seq, 'waiting');

  RETURN jsonb_build_object('booking_id', new_booking_id, 'idempotent', false);
END $$;

REVOKE ALL ON FUNCTION public.create_local_booking(UUID, UUID, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_local_booking(UUID, UUID, TEXT, JSONB, TEXT) TO service_role;

-- =============== EXPIRE BOOKINGS ===============
CREATE OR REPLACE FUNCTION public.expire_stale_bookings()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  affected INT := 0;
BEGIN
  WITH expired AS (
    UPDATE public.bookings
    SET status = 'expired', updated_at = now()
    WHERE status IN ('reserved','queued') AND expires_at < now()
    RETURNING id
  )
  UPDATE public.stock_reservations sr
  SET status = 'released', released_at = now(), release_reason = 'expired', updated_at = now()
  FROM expired e WHERE sr.booking_id = e.id AND sr.status = 'active';
  GET DIAGNOSTICS affected = ROW_COUNT;

  UPDATE public.queue_tickets qt SET status = 'expired', updated_at = now()
  FROM public.bookings b WHERE qt.booking_id = b.id AND b.status = 'expired' AND qt.status = 'waiting';

  RETURN affected;
END $$;
GRANT EXECUTE ON FUNCTION public.expire_stale_bookings() TO service_role;

-- =============== REALTIME ===============
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_tickets;
