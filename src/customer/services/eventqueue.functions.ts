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

/** Stock badges for Gudang Erspo: sold out at 0, low stock under 10. */
function tierForQty(q: number): "available" | "low" | "almost" | "sold_out" {
  if (q <= 0) return "sold_out";
  if (q < 10) return "low";
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

const ACCESS_CODE_TTL_MS = 5 * 60_000;

/** Deactivate codes past valid_until so the same plaintext can be issued again. */
async function expireStaleAccessCodes(eventId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();
  await supabaseAdmin
    .from("event_access_codes")
    .update({ active: false, disabled_at: now })
    .eq("event_id", eventId)
    .eq("active", true)
    .not("valid_until", "is", null)
    .lt("valid_until", now);
}

/** Temporary helper until admin can mint codes — creates one active code and returns plaintext. */
export const issueDemoAccessCode = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: event } = await supabaseAdmin
      .from("events")
      .select("id, status")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!event || event.status !== "active") return { ok: false as const, error: "event_not_active" };

    await expireStaleAccessCodes(event.id);

    const validUntil = new Date(Date.now() + ACCESS_CODE_TTL_MS).toISOString();
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
    let code = "";
    for (let attempt = 0; attempt < 12; attempt++) {
      code = Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
      const codeHash = await sha256Hex(code);
      // After expiry sweep, only still-active codes block reuse of the same hash.
      const { data: existing } = await supabaseAdmin
        .from("event_access_codes")
        .select("id")
        .eq("event_id", event.id)
        .eq("code_hash", codeHash)
        .eq("active", true)
        .is("disabled_at", null)
        .maybeSingle();
      if (existing) continue;

      const { error } = await supabaseAdmin.from("event_access_codes").insert({
        event_id: event.id,
        code_hash: codeHash,
        active: true,
        valid_from: new Date().toISOString(),
        valid_until: validUntil,
      });
      if (error) return { ok: false as const, error: "create_failed" };
      return { ok: true as const, code, expiresAt: validUntil };
    }
    return { ok: false as const, error: "create_failed" };
  });

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

    await expireStaleAccessCodes(event.id);

    const codeHash = await sha256Hex(data.code);
    const { data: match } = await supabaseAdmin
      .from("event_access_codes")
      .select("id, valid_until")
      .eq("event_id", event.id)
      .eq("active", true)
      .eq("code_hash", codeHash)
      .is("disabled_at", null)
      .maybeSingle();

    const expired =
      !!match?.valid_until && new Date(match.valid_until).getTime() < Date.now();

    if (!match || expired) {
      if (match && expired) {
        await supabaseAdmin
          .from("event_access_codes")
          .update({ active: false, disabled_at: new Date().toISOString() })
          .eq("id", match.id);
      }
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
      access_code_id: match.id,
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
function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

export const saveCustomerInfo = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        sessionToken: z.string().min(16),
        customerName: z.string().trim().max(80).optional(),
        phone: z.string().trim().min(8).max(30),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone = normalizePhone(data.phone);
    if (!/^08\d{9,11}$/.test(phone)) return { ok: false as const, error: "invalid_phone" };
    const hash = await sha256Hex(data.sessionToken);
    const { error } = await supabaseAdmin
      .from("customer_sessions")
      .update({ customer_name: data.customerName || null, phone })
      .eq("anonymous_token_hash", hash);
    if (error) return { ok: false as const, error: "session_error" };
    return { ok: true as const, phone };
  });

