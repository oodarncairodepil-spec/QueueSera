import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ---------- helpers (server-only, loaded lazily) ----------
async function sha256Hex(input: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(input).digest("hex");
}

function isPubliclyVisible(status: string) {
  return ["scheduled", "active", "paused", "closed", "completed"].includes(status);
}

function tierForQty(q: number): "available" | "low" | "almost" | "sold_out" {
  if (q <= 0) return "sold_out";
  if (q <= 3) return "almost";
  if (q <= 10) return "low";
  return "available";
}

// ---------- GET EVENT ----------
export const getEventBySlug = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: event } = await supabaseAdmin
      .from("events")
      .select("*, seller:sellers(id,name,slug,logo_url)")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!event) return null;
    if (!isPubliclyVisible(event.status)) return null;
    return event;
  });

// ---------- VERIFY ACCESS CODE ----------
const CODE_RE = /^[A-Z0-9]{4}$/;
export const verifyAccessCode = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1),
        code: z.string().transform((s) => s.toUpperCase()),
        sessionSeed: z.string().min(16), // client-generated id used for rate-limit bucketing
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (!CODE_RE.test(data.code)) return { ok: false as const, error: "invalid_format" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: event } = await supabaseAdmin
      .from("events")
      .select("id,status,reservation_open_at,reservation_close_at")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!event || event.status !== "active") return { ok: false as const, error: "event_not_active" };

    // Rate limit: 5 attempts / 10 minutes per session seed
    const cutoff = new Date(Date.now() - 10 * 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("event_access_attempts")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id)
      .eq("session_identifier", data.sessionSeed)
      .eq("successful", false)
      .gte("attempted_at", cutoff);
    if ((count ?? 0) >= 5) return { ok: false as const, error: "rate_limited" };

    const codeHash = await sha256Hex(data.code);
    const { data: match } = await supabaseAdmin
      .from("event_access_codes")
      .select("id")
      .eq("event_id", event.id)
      .eq("active", true)
      .eq("code_hash", codeHash)
      .maybeSingle();

    if (!match) {
      await supabaseAdmin.from("event_access_attempts").insert({
        event_id: event.id,
        session_identifier: data.sessionSeed,
        successful: false,
      });
      return { ok: false as const, error: "invalid_code" };
    }

    // Issue a session token. Raw token returned to browser; hash stored in DB.
    const rawToken = await sha256Hex(data.sessionSeed + ":" + Date.now() + ":" + Math.random());
    const tokenHash = await sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + 8 * 60 * 60_000).toISOString();

    const { error: insertErr } = await supabaseAdmin.from("customer_sessions").insert({
      event_id: event.id,
      anonymous_token_hash: tokenHash,
      verified_at: new Date().toISOString(),
      expires_at: expiresAt,
    });
    if (insertErr) return { ok: false as const, error: "session_error" };

    await supabaseAdmin.from("event_access_attempts").insert({
      event_id: event.id,
      session_identifier: data.sessionSeed,
      successful: true,
    });

    return { ok: true as const, sessionToken: rawToken, expiresAt };
  });

// ---------- SAVE CUSTOMER INFO ----------
export const saveCustomerInfo = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        sessionToken: z.string().min(16),
        customerName: z.string().trim().max(80).optional(),
        phone: z.string().trim().max(30).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hash = await sha256Hex(data.sessionToken);
    const { error } = await supabaseAdmin
      .from("customer_sessions")
      .update({ customer_name: data.customerName || null, phone: data.phone || null })
      .eq("anonymous_token_hash", hash);
    if (error) return { ok: false as const };
    return { ok: true as const };
  });

