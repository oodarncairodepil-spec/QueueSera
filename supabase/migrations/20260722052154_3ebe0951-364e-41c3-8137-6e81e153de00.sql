
-- Seller
INSERT INTO public.sellers (id, name, slug, logo_url, plugo_vendor_id, active)
VALUES ('11111111-1111-1111-1111-111111111111', 'Kopi Nusantara', 'kopi-nusantara',
  'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200&h=200&fit=crop', 'VENDOR-KN-001', true);

-- Events (times in Asia/Jakarta)
INSERT INTO public.events (id, seller_id, name, slug, description, banner_url, venue_name, venue_address,
  plugo_location_id, plugo_location_name, event_start_at, event_end_at, reservation_open_at, reservation_close_at,
  reservation_duration_minutes, arrival_grace_minutes, maximum_items_per_customer, safety_stock_quantity, status)
VALUES
('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
 'Summer Market 2026', 'summer-market-2026',
 'Kopi Nusantara & friends bring roasters, brewers and small-batch merch to Senayan for one weekend only.',
 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=1600&h=900&fit=crop',
 'Senayan Park Hall A', 'Jl. Asia Afrika No.8, Jakarta',
 'LOC-100', 'Senayan Park', now() - interval '2 hours', now() + interval '8 hours',
 now() - interval '1 hour', now() + interval '7 hours',
 20, 10, 6, 1, 'active'),
('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111',
 'Weekend Pop-Up', 'weekend-pop-up',
 'A quieter Sunday drop featuring seasonal beans and limited merch.',
 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=1600&h=900&fit=crop',
 'Blok M Plaza', 'Jl. Bulungan, Jakarta',
 'LOC-101', 'Blok M', now() + interval '3 days', now() + interval '3 days 8 hours',
 now() + interval '3 days', now() + interval '3 days 7 hours',
 20, 10, 6, 1, 'scheduled'),
('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111',
 'Spring Sale', 'spring-sale',
 'This event has ended.', 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1600&h=900&fit=crop',
 'Kemang Village', 'Jl. Kemang Raya, Jakarta',
 'LOC-102', 'Kemang', now() - interval '30 days', now() - interval '29 days',
 now() - interval '30 days', now() - interval '29 days',
 20, 10, 6, 1, 'closed');

-- Access code for active event: A7K9 (sha256)
INSERT INTO public.event_access_codes (event_id, code_hash, active)
VALUES ('22222222-2222-2222-2222-222222222222',
  encode(digest('A7K9', 'sha256'), 'hex'), true);
-- Access code for scheduled event: B8P2
INSERT INTO public.event_access_codes (event_id, code_hash, active)
VALUES ('33333333-3333-3333-3333-333333333333',
  encode(digest('B8P2', 'sha256'), 'hex'), true);