/** Resume browsing with phone after this device already unlocked via access code. */
export const resumeWithPhone = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1),
        phone: z.string().trim().min(8).max(30),
        sessionSeed: z.string().min(16),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone = normalizePhone(data.phone);
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) return { ok: false as const, error: "invalid_phone" };

    const { data: event } = await supabaseAdmin
      .from("events")
      .select("id,status")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!event || event.status !== "active") return { ok: false as const, error: "event_not_active" };

    // Must have previously verified an access code and saved this phone on a session.
    const { data: prior } = await supabaseAdmin
      .from("customer_sessions")
      .select("id, access_code_id, phone")
      .eq("event_id", event.id)
      .not("access_code_id", "is", null)
      .not("phone", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    const match = (prior ?? []).find((row) => {
      const rowDigits = (row.phone ?? "").replace(/\D/g, "");
      return rowDigits.length >= 8 && (rowDigits === digits || rowDigits.endsWith(digits) || digits.endsWith(rowDigits));
    });
    if (!match) return { ok: false as const, error: "phone_not_found" };

    const rawToken = await sha256Hex(data.sessionSeed + ":phone:" + Date.now() + ":" + Math.random());
    const tokenHash = await sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + 8 * 60 * 60_000).toISOString();

    const { error: insertErr } = await supabaseAdmin.from("customer_sessions").insert({
      event_id: event.id,
      anonymous_token_hash: tokenHash,
      access_code_id: match.access_code_id,
      phone,
      verified_at: new Date().toISOString(),
      expires_at: expiresAt,
    });
    if (insertErr) return { ok: false as const, error: "session_error" };

    return { ok: true as const, sessionToken: rawToken, expiresAt, phone };
  });

const plugoSyncAt = new Map<string, number>();

async function maybeSyncPlugoCatalog(
  event: { id: string; plugo_location_id?: string | null },
  force = false,
) {
  const mode = (process.env.PLUGO_INTEGRATION_MODE || process.env.PLUGO_MODE || "").trim();
  if (mode !== "live") return;
  const last = plugoSyncAt.get(event.id) ?? 0;
  if (!force && Date.now() - last < 60_000) return;
  plugoSyncAt.set(event.id, Date.now());
  try {
    const { syncEventCatalogFromPlugo } = await import("@/integrations/plugo/sync.server");
    const result = await syncEventCatalogFromPlugo(event.id, event.plugo_location_id);
    console.info(
      `[Plugo] synced ${result.inStockCount}/${result.productCount} in-stock @ ${result.locationName} (${result.locationId})`,
    );
  } catch (err) {
    plugoSyncAt.delete(event.id);
    throw err;
  }
}

// ---------- LIST PRODUCTS ----------
export const listEventProducts = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: event } = await supabaseAdmin
      .from("events")
      .select("id, safety_stock_quantity, plugo_location_id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!event) return [];

    try {
      // Non-blocking: serve DB catalog immediately; refresh Plugo in background.
      void maybeSyncPlugoCatalog(event).catch((err) => console.error("[Plugo] catalog sync failed", err));
    } catch (err) {
      console.error("[Plugo] catalog sync failed", err);
    }

    const { data: products } = await supabaseAdmin
      .from("event_products")
      .select(
        "id, plugo_product_id, display_name, description, image_url, event_note, featured, display_order, event_product_variants(id, plugo_variation_id, display_name, price_snapshot, image_url_snapshot, enabled)",
      )
      .eq("event_id", event.id)
      .eq("enabled", true)
      .order("display_order");

    const locationId =
      event.plugo_location_id ||
      process.env.PLUGO_LOCATION_ID ||
      "6603";

    const { data: inv } = await supabaseAdmin
      .from("inventory_snapshots")
      .select("plugo_variation_id, quantity, plugo_location_id")
      .eq("event_id", event.id)
      .eq("plugo_location_id", locationId);
    const invMap = new Map((inv ?? []).map((r) => [r.plugo_variation_id, r.quantity]));

    // Active reservations
    const { data: resv } = await supabaseAdmin
      .from("stock_reservations")
      .select("plugo_variation_id, quantity")
      .eq("event_id", event.id)
      .eq("status", "active");
    const resvMap = new Map<string, number>();
    for (const r of resv ?? []) resvMap.set(r.plugo_variation_id, (resvMap.get(r.plugo_variation_id) ?? 0) + r.quantity);

    // Display availability from Gudang Erspo stock only (no safety buffer on badges).
    const { getPlugoProductExtras } = await import("@/integrations/plugo/sync.server");

    return (products ?? [])
      .map((p: any) => {
        const variants = p.event_product_variants ?? [];
        const enabledVariants = variants.filter((v: any) => v.enabled);
        const availableVariants = enabledVariants.filter((v: any) => {
          const q = (invMap.get(v.plugo_variation_id) ?? 0) - (resvMap.get(v.plugo_variation_id) ?? 0);
          return q > 0;
        });
        const totalAvailable = enabledVariants.reduce((s: number, v: any) => {
          const q = (invMap.get(v.plugo_variation_id) ?? 0) - (resvMap.get(v.plugo_variation_id) ?? 0);
          return s + Math.max(0, q);
        }, 0);
        const startingPrice = Math.min(...enabledVariants.map((v: any) => Number(v.price_snapshot)));
        const extras = getPlugoProductExtras(event.id, p.plugo_product_id, p.event_note);
        const imageUrls =
          extras.imageUrls.length > 0
            ? extras.imageUrls
            : p.image_url
              ? [p.image_url]
              : [];
        return {
          id: p.id,
          plugoProductId: p.plugo_product_id,
          name: p.display_name,
          description: p.description,
          imageUrl: imageUrls[0] ?? p.image_url,
          imageUrls,
          featured: p.featured,
          startingPrice: Number.isFinite(startingPrice) ? startingPrice : 0,
          compareAtPrice: extras.compareAtPrice,
          variantCount: enabledVariants.length,
          availableVariantCount: availableVariants.length,
          availableQty: totalAvailable,
          availabilityTier: tierForQty(totalAvailable),
          discountPercent: extras.discountPercent,
          soldCount: extras.soldCount,
          productLabel: extras.productLabel,
        };
      })
      .filter((p) => p.availabilityTier !== "sold_out" && p.availableQty > 0);
  });

