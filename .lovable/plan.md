
# EventQueue — Phase 1 Build Plan

A mobile-first browser app for offline retail events. Customers scan a venue QR, enter a 4-char code, browse products, reserve variants, and get a queue number + booking QR before physically queuing. Phase 1 = customer experience only; Phase 2 (admin/cashier) is scaffolded but not built.

## Scope for this build (Phase 1)

Customer flow end-to-end:
1. Event landing (`/event/:slug`) with scheduled / active / paused / closed states
2. 4-char access code verification (`/event/:slug/access`) with rate limiting
3. Optional customer name (`/event/:slug/customer`)
4. Product catalog (`/event/:slug/products`) with search, sort, availability badges
5. Product details + variant selection with mobile bottom sheet
6. Persistent cart (`/event/:slug/cart`) surviving refresh
7. Atomic booking creation with idempotency key
8. Booking page (`/event/:slug/booking/:token`) — queue number, big QR, live status
9. Realtime queue updates via Supabase Realtime
10. Backend-driven reservation expiration
11. Weak-network / offline handling, session recovery

Explicitly deferred: admin UI, cashier scanner, reports, POS write integration.

## Architecture

- **Stack:** TanStack Start (React + TS + Vite), Tailwind v4, shadcn/ui, Supabase (DB + Realtime + Edge Functions), TanStack Query, Zod, `qrcode` lib.
- **Plugo integration:** Server-only adapter behind an interface, `mock` mode by default with realistic seeded data. `live` mode uses signed headers built server-side. Never called from browser.
- **Availability model:** `plugo_qty - active_local_bookings - safety_stock`. Local bookings never mutate Plugo.
- **Sessions:** Anonymous session token (random, hashed server-side), stored as httpOnly-ish token in localStorage + verified per request. Booking recovery token separate.
- **Idempotency:** Client generates UUID per booking attempt; server enforces uniqueness on `bookings.idempotency_key`.

## Folder layout

```text
src/
  routes/                     # TanStack Start file routes
    event.$slug.tsx           # landing
    event.$slug.access.tsx
    event.$slug.customer.tsx
    event.$slug.products.tsx
    event.$slug.products.$productId.tsx
    event.$slug.cart.tsx
    event.$slug.booking.$token.tsx
    event.$slug.closed.tsx
    api/                      # server routes (webhooks/public)
  customer/{components,hooks,services,schemas}
  admin/                      # placeholder
  cashier/                    # placeholder
  shared/{components,hooks,utilities,types}
  integrations/plugo/         # adapter + mock + live
  lib/
supabase/
  migrations/                 # schema + seed
  functions/                  # edge fns for booking + expiration
```

## Database (Supabase migrations)

All tables per spec: `sellers`, `events`, `event_access_codes`, `event_access_attempts`, `event_products`, `event_product_variants`, `inventory_snapshots`, `customer_sessions`, `bookings`, `booking_items`, `stock_reservations`, `queue_tickets`.

- RLS on everything; anon can only read public event/product/variant data for active events, and read own booking by token hash.
- Access codes stored hashed (bcrypt or sha256+salt).
- Booking tokens: random 32-byte, hashed for storage, raw only in URL.
- Grants for `anon` (public reads) and `authenticated` + `service_role` (Phase 2).
- Seed: 1 seller, 3 events (active/scheduled/closed), 12+ products with variants across availability states, sample queue tickets & bookings, Asia/Jakarta times, IDR prices.

## Edge Functions / Server Functions

Server functions (TanStack `createServerFn`) — same-origin, no CORS:

- `verifyAccessCode` — rate-limited, hashed compare, creates session
- `getEventBySlug` — public, safe columns
- `listEventProducts` — with computed availability tier
- `getEventProduct` — details + variants
- `createBooking` — atomic Postgres function (`rpc.create_booking`) with idempotency, availability recheck, reservation insert, queue ticket, booking number + queue number generation
- `getBookingByToken` — validated by hashed token
- `getQueueSnapshot`

Supabase Edge Function (scheduled, pg_cron):

- `expire_bookings` — releases `stock_reservations` for expired/no-show bookings

## Plugo adapter

```ts
interface PlugoCatalogAdapter {
  listLocations(): Promise<PlugoLocation[]>;
  listProducts(params?: ProductQueryParams): Promise<PlugoProduct[]>;
  getProduct(id: number): Promise<PlugoProduct>;
  getLocationInventory(locationId: number): Promise<PlugoInventoryItem[]>;
}
```

Two impls: `MockPlugoAdapter` (reads from seeded snapshots) and `LivePlugoAdapter` (signs `SHA256(timeStamp + vendorID + partnerPASS + plugoApiKey)`, UTC `YYYY-MM-DD HH:mm:ss`). Selected via `PLUGO_INTEGRATION_MODE`.

Env placeholders: `PLUGO_BASE_URL`, `PLUGO_PARTNER_ID`, `PLUGO_PARTNER_PASS`, `PLUGO_VENDOR_ID`, `PLUGO_API_KEY`, `PLUGO_INTEGRATION_MODE`.

## UX system

- Tailwind v4 tokens in `src/styles.css`: warm neutral background, single strong brand accent (not purple), high-contrast text.
- Type: `Instrument Serif` display + `Inter` body via `<link>` in `__root`.
- Component patterns: sticky bottom CTA bar, bottom-sheet variant picker, 4-box OTP-style code input, big QR card, skeleton loaders, offline banner.
- Min touch target 44px, works at 320px.
- Semantic HTML, focus rings, ARIA, reduced-motion respected. Availability communicated by label + color + icon.

## Security & resilience

- Zod validate all inputs client + server.
- Rate limit access-code attempts (5 / 10 min per session+IP hash).
- Idempotency-key uniqueness prevents double booking.
- Booking QR contains only opaque token URL.
- Cart in `localStorage`; booking recovery token in `localStorage`; nothing sensitive stored.
- `navigator.onLine` + query retry for offline detection; block booking submit while offline with clear message.

## Ordered execution

1. Enable Lovable Cloud.
2. Migrations + seed data (schema, RLS, grants, demo event).
3. Shared types + Zod schemas.
4. Plugo adapter (mock) + availability service.
5. Server functions for event/product/session/booking.
6. Design system tokens + shared UI primitives.
7. Landing + access + customer pages.
8. Catalog + product details with bottom sheet.
9. Cart (persistent) + booking creation with idempotency.
10. Booking page + QR + realtime queue subscription.
11. Expiration edge function + pg_cron.
12. Offline/recovery polish + cross-browser QA.

## Confirmations before I start

- **Cloud:** I'll enable Lovable Cloud (Supabase under the hood) — required for DB, Realtime, Edge Functions.
- **Plugo credentials:** No live keys yet → I'll build with `PLUGO_INTEGRATION_MODE=mock` and seed realistic catalog data. You can flip to `live` later after adding secrets.
- **Postman collection:** You mentioned uploading `Plugo Partner API.postman_collection.json` — I don't see it attached. I'll implement the signed-header pattern per your spec; when you upload the collection I'll align endpoint paths/response shapes in a follow-up.
- **Scope of this first turn's implementation:** Given the size, I'll ship Phase 1 across multiple turns. This first implementation turn will cover steps 1–6 (DB, adapter, server fns, design system, landing + access + customer pages). Catalog → booking → realtime lands in the next turn.

Approve and I'll start with enabling Cloud and shipping the migrations + landing flow.
