# Pricing Architecture — Discounts, Coupons, Tax (Phase 17)

Status: design, written before implementation, per explicit instruction ("Сначала
создай PRICING_ARCHITECTURE.md... После этого проверь архитектуру на edge cases.
И только потом начинай реализацию"). This document is reviewed against edge cases
in §7 before any code is written.

## 0. Relationship to the original spec

The user's spec ("Pricing, Discounts & Taxes System", 69 sections) asks for a
general-purpose commerce pricing engine: per-product/category/collection discounts,
customer-segment discounts, multi-region tax with multiple rates, shipping cost
calculation, discount stacking with priority rules. Building all of that here would
mean inventing entities and UI this app has no consumer for yet — `Category` doesn't
exist on `Product`, there is no `Customer` account (checkout is anonymous by design,
see `Order`'s own doc comment), and checkout collects no address at all (no shipping
method, no region). That is the same trap already avoided everywhere else in this
project (`ROADMAP.md` — `ProductVariant`, `Category`, `Review` all deliberately never
built because nothing uses them) — building a multi-region tax engine with no address
field to feed it isn't an MVP, it's dead code with a UI-shaped hole next to it.

This document scopes an MVP that is honest about what this app can actually support
today, while keeping the door open for the deferred pieces (see §8) without a schema
rewrite when they eventually get a real UI to attach to.

**Built in this phase:** a single unified Pricing Engine; order-level discounts
(percentage/fixed), each either automatic or gated behind a code (collapsing the
spec's Discount/Coupon split into one table, see §2); usage limits and expiry per
discount; a single flat tax rate per business (inclusive/exclusive/none); a full
Order pricing breakdown snapshot (subtotal/discount/tax/total).

**Explicitly deferred, not silently dropped** (see §8 for the reasoning per item):
product/category/collection-specific discounts, customer-segment discounts, discount
stacking (more than one discount per order), multi-region/multi-rate tax, shipping
cost calculation.

## 1. Money recap (already built, Phase 16)

`Business.currency` is the single source of truth; `Money` is `{amountMinor: number,
currency: string}` conceptually, represented in the DB as a plain `Int` column named
`*Cents` (kept from before Phase 16, not renamed — see `ROADMAP.md` §8) that actually
holds minor units of `currency`, not literal cents. `formatMoney`/`toMinorUnits`/
`fromMinorUnits` (`frontend/src/shared/lib/format-money.ts`) are the only place money
is formatted or parsed. This document reuses that foundation for every new amount
(`discountCents`, `taxCents`, `subtotalCents`) — no new money representation is
introduced.

## 2. Discount (one entity, not two)

The spec asks for two entities — "Discount — правило, Coupon — способ активировать
правило через код" — reasoning that a discount could exist as a rule with zero or
multiple activation codes. In this MVP, the only discount *scope* being built is
"the whole order" (§8 explains why per-product/category discounts are deferred), so
a rule and its (at most one) code collapse cleanly into one row: `code: null` means
"automatic, applied to every qualifying order", `code: "SAVE20"` means "requires this
code at checkout". This is a deliberate simplification of the spec's suggested split,
not a misunderstanding of it — a genuine 1:many Discount→Coupon relationship only
earns its complexity once something needs multiple codes for one rule (e.g. per-
influencer tracking codes), which nothing in this app does today. The FK shape below
extends to a real `Coupon` table later without migrating existing data: today's
`code` column would just move to a new table with a `discountId` FK.

```prisma
enum DiscountType {
  percentage
  fixed
}

model Discount {
  id                  String       @id @default(uuid())
  businessId          String
  business            Business     @relation(fields: [businessId], references: [id], onDelete: Cascade)
  name                String
  /// null = automatic, applied to every order that meets minOrderAmountCents/
  /// dates without the customer entering anything. Non-null = requires this
  /// exact code at checkout. Normalized upper-case (see DiscountsService).
  code                String?
  type                DiscountType
  /// percentage: 1-100. fixed: minor units of Business.currency.
  value                Int
  /// Order must reach this subtotal (before discount) to qualify. null = no minimum.
  minOrderAmountCents Int?
  startsAt            DateTime?
  endsAt              DateTime?
  /// null = unlimited. Enforced with the same atomic updateMany-guard pattern
  /// already used for Product.stock (see PricingService/OrdersService).
  usageLimit          Int?
  usageCount          Int          @default(0)
  isActive            Boolean      @default(true)
  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt

  @@unique([businessId, code])
  @@index([businessId])
  @@map("discounts")
}
```

`@@unique([businessId, code])` only meaningfully constrains non-null codes —
Postgres treats each `NULL` as distinct, so multiple automatic (`code: null`)
discounts can coexist for one business; two discounts with the same real code
cannot, which is exactly the intended constraint.

**No separate `Coupon` table, no `CouponUsage` table.** Usage tracking is a single
counter on `Discount` (`usageCount`), not a per-redemption log — nothing in this
app's Dashboard needs "which orders used this code", only "is this code still
usable" and "how many times has it fired" (both shown on the Discounts list). If a
future increment needs per-redemption history, that's an additive `DiscountRedemption`
table, not a change to this shape.

## 3. Tax (one flat rate per business, not a multi-region engine)

```prisma
enum TaxMode {
  none
  inclusive
  exclusive
}

// on Business:
taxRateBps Int     @default(0)     // basis points: 2000 = 20.00%, 825 = 8.25%
taxMode    TaxMode @default(none)
```

Stored as basis points (integer), not a `Float` percentage — the same reasoning as
money: `8.25%` as `0.0825` risks float drift across repeated multiplication; `825`
as an integer does not. `taxMode: 'none'` (the default) means tax is off entirely —
existing businesses get exactly today's behavior (no tax line) after migration.

Only one rate, one mode, per business — no per-product tax class, no per-region
rate table. This app has no address capture anywhere in checkout (`CreateOrderDto`
has no address field, see `backend/src/modules/orders/dto/create-order.dto.ts`), so
a "multi-region tax table" would have nothing to key off of. A business owner who
needs region-specific tax already has a documented workaround: `taxMode: 'none'`
and handle it outside the platform, same as they would for shipping today.

## 4. The Pricing Engine — one function, both callers

```
backend/src/modules/pricing/pricing.ts   // pure, no DB, no NestJS DI needed
```

```ts
export interface PricingLineItem {
  priceCents: number;
  quantity: number;
}

export interface PricingDiscount {
  type: 'percentage' | 'fixed';
  value: number;
}

export interface PricingInput {
  items: PricingLineItem[];
  taxRateBps: number;
  taxMode: 'none' | 'inclusive' | 'exclusive';
  discount?: PricingDiscount;
}

export interface PricingResult {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
}

export function calculateOrderPricing(input: PricingInput): PricingResult;
```

Order of operations — discount applied to subtotal, tax applied to the
post-discount amount — is the standard convention used by Shopify, Stripe Tax, and
essentially every real storefront, and is what a reasonable customer expects ("20%
off" should reduce the taxable amount, not just show a smaller total after tax was
already computed on the full price):

1. `subtotalCents = sum(item.priceCents * item.quantity)`
2. `discountCents`:
   - `percentage`: `round(subtotalCents * value / 100)`
   - `fixed`: `value`
   - clamped to `min(discountCents, subtotalCents)` — a discount can never make the
     order negative, regardless of a fixed discount larger than the cart.
3. `taxableCents = subtotalCents - discountCents`
4. `taxCents` by `taxMode`:
   - `none`: `0`
   - `exclusive`: `round(taxableCents * taxRateBps / 10000)`, added on top
   - `inclusive`: tax is already inside `taxableCents`; computed only for display —
     `taxableCents - round(taxableCents * 10000 / (10000 + taxRateBps))` — the total
     does not change
5. `totalCents = taxableCents + (taxMode === 'exclusive' ? taxCents : 0)`

This is the **only** place this arithmetic exists. `OrdersService.createFromCart`
(the sole order-creation path — anonymous checkout has no other entry point) calls
it once, server-side, with the discount resolved from a validated coupon/automatic
match; the result is what gets sent to Stripe and stored on `Order`. There is no
separate "cart preview" calculation living elsewhere — the coupon-preview endpoint
in §5 calls the exact same function, not a parallel implementation, so a discount
shown in the cart and the discount actually charged can never diverge.

## 5. Coupon application flow

Checkout is a single form today (name/email/phone/note + cart items, no separate
"apply coupon" step in the persisted order). To give the "Invalid code" /
"Applied ✓" feedback the spec expects without waiting for full order submission,
one small preview endpoint is added:

```
POST /sites/:businessId/coupons/preview
  body: { code: string, subtotalCents: number }   // subtotalCents: client's own running total, preview only
  → 200 { valid: true, name, type, value, discountCents }
  → 400 { valid: false, reason: 'not_found' | 'inactive' | 'expired' | 'not_started'
                              | 'usage_limit_reached' | 'min_order_not_met' }
```

This is a **preview only** — it does not reserve usage, does not touch
`usageCount`, and its `subtotalCents` input is never trusted for the real charge.
`CreateOrderDto` gains an optional `couponCode?: string`; at actual order creation,
`OrdersService.createFromCart` independently re-resolves the code against the
*server-computed* subtotal (from real `Product` rows, exactly as today) and
re-validates every condition from scratch — a client that skipped the preview call
entirely, or one that raced a coupon's expiry/usage-limit between preview and
submit, gets the same validation at the point that actually matters. An invalid or
expired `couponCode` at submission time is a 400 for the whole order (matching the
existing "invalid item ⇒ reject the whole order, don't silently drop it" policy for
cart items), not a silent no-discount fallback — a customer who typed a code
expects to know if it didn't apply.

`usageCount` is incremented inside the same Prisma transaction that creates the
order and decrements stock, using the identical atomic-guard pattern already used
for `Product.stock`:

```ts
const { count } = await tx.discount.updateMany({
  where: { id: discount.id, OR: [{ usageLimit: null }, { usageCount: { lt: discount.usageLimit } }] },
  data: { usageCount: { increment: 1 } },
});
if (count === 0) throw new BadRequestException('Промокод больше недоступен');
```

## 6. Order snapshot

`Order` gains the breakdown, all filled once at creation and never recomputed:

```prisma
subtotalCents  Int              // sum of line items before discount/tax
discountCents  Int      @default(0)
discountName   String?          // snapshot of Discount.name, survives the Discount being edited/deleted later
couponCode     String?          // snapshot of the code the customer entered, if any
taxCents       Int      @default(0)
totalCents     Int              // already exists — becomes subtotal - discount + (exclusive tax)
```

Same historical-snapshot principle already established for `OrderItem.name`/
`priceCents` and `Order.currency` (Phase 16): if the business edits or deletes the
`Discount` after the order, or changes `taxRateBps` next month, this order's
receipt must keep showing what the customer actually paid.

## 7. Edge cases (reviewed before implementation)

- **Discount larger than subtotal** (fixed discount, small cart): clamped to
  `subtotalCents`, `totalCents` floors at `0` (plus tax, if `exclusive` — see next
  point), never negative.
- **Tax on a fully-discounted order**: taxable amount is `0`, so `taxCents` is `0`
  regardless of `taxMode` — no tax charged on an order with nothing left to tax.
- **Two automatic discounts both qualify simultaneously**: at most one discount
  applies per order in this MVP (no stacking, §8). Deterministic tie-break: the
  automatic discount yielding the larger `discountCents` wins — cheapest for the
  customer to reason about, and stable given the same cart.
- **Explicit coupon code + an automatic discount both qualify**: the entered code
  wins outright, the automatic discount is not layered on top — a customer who
  typed a code expects that specific offer, not a surprise combination.
- **Coupon valid at preview, invalid by submit** (usage limit hit by another
  customer in between, or `endsAt` passed): re-validated server-side at order
  creation regardless of what the preview said (§5) — rejected with a clear 400,
  not silently charged without the discount.
- **Race on the last remaining use of a limited coupon**: same atomic
  `updateMany`-with-guard pattern as `Product.stock`, inside the same transaction —
  two simultaneous "last use" attempts, only one `count` comes back `1`.
- **Business changes `taxRateBps`/`taxMode` after past orders exist**: past orders
  keep their stored `taxCents`/`totalCents` (§6) — never recomputed against the new
  rate, exactly like a later currency change never rewrites past `Order.currency`
  (Phase 16 §8's own precedent).
- **Currency change after a `fixed`-type discount was created in the old
  currency**: `Discount.value` for `type: 'fixed'` is minor units of
  `Business.currency` at the time it's *used*, not stored per-discount — this is a
  known, documented sharp edge (fixed discounts denominated in whatever the
  business's current currency is at redemption time), the same tradeoff already
  accepted for `Product.priceCents` in Phase 16 (no per-row currency, single
  source of truth on `Business`). A business that changes currency with active
  fixed-amount discounts should review them — same expectation already set for
  product prices (`BusinessCurrencySection`'s warning modal, Phase 16).
- **Zero-decimal currency (JPY) with a percentage discount**: `calculateOrderPricing`
  operates purely on minor-unit integers and never assumes 2 decimals — `round()`
  on an already-whole JPY amount is a no-op, no special case needed.
- **Code case sensitivity**: codes are normalized to upper-case on both write
  (`DiscountsService.create/update`) and read (coupon preview/order creation) — a
  customer typing `save20` matches a stored `SAVE20`.
- **Deleting a `Discount` that past orders reference**: no FK from `Order` to
  `Discount` (only the `discountName`/`couponCode` string snapshot, §6) — deletion
  is always safe, exactly mirroring `OrderItem.productId`'s `onDelete: SetNull`
  reasoning for `Product`.
- **`minOrderAmountCents` compared before or after an existing discount?**: before
  — it gates on the cart's own subtotal, not a hypothetical post-discount amount
  (there's only ever one discount per order in this MVP, so this can't compound).

## 8. Explicitly deferred (named, not dropped)

- **Product/category/collection-specific discounts.** Requires a `Category`
  entity that doesn't exist on `Product` today (`ROADMAP.md`'s own long-standing
  deferral) — building discount scoping for a dimension with zero real data would
  be unverifiable dead code.
- **Customer-segment / first-order discounts.** Checkout is anonymous by design
  (`Order`'s own doc comment — no `Customer` account); "has this customer ordered
  before" isn't a knowable fact in this architecture without inventing customer
  identity tracking that nothing else in the app needs yet.
- **Discount stacking / priority rules.** Moot while only one discount scope
  (whole order) and at most one discount per order exist — stacking rules solve a
  problem (which of several simultaneously-eligible discounts to combine) that
  doesn't arise yet. §7 already gives a deterministic single-discount tie-break.
- **Multi-region / multi-rate tax, tax-exempt products.** No address capture
  anywhere in checkout to key a region off of (§3) — would be a UI-less table.
- **Shipping cost calculation.** No shipping address field, no shipping method
  selection anywhere in the current checkout form — there is nothing for a
  "shipping cost" to attach to yet; `Order.shippingTotal` from the spec's own
  example schema is not added until a real address/method UI exists to produce it.

Each of these becomes additive when its prerequisite entity/UI is eventually built
(a `Category` on `Product`, a `Customer` account, an address field at checkout) —
none of them require reshaping what's built in this phase.