// ---------- GET PRODUCT DETAILS ----------
export const getEventProduct = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string(), productId: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: event } = await supabaseAdmin
      .from("events")
      .select("id, safety_stock_quantity, maximum_items_per_customer, plugo_location_id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!event) return null;

    // Intentionally skip Plugo catalog sync here — list page already syncs.
    // Syncing on every detail open made navigation feel slow (orders + inventory).

    const { data: product } = await supabaseAdmin
      .from("event_products")
      .select("*, event_product_variants(*)")
      .eq("event_id", event.id)
      .eq("id", data.productId)
      .eq("enabled", true)
      .maybeSingle();
    if (!product) return null;

    const varIds = product.event_product_variants.map((v: any) => v.plugo_variation_id);
    const locationId = event.plugo_location_id || process.env.PLUGO_LOCATION_ID || "6603";
    const { data: inv } = await supabaseAdmin
      .from("inventory_snapshots")
      .select("plugo_variation_id, quantity")
      .eq("event_id", event.id)
      .eq("plugo_location_id", locationId)
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
    const { getPlugoProductExtras } = await import("@/integrations/plugo/sync.server");
    const extras = getPlugoProductExtras(event.id, product.plugo_product_id, product.event_note);
    const imageUrls =
      extras.imageUrls.length > 0
        ? extras.imageUrls
        : product.image_url
          ? [product.image_url]
          : [];

    return {
      id: product.id,
      name: product.display_name,
      description: product.description,
      imageUrl: imageUrls[0] ?? product.image_url,
      imageUrls,
      maxPerCustomer: product.maximum_quantity_per_customer ?? event.maximum_items_per_customer,
      discountPercent: extras.discountPercent,
      compareAtPrice: extras.compareAtPrice,
      soldCount: extras.soldCount,
      productLabel: extras.productLabel,
      showVariantPicker: extras.labeledVariationIds.length > 1,
      variants: product.event_product_variants
        .filter((v: any) => v.enabled)
        .map((v: any) => {
          const q = (invMap.get(v.plugo_variation_id) ?? 0) - (resvMap.get(v.plugo_variation_id) ?? 0);
          const available = Math.max(0, q);
          const hasOptionLabel = extras.labeledVariationIds.includes(v.plugo_variation_id);
          return {
            id: v.id,
            plugoVariationId: v.plugo_variation_id,
            name: hasOptionLabel ? v.display_name : product.display_name,
            hasOptionLabel,
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
      .select("id, expires_at, event_id, access_code_id")
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

    // One-time access: consume the code that unlocked this session.
    if (session.access_code_id) {
      await supabaseAdmin
        .from("event_access_codes")
        .update({ active: false, disabled_at: new Date().toISOString() })
        .eq("id", session.access_code_id)
        .eq("active", true);
    }

    // Keep browsing session alive so cancel → browse again doesn't re-ask code/phone.
    return { ok: true as const, bookingToken: data.bookingToken, bookingId: (result as any)?.booking_id };
  });

// ---------- CANCEL BOOKING ----------
export const cancelBooking = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1),
        bookingToken: z.string().min(16),
        code: z.string().transform((s) => s.toUpperCase()),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (!CODE_RE.test(data.code)) return { ok: false as const, error: "invalid_format" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: event } = await supabaseAdmin
      .from("events")
      .select("id, status")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!event) return { ok: false as const, error: "event_not_found" };

    const codeHash = await sha256Hex(data.code);
    const { data: match } = await supabaseAdmin
      .from("event_access_codes")
      .select("id")
      .eq("event_id", event.id)
      .eq("code_hash", codeHash)
      .maybeSingle();
    // Accept active OR previously used codes for this event (customer confirms with venue code).
    if (!match) return { ok: false as const, error: "invalid_code" };

    const tokenHash = await sha256Hex(data.bookingToken);
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("id, event_id, status")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (!booking || booking.event_id !== event.id) return { ok: false as const, error: "booking_not_found" };
    if (!["reserved", "queued", "called"].includes(booking.status)) {
      return { ok: false as const, error: "not_cancellable" };
    }

    const now = new Date().toISOString();
    const { error: bookingError } = await supabaseAdmin
      .from("bookings")
      .update({
        status: "cancelled",
        cancelled_at: now,
        cancellation_reason: "customer_cancelled",
        updated_at: now,
      })
      .eq("id", booking.id);
    if (bookingError) return { ok: false as const, error: "cancel_failed" };

    await supabaseAdmin
      .from("stock_reservations")
      .update({
        status: "released",
        released_at: now,
        release_reason: "customer_cancelled",
        updated_at: now,
      })
      .eq("booking_id", booking.id)
      .eq("status", "active");

    await supabaseAdmin
      .from("queue_tickets")
      .update({ status: "skipped", updated_at: now })
      .eq("booking_id", booking.id)
      .in("status", ["waiting", "called"]);

    return { ok: true as const };
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

// ---------- ADMIN: LIST BOOKINGS ----------
const ADMIN_BOOKINGS_PAGE_SIZE = 20;

export const listAdminBookings = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z
      .object({
        slug: z.string().min(1).optional(),
        search: z.string().trim().max(80).optional(),
        offset: z.number().int().min(0).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      })
      .parse(d || {}),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("expire_stale_bookings");

    const slug = data.slug || "summer-market-2026";
    const offset = data.offset ?? 0;
    const limit = data.limit ?? ADMIN_BOOKINGS_PAGE_SIZE;
    const search = (data.search ?? "").trim();

    const { data: event } = await supabaseAdmin.from("events").select("id, name, slug").eq("slug", slug).maybeSingle();
    if (!event) return { event: null, bookings: [] as const, hasMore: false, nextOffset: 0 };

    let sessionIds: string[] = [];
    if (search) {
      const digits = search.replace(/\D/g, "");
      const phoneTerm = digits.length >= 3 ? digits : search;
      const { data: sessions } = await supabaseAdmin
        .from("customer_sessions")
        .select("id")
        .eq("event_id", event.id)
        .ilike("phone", `%${phoneTerm}%`)
        .limit(100);
      sessionIds = (sessions ?? []).map((s) => s.id);
    }

    let query = supabaseAdmin
      .from("bookings")
      .select(
        "id, booking_number, queue_number, status, total_snapshot, currency, reserved_at, expires_at, customer_session_id, customer_sessions(phone, customer_name)",
        { count: "exact" },
      )
      .eq("event_id", event.id)
      .order("reserved_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      const safe = search.replace(/[%_,.()]/g, " ").trim();
      const parts: string[] = [];
      if (safe) {
        parts.push(`booking_number.ilike.%${safe}%`);
        parts.push(`queue_number.ilike.%${safe}%`);
      }
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search)) {
        parts.push(`id.eq.${search}`);
      }
      if (sessionIds.length) {
        parts.push(`customer_session_id.in.(${sessionIds.join(",")})`);
      }
      if (parts.length) query = query.or(parts.join(","));
    }

    const { data: bookings, count } = await query;
    const mapped = (bookings ?? []).map((b: any) => ({
      id: b.id,
      bookingNumber: b.booking_number,
      queueNumber: b.queue_number,
      status: b.status,
      total: Number(b.total_snapshot),
      currency: b.currency,
      reservedAt: b.reserved_at,
      expiresAt: b.expires_at,
      phone: b.customer_sessions?.phone ?? null,
      customerName: b.customer_sessions?.customer_name ?? null,
    }));

    const nextOffset = offset + mapped.length;
    const hasMore = typeof count === "number" ? nextOffset < count : mapped.length === limit;

    return {
      event: { id: event.id, name: event.name, slug: event.slug },
      bookings: mapped,
      hasMore,
      nextOffset,
      total: count ?? mapped.length,
    };
  });