-- Products (12) for the active event
WITH data(idx, pid, name, descr, img, featured) AS (VALUES
 (1, 'P1001', 'Aceh Gayo Single Origin 250g', 'Bright, syrupy, notes of dark chocolate and jasmine.', 'https://images.unsplash.com/photo-1559525839-d9acfd0b0f0d?w=800', true),
 (2, 'P1002', 'Toraja Sapan 250g', 'Full-bodied with cedar and cocoa. Washed process.', 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=800', true),
 (3, 'P1003', 'Bali Kintamani 250g', 'Citrus-forward with a clean finish.', 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800', false),
 (4, 'P1004', 'Flores Bajawa 250g', 'Nutty, caramel, low acidity.', 'https://images.unsplash.com/photo-1611854779393-1b2da9d400fe?w=800', false),
 (5, 'P1005', 'House Blend 500g', 'Balanced daily driver for espresso.', 'https://images.unsplash.com/photo-1610889556528-9a770e32642f?w=800', false),
 (6, 'P1006', 'Cold Brew Concentrate', 'Ready-to-pour, keeps for 14 days.', 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=800', false),
 (7, 'P1007', 'Ceramic Dripper V60', 'Hand-poured ceramic in matte white.', 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800', false),
 (8, 'P1008', 'Stainless Server 600ml', 'Insulated server for pourover.', 'https://images.unsplash.com/photo-1518057111178-44a106bad636?w=800', false),
 (9, 'P1009', 'Enamel Mug', 'Chip-resistant enamel, campfire ready.', 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800', false),
 (10,'P1010', 'Roaster Tee', 'Heavyweight cotton, screen-printed.', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800', true),
 (11,'P1011', 'Bucket Hat', 'Sun-friendly linen bucket.', 'https://images.unsplash.com/photo-1521369909029-2afed882baee?w=800', false),
 (12,'P1012', 'Tote Bag', 'Canvas tote with brewer print.', 'https://images.unsplash.com/photo-1544441893-675973e31985?w=800', false)
)
INSERT INTO public.event_products (event_id, plugo_product_id, display_name, description, image_url, featured, display_order)
SELECT '22222222-2222-2222-2222-222222222222', pid, name, descr, img, featured, idx FROM data;

-- Variants: for beans / cold brew (P1001..P1006) size variants; for gear/merch color/size variants
DO $$
DECLARE
  ep RECORD;
  v_id UUID;
  base_price NUMERIC;
  size_labels TEXT[];
  color_labels TEXT[];
  s TEXT;
  c TEXT;
  var_seq INT := 0;
  qty INT;
BEGIN
  FOR ep IN SELECT * FROM public.event_products WHERE event_id = '22222222-2222-2222-2222-222222222222' ORDER BY display_order LOOP
    IF ep.plugo_product_id IN ('P1001','P1002','P1003','P1004') THEN
      base_price := 145000;
      size_labels := ARRAY['Whole Bean','Ground Coarse','Ground Fine'];
      FOREACH s IN ARRAY size_labels LOOP
        var_seq := var_seq + 1;
        INSERT INTO public.event_product_variants (event_product_id, plugo_variation_id, sku, display_name, size, price_snapshot, image_url_snapshot)
        VALUES (ep.id, 'V' || ep.plugo_product_id || '-' || var_seq, ep.plugo_product_id || '-' || upper(replace(s,' ','')), s, s, base_price, ep.image_url)
        RETURNING id INTO v_id;
        qty := CASE WHEN var_seq % 5 = 0 THEN 0 WHEN var_seq % 4 = 0 THEN 2 WHEN var_seq % 3 = 0 THEN 6 ELSE 25 END;
        INSERT INTO public.inventory_snapshots (event_id, plugo_location_id, plugo_product_id, plugo_variation_id, quantity)
          VALUES (ep.event_id, 'LOC-100', ep.plugo_product_id, 'V' || ep.plugo_product_id || '-' || var_seq, qty);
      END LOOP;
    ELSIF ep.plugo_product_id = 'P1005' THEN
      var_seq := var_seq + 1;
      INSERT INTO public.event_product_variants (event_product_id, plugo_variation_id, sku, display_name, price_snapshot, image_url_snapshot)
        VALUES (ep.id, 'V' || ep.plugo_product_id || '-1', ep.plugo_product_id || '-500', '500g Bag', 210000, ep.image_url) RETURNING id INTO v_id;
      INSERT INTO public.inventory_snapshots (event_id, plugo_location_id, plugo_product_id, plugo_variation_id, quantity)
        VALUES (ep.event_id, 'LOC-100', ep.plugo_product_id, 'V' || ep.plugo_product_id || '-1', 40);
    ELSIF ep.plugo_product_id = 'P1006' THEN
      var_seq := var_seq + 1;
      INSERT INTO public.event_product_variants (event_product_id, plugo_variation_id, sku, display_name, price_snapshot, image_url_snapshot)
        VALUES (ep.id, 'V' || ep.plugo_product_id || '-1', ep.plugo_product_id || '-1L', '1L Bottle', 95000, ep.image_url) RETURNING id INTO v_id;
      INSERT INTO public.inventory_snapshots (event_id, plugo_location_id, plugo_product_id, plugo_variation_id, quantity)
        VALUES (ep.event_id, 'LOC-100', ep.plugo_product_id, 'V' || ep.plugo_product_id || '-1', 3);
    ELSIF ep.plugo_product_id IN ('P1007','P1008') THEN
      color_labels := ARRAY['White','Black'];
      FOREACH c IN ARRAY color_labels LOOP
        var_seq := var_seq + 1;
        INSERT INTO public.event_product_variants (event_product_id, plugo_variation_id, sku, display_name, color, price_snapshot, image_url_snapshot)
          VALUES (ep.id, 'V' || ep.plugo_product_id || '-' || var_seq, ep.plugo_product_id || '-' || upper(c), c, c, CASE WHEN ep.plugo_product_id='P1007' THEN 185000 ELSE 320000 END, ep.image_url)
          RETURNING id INTO v_id;
        qty := CASE WHEN c='Black' THEN 8 ELSE 15 END;
        INSERT INTO public.inventory_snapshots (event_id, plugo_location_id, plugo_product_id, plugo_variation_id, quantity)
          VALUES (ep.event_id, 'LOC-100', ep.plugo_product_id, 'V' || ep.plugo_product_id || '-' || var_seq, qty);
      END LOOP;
    ELSIF ep.plugo_product_id = 'P1009' THEN
      color_labels := ARRAY['Sand','Forest','Ink'];
      FOREACH c IN ARRAY color_labels LOOP
        var_seq := var_seq + 1;
        INSERT INTO public.event_product_variants (event_product_id, plugo_variation_id, sku, display_name, color, price_snapshot, image_url_snapshot)
          VALUES (ep.id, 'V' || ep.plugo_product_id || '-' || var_seq, ep.plugo_product_id || '-' || upper(c), c, c, 78000, ep.image_url) RETURNING id INTO v_id;
        qty := CASE c WHEN 'Sand' THEN 30 WHEN 'Forest' THEN 5 ELSE 0 END;
        INSERT INTO public.inventory_snapshots (event_id, plugo_location_id, plugo_product_id, plugo_variation_id, quantity)
          VALUES (ep.event_id, 'LOC-100', ep.plugo_product_id, 'V' || ep.plugo_product_id || '-' || var_seq, qty);
      END LOOP;
    ELSIF ep.plugo_product_id IN ('P1010','P1011','P1012') THEN
      size_labels := CASE WHEN ep.plugo_product_id = 'P1010' THEN ARRAY['S','M','L','XL'] ELSE ARRAY['One Size'] END;
      color_labels := CASE ep.plugo_product_id WHEN 'P1010' THEN ARRAY['Black','Cream'] WHEN 'P1011' THEN ARRAY['Natural','Olive'] ELSE ARRAY['Natural'] END;
      FOREACH c IN ARRAY color_labels LOOP
        FOREACH s IN ARRAY size_labels LOOP
          var_seq := var_seq + 1;
          INSERT INTO public.event_product_variants (event_product_id, plugo_variation_id, sku, display_name, size, color, price_snapshot, image_url_snapshot)
            VALUES (ep.id, 'V' || ep.plugo_product_id || '-' || var_seq,
                    ep.plugo_product_id || '-' || upper(c) || '-' || upper(s),
                    c || ' / ' || s, s, c,
                    CASE ep.plugo_product_id WHEN 'P1010' THEN 245000 WHEN 'P1011' THEN 165000 ELSE 125000 END,
                    ep.image_url)
            RETURNING id INTO v_id;
          qty := CASE WHEN var_seq % 6 = 0 THEN 0 WHEN var_seq % 5 = 0 THEN 2 WHEN var_seq % 3 = 0 THEN 7 ELSE 20 END;
          INSERT INTO public.inventory_snapshots (event_id, plugo_location_id, plugo_product_id, plugo_variation_id, quantity)
            VALUES (ep.event_id, 'LOC-100', ep.plugo_product_id, 'V' || ep.plugo_product_id || '-' || var_seq, qty);
        END LOOP;
      END LOOP;
    END IF;
  END LOOP;
END $$;