// ---------- LIST PRODUCTS ----------
export const listEventProducts = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: event } = await supabaseAdmin
      .from("events")
      .select("id, safety_stock_quantity")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!event) return [];

    const { data: products } = await supabaseAdmin
      .from("event_products")
      .select(
        "id, plugo_product_id, display_name, description, image_url, featured, display_order, event_product_variants(id, plugo_variation_id, display_name, price_snapshot, image_url_snapshot, enabled)",
      )
      .eq("event_id", event.id)
      .eq("enabled", true)
      .order("display_order");

    const { data: inv } = await supabaseAdmin
      .from("inventory_snapshots")
      .select("plugo_variation_id, quantity")
      .eq("event_id", event.id);
    const invMap = new Map((inv ?? []).map((r) => [r.plugo_variation_id, r.quantity]));

    // Active reservations
    const { data: resv } = await supabaseAdmin
      .from("stock_reservations")
      .select("plugo_variation_id, quantity")
      .eq("event_id", event.id)
      .eq("status", "active");
    const resvMap = new Map<string, number>();
    for (const r of resv ?? []) resvMap.set(r.plugo_variation_id, (resvMap.get(r.plugo_variation_id) ?? 0) + r.quantity);

    const safety = event.safety_stock_quantity ?? 0;

    return (products ?? []).map((p: any) => {
      const variants = p.event_product_variants ?? [];
      const enabledVariants = variants.filter((v: any) => v.enabled);
      const availableVariants = enabledVariants.filter((v: any) => {
        const q = (invMap.get(v.plugo_variation_id) ?? 0) - (resvMap.get(v.plugo_variation_id) ?? 0) - safety;
        return q > 0;
      });
      const totalAvailable = enabledVariants.reduce((s: number, v: any) => {
        const q = (invMap.get(v.plugo_variation_id) ?? 0) - (resvMap.get(v.plugo_variation_id) ?? 0) - safety;
        return s + Math.max(0, q);
      }, 0);
      const startingPrice = Math.min(...enabledVariants.map((v: any) => Number(v.price_snapshot)));
      return {
        id: p.id,
        plugoProductId: p.plugo_product_id,
        name: p.display_name,
        description: p.description,
        imageUrl: p.image_url,
        featured: p.featured,
        startingPrice: Number.isFinite(startingPrice) ? startingPrice : 0,
        variantCount: enabledVariants.length,
        availableVariantCount: availableVariants.length,
        availabilityTier: tierForQty(totalAvailable),
      };
    });
  });

// ---------- GET PRODUCT DETAILS ----------
export const getEventProduct = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string(), productId: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: event } = await supabaseAdmin
      .from("events")
      .select("id, safety_stock_quantity, maximum_items_per_customer")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!event) return null;
    const { data: product } = await supabaseAdmin
      .from("event_products")
      .select("*, event_product_variants(*)")
      .eq("event_id", event.id)
      .eq("id", data.productId)
      .eq("enabled", true)
      .maybeSingle();
    if (!product) return null;

    const varIds = product.event_product_variants.map((v: any) => v.plugo_variation_id);
    const { data: inv } = await supabaseAdmin
      .from("inventory_snapshots")
      .select("plugo_variation_id, quantity")
      .eq("event_id", event.id)
      .in("plugo_variation_id", varIds.length ? varIds : ["__none__"]);
    const invMap = new Map((inv ?? []).map((r) => [r.plugo_variation_id, r.quantity]));
    const { data: resv } = await supabaseAdmin
      .from("stock_reservations")
      .select("plugo_variation_id, quantity")
      .eq("event_id", event.id)
      .eq("status", "active")
      .in("plugo_variation_id", varIds.length ? varIds : ["__none__"]);
    const resvMap = new Map<string, number>();
    for (const r of resv ?? []) resvMap.set(r.plugo_variation_id, (resvMap.get(r.plugo_variation_id) ?? 0) + r.quantity);
    const safety = event.safety_stock_quantity ?? 0;

    return {
      id: product.id,
      name: product.display_name,
      description: product.description,
      imageUrl: product.image_url,
      maxPerCustomer: product.maximum_quantity_per_customer ?? event.maximum_items_per_customer,
      variants: product.event_product_variants
        .filter((v: any) => v.enabled)
        .map((v: any) => {
          const q = (invMap.get(v.plugo_variation_id) ?? 0) - (resvMap.get(v.plugo_variation_id) ?? 0) - safety;
          const available = Math.max(0, q);
          return {
            id: v.id,
            plugoVariationId: v.plugo_variation_id,
            name: v.display_name,
            size: v.size,
            color: v.color,
            sku: v.sku,
            price: Number(v.price_snapshot),
            imageUrl: v.image_url_snapshot,
            available,
            availabilityTier: tierForQty(available),
          };
        }),
    };
  });