/** Admin detail: same payload as customer getBookingByToken, keyed by booking id. */
export const getAdminBookingById = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ bookingId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("expire_stale_bookings");
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, event_id, booking_number, queue_number, status, subtotal_snapshot, total_snapshot, currency, reserved_at, expires_at, called_at, arrived_at, completed_at, cancelled_at, token_hash, booking_items(*), events(name, slug, venue_name, venue_address), customer_sessions(phone, customer_name)",
      )
      .eq("id", data.bookingId)
      .maybeSingle();
    if (!booking) return null;

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

    return {
      booking,
      ahead,
      nowServing,
      phone: (booking as any).customer_sessions?.phone ?? null,
    };
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
// ---------- ADMIN: EVENT SETUP ----------
const DEMO_EVENT_SLUG = "summer-market-2026";

export const getAdminEvent = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().min(1).optional() }).parse(d || {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const slug = data.slug || DEMO_EVENT_SLUG;
    const { data: event } = await supabaseAdmin
      .from("events")
      .select(
        "id, name, slug, description, banner_url, venue_name, venue_address, event_start_at, event_end_at, reservation_open_at, reservation_close_at, status",
      )
      .eq("slug", slug)
      .maybeSingle();
    return event;
  });

export const updateAdminEvent = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(2).max(120),
        slug: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug"),
        description: z.string().trim().max(2000).optional().nullable(),
        bannerUrl: z.string().trim().url().optional().nullable().or(z.literal("")),
        eventStartAt: z.string().min(1),
        eventEndAt: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const start = new Date(data.eventStartAt);
    const end = new Date(data.eventEndAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return { ok: false as const, error: "invalid_dates" };
    }
    if (end.getTime() <= start.getTime()) {
      return { ok: false as const, error: "end_before_start" };
    }

    const { data: clash } = await supabaseAdmin
      .from("events")
      .select("id")
      .eq("slug", data.slug)
      .neq("id", data.id)
      .maybeSingle();
    if (clash) return { ok: false as const, error: "slug_taken" };

    const banner = data.bannerUrl?.trim() || null;
    const { data: updated, error } = await supabaseAdmin
      .from("events")
      .update({
        name: data.name,
        slug: data.slug,
        description: data.description?.trim() || null,
        banner_url: banner,
        event_start_at: start.toISOString(),
        event_end_at: end.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select(
        "id, name, slug, description, banner_url, venue_name, venue_address, event_start_at, event_end_at, reservation_open_at, reservation_close_at, status",
      )
      .maybeSingle();

    if (error || !updated) return { ok: false as const, error: "update_failed" };
    return { ok: true as const, event: updated };
  });