// ---------- CREATE BOOKING ----------
export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string(),
        sessionToken: z.string().min(16),
        idempotencyKey: z.string().min(16),
        bookingToken: z.string().min(16),
        items: z
          .array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(20) }))
          .min(1)
          .max(20),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: event } = await supabaseAdmin
      .from("events")
      .select("id, status")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!event) return { ok: false as const, error: "event_not_found" };
    if (event.status !== "active") return { ok: false as const, error: "event_not_active" };

    const sessionHash = await sha256Hex(data.sessionToken);
    const { data: session } = await supabaseAdmin
      .from("customer_sessions")
      .select("id, expires_at, event_id")
      .eq("anonymous_token_hash", sessionHash)
      .maybeSingle();
    if (!session || session.event_id !== event.id) return { ok: false as const, error: "session_invalid" };
    if (new Date(session.expires_at) < new Date()) return { ok: false as const, error: "session_expired" };

    const bookingTokenHash = await sha256Hex(data.bookingToken);

    const { data: result, error } = await supabaseAdmin.rpc("create_local_booking", {
      _event_id: event.id,
      _customer_session_id: session.id,
      _idempotency_key: data.idempotencyKey,
      _items: data.items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })),
      _token_hash: bookingTokenHash,
    });

    if (error) {
      // Idempotency race — return existing
      if (error.message?.includes("bookings_event_id_idempotency_key_key")) {
        const { data: existing } = await supabaseAdmin
          .from("bookings")
          .select("token_hash")
          .eq("event_id", event.id)
          .eq("idempotency_key", data.idempotencyKey)
          .maybeSingle();
        // We don't know the raw token here — client will fall back to lastBooking storage.
        if (existing) return { ok: false as const, error: "duplicate_idempotency" };
      }
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const, bookingToken: data.bookingToken, bookingId: (result as any)?.booking_id };
  });

// ---------- GET BOOKING ----------
export const getBookingByToken = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ token: z.string().min(16) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Best-effort auto-expire before read.
    await supabaseAdmin.rpc("expire_stale_bookings");
    const hash = await sha256Hex(data.token);
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, event_id, booking_number, queue_number, status, subtotal_snapshot, total_snapshot, currency, reserved_at, expires_at, called_at, arrived_at, completed_at, cancelled_at, booking_items(*), events(name, slug, venue_name, venue_address)",
      )
      .eq("token_hash", hash)
      .maybeSingle();
    if (!booking) return null;

    // Queue snapshot: count ahead
    const { data: ticket } = await supabaseAdmin
      .from("queue_tickets")
      .select("sequence_number, status")
      .eq("booking_id", booking.id)
      .maybeSingle();

    let ahead = 0;
    let nowServing: string | null = null;
    if (ticket) {
      const { count } = await supabaseAdmin
        .from("queue_tickets")
        .select("id", { count: "exact", head: true })
        .eq("event_id", booking.event_id)
        .in("status", ["waiting", "called"])
        .lt("sequence_number", ticket.sequence_number);
      ahead = count ?? 0;

      const { data: serving } = await supabaseAdmin
        .from("queue_tickets")
        .select("queue_number")
        .eq("event_id", booking.event_id)
        .in("status", ["called", "serving"])
        .order("sequence_number")
        .limit(1)
        .maybeSingle();
      nowServing = serving?.queue_number ?? null;
    }

    return { booking, ahead, nowServing };
  });

// ---------- QUEUE SNAPSHOT ----------
export const getQueueSnapshot = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ eventId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: serving } = await supabaseAdmin
      .from("queue_tickets")
      .select("queue_number, status, sequence_number")
      .eq("event_id", data.eventId)
      .in("status", ["called", "serving"])
      .order("sequence_number")
      .limit(1)
      .maybeSingle();
    const { count: waiting } = await supabaseAdmin
      .from("queue_tickets")
      .select("id", { count: "exact", head: true })
      .eq("event_id", data.eventId)
      .eq("status", "waiting");
    return { nowServing: serving?.queue_number ?? null, waiting: waiting ?? 0 };
  });