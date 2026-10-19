# RASSM

E-commerce website for **RASSM**, an Algerian streetwear brand. Tagline: **"Draw what you can't say."**
Oversized hoodies, sweatshirts and t-shirts with artistic sketch prints.

- Prices in Algerian Dinar, integers only, always displayed as `7 900 DA` (narrow no-break space for thousands, `DA` after the number, discounts as `−100 DA`) (use `formatPrice` from `@rassm/shared`, never format by hand).
- Cash on delivery only, to the **58 wilayas** of Algeria (home delivery or stop desk), shipped by our courier **Anderson** from Alger. Some wilayas have **no stop desk** (see Business rules).
- **Sales flow (Meta Ads):** visitors land on a product page from an ad and order that product directly with the form on the page. There is **no cart and no checkout page**: one order = one product (one color, one size, a quantity). After the order, the customer lands on `/merci` and the team calls them to confirm.
- Customer-facing language is **French** (see Language rule below).
- The design references are `design/Homepage.png`, `design/Collection.png` and `design/Contact.png`. Read the relevant one before any UI work.

## Language rule

- **All code is in English:** names, files, folders, comments, commit messages, schema fields, enum values.
- **Everything customers see is in French:** navigation, buttons, labels, forms, error messages, empty states, page titles, SEO metadata (`<title>`, description, Open Graph), product content. The `<html>` tag uses `lang="fr"`. The **admin dashboard is in French too**.
- **Exception:** brand slogans and artistic phrases stay in **English**: "Draw what you can't say.", "Wear your silence.", "Art lives in all of us.", "Real people. Bigger feelings.", and the handwritten quotes ("Some things live better in art.", "Different thoughts. Same human.", "Same people. Different stories."). Product names (e.g. "Signature Hoodie") are brand names and stay as they are.
- `design/Homepage.png` shows English UI text (nav, buttons, section labels). Translate it to French when building, e.g. Accueil, Collection, Lookbook, À propos, Contact, "Découvrir la collection", "Voir tout", "Produits phares". Keep the slogans in English. The same goes for the other designs; page titles that are slogans ("Let's talk.", "We're here for you.") stay in English with `lang="en"`.
- **Every Zod error message in `shared/` is French.** `shared/src/schemas/common.ts` also sets Zod's French locale (`z.config(z.locales.fr())`), so built-in messages are French too. Never add an English error message.

## Stack

- **Monorepo:** pnpm workspaces
  - `frontend/`: Next.js (App Router), TypeScript, Tailwind CSS v4, TanStack Form, TanStack Query
  - `backend/`: Express.js + TypeScript, MongoDB with Mongoose (not built yet)
  - `shared/`: Zod schemas, inferred types, constants, helpers, mock data
  - `config/eslint/`: shared ESLint flat config (`/base`, `/next`)
- **Validation:** Zod v4. **All schemas live in `shared/`** and are used by both the frontend forms and the backend. Never redefine a schema or type in an app; import it from `@rassm/shared`.
- Mock data comes from `@rassm/shared/mocks` and is parsed through the schemas at load time.
- TypeScript is pinned to `~6.0` because typescript-eslint does not support 7.x yet.
- Next.js is v16 (Turbopack, `next lint` removed, ESLint runs directly). Read `frontend/AGENTS.md` and the docs in `frontend/node_modules/next/dist/docs/` before using a Next API you are unsure about.
- `@rassm/shared` ships TS source with extensionless imports. It runs through Next (`transpilePackages`) or `tsx`, not plain `node`.

### Commands (run from the root)

| Command          | What it does                                            |
| ---------------- | ------------------------------------------------------- |
| `pnpm dev`       | Starts the web app on http://localhost:3000             |
| `pnpm build`     | Builds every workspace                                  |
| `pnpm typecheck` | Type-checks every workspace                             |
| `pnpm lint`      | Lints every workspace                                   |
| `pnpm test`      | Runs the unit tests (Vitest, `shared/` and `frontend/`) |
| `pnpm format`    | Formats everything with Prettier                        |

## Build order

1. **Frontend first**, using mock data from `@rassm/shared/mocks`.
2. **Backend:** Express API + MongoDB.
3. **Connect** the frontend to the API (TanStack Query), replacing mocks.
4. **Admin dashboard.**

Do only the step you are asked to do. Do not start a later step early.

## Business rules

### Exchange policy (content of the future "Échanges" page, `/echanges`)

- The exchange must be **requested on the day of delivery**.
- The product must be **unworn and in its original condition**.
- The **customer pays the delivery costs** of the exchange.
- If the product does not come back in the same condition, there is **no exchange**: the same product is sent back to the customer.
- Wherever the site mentions exchanges, say "Échange possible le jour de la livraison" and link to `/echanges` (`routes.exchanges`). Today: the product page reassurance line and the note under the order button.

### Contact

- WhatsApp and phone: **0780 29 49 10** (`https://wa.me/213780294910`, `tel:+213780294910`); Instagram **@rassm.wear**. These live in `frontend/src/content/contact.ts` (`CONTACT`): never hard-code the number or the links elsewhere. The footer, the contact page and `SOCIAL_LINKS` read it.
- No public e-mail address and no opening hours are shown.
- Contact form (`contactFormSchema` in `shared/src/schemas/forms.ts`): Prénom, Nom, Téléphone (required, Algerian format), E-mail (optional, empty = `undefined`), Sujet (`CONTACT_SUBJECTS`: Commande, Échange, Collaboration, Autre), Message (10 to 2 000 characters). Today `sendContactMessage` (`lib/data/contact.ts`) only validates and simulates the request; **in the backend step the API validates with the same schema and saves the message** (read in the admin dashboard).

### Delivery fees and stop desk

- `WILAYAS` holds the **58 official wilayas** (codes 01 to 58), the list Anderson uses. The wilayas created in 2025 (Aflou, Barika, Bou Saâda…) are deliberately not in the list.
- Each wilaya has a `homePrice`, a `stopDeskPrice` and `estimatedDays` (delivery time from Alger). `stopDeskPrice: null` means **no stop desk, home delivery only**. Today that applies to Tindouf (37), Bordj Badji Mokhtar (50), Béni Abbès (52) and In Guezzam (54).
- Use `getAvailableDeliveryTypes(fee)` to decide which delivery options to show. `getDeliveryPrice` and `getDeliveryFeeWithDiscount` throw `DeliveryTypeUnavailableError` (French message) for stop desk in those wilayas. The backend must turn it into a 400 error and never accept such an order.
- Mock fees (`shared/src/mocks/delivery-fees.ts`) are the real **Anderson rates, departure Alger**, e.g. Alger 400 home / 250 stop desk, 1 day. The highest home price is Djanet (1,800 DA), which is the limit for discount tier amounts.

### Quantity-based delivery discount tiers (per product)

- Each product has `deliveryDiscountTiers`: up to **5** tiers, empty by default (empty = no discount). Each tier has a `minQuantity` (integer, at least 1) and is either `{ type: "amount", amount }` (DA, integer, more than 0) or `{ type: "free" }` (free delivery).
- Validation (French errors): no two tiers with the same `minQuantity`, at most 5 tiers, **strictly increasing tiers** (sorted by `minQuantity`, each tier gives more than the previous one, and a `free` tier can only be the last), and every amount **lower than the highest home delivery price**. Validate with `createProductSchema(getMaxHomeDeliveryPrice(deliveryFees))`. The limit always comes from the fee data, **never hard-coded**.
- Discounts reduce the **delivery fee only, never the product price**. They apply to both home delivery and stop desk.
- **Calculation**, always with `getDeliveryFeeWithDiscount({ wilayaCode, deliveryType, items, products, deliveryFees })` from `@rassm/shared`. Never reimplement it.
  1. For each distinct product, add up its quantity across all sizes.
  2. Its applicable tier is the one with the highest `minQuantity` ≤ that quantity. No match = no discount from that product.
  3. If any product's applicable tier is `free`, the whole delivery is free.
  4. Otherwise the amounts of all products **add up**.
  5. The total is capped at the base fee: the final fee **never goes below 0 DA**.
- It returns `deliveryFeeBase`, `deliveryDiscount` (applied), `deliveryFee` (final), `freeDelivery`, `deliveryDiscountLines` (per product: product, quantity, tier, amount) and `nextDeliveryDiscountTiers` (per product: units missing to reach the next better tier, and that tier). The next tiers list is empty once delivery already costs 0.
- An order from the product page passes one line: `items: [{ productId, quantity }]`. The helper still accepts several lines (quantities of the same product add up).
- The **backend always recalculates** from the products loaded from the database and the fee table. It never trusts tiers, discounts or delivery amounts sent by the client. The order payload (`productOrderSchema`) carries no price or discount data.
- Orders (`orderSchema`) store one `item` (product id, name, slug, image, color, size, quantity, unit price) plus `deliveryFeeBase`, `deliveryDiscount`, `deliveryFee`, `freeDelivery` and `deliveryDiscountLines`. Order checks: `subtotal = unitPrice × quantity`, `deliveryFee = deliveryFeeBase − deliveryDiscount` (never negative), the discount matches the lines, `freeDelivery` is true exactly when a free tier applied, and `total = subtotal + deliveryFee`.

### Order form (product page)

- Schemas in `shared/src/schemas/product-order.ts`: `productOrderSchema` (the payload the API will validate) and `productOrderFormSchema` (same rules for the form, whose wilaya select and size start empty; its output is a `ProductOrder`). Customer fields and the "address required for home delivery" rule come from `customer.ts`.
- Fields: Nom complet, Numéro de téléphone (05/06/07 + 8 digits, spaces allowed), Wilaya (58, `formatWilaya`, hint for the new wilayas, "Livraison estimée : N jours"), Commune, Mode de livraison ("À domicile" / "Au bureau" with the price of each; "Au bureau" hidden where `getAvailableDeliveryTypes` has no stop desk, and the choice falls back to home), Adresse (required for home delivery only). Color, size and quantity come from the selectors above the form and are part of the same form.
- Color: required when the product has several colors, selected automatically when it has one. A color can have its own `images`; the gallery then shows them.
- Size: once a color is chosen, the sizes show that color's stock (sold out = crossed out, "Plus que X en stock" from 3). Before a color is chosen, a size is crossed out only if it is sold out in every color. Changing color unselects the size if it is sold out in the new color.
- Quantity: 1 to `min(stock of the variant, 10)` (`MAX_QUANTITY_PER_ORDER`).
- The form uses `createProductOrderFormSchema(product)` and the submit `createProductOrderSchema(product)`: the shared rules plus `refineVariantStock` (color exists, variant not sold out, quantity ≤ variant stock), with French errors under the color, size or quantity.

### Stock per variant (color + size)

- Stock lives on each color: `colors: [{ name, hex, images?, stock: { S, M, L, XL, XXL } }]`. A variant is one color × one size. A product with one color has one stock table. There is no product-level `stock` field.
- Every color must give a stock for all five sizes (0 = not sold or sold out); missing or invalid values get French errors per size.
- Read stock only with the shared helpers: `getVariantStock(product, color, size)`, `getSizeStock(product, size)` (all colors) and `isProductInStock(product)`.
- Collection filters: a size filter matches a product that has stock in that size **in one of the filtered colors** (any color when no color is filtered).
- **Backend step:** store the stock per variant on the product (same structure), validate each order with `createProductOrderSchema(product)` against the product loaded from the database, and **decrement the stock of the ordered variant** (color + size) atomically when the order is created (e.g. a conditional `$inc` on `colors.$[c].stock.<size>` that only matches when the stock is ≥ the quantity), so two orders can never sell the same last unit. Restore it when an order is cancelled or returned.
- Live summary above the button: price × quantity, delivery fee, discount line or "Livraison gratuite", total, and the next-tier hint (`formatNextTierMessage`: "Ajoutez 1 article pour la livraison gratuite"). Before the wilaya is chosen it uses `getDeliveryDiscountProgress`.
- "Confirmer la commande" is disabled while sending and a second click is ignored (one order only). Invalid submit: French error under each field, then scroll to and focus the first invalid field (color and size first).

The product page shows the product's tiers in French ("1 article : −100 DA · 2 articles : −200 DA · 3 articles : livraison gratuite").

**UI for later steps (not built yet, build it when that step comes):**

- **Admin product form:** a tier editor "Réductions sur la livraison" to add, edit and remove rows (quantité minimum, type : montant ou livraison gratuite, montant en DA), with a live French preview of the rule.
- **Dashboard statistics:** total delivery discounts given (sum of `deliveryDiscount`) and the number of free-delivery orders (`freeDelivery`).

## Design rules (from `design/Homepage.png`)

### Palette

Tokens are defined in `frontend/src/app/globals.css` (`@theme`). Use the token classes (`bg-bone`, `text-ink`, ...). Never hard-code hex values in components.

| Token      | Hex       | Use                                                          |
| ---------- | --------- | ------------------------------------------------------------ |
| `ink`      | `#111111` | Headings and text on light, primary dark buttons             |
| `onyx`     | `#1B1B1B` | Solid black blocks (e.g. the "Draw what you can't say" tile) |
| `graphite` | `#3A3937` | Dark grey sections (collection band, story band)             |
| `bone`     | `#F5F2EC` | Warm off-white page background                               |
| `cream`    | `#E8E4DC` | Product tile background                                      |
| `paper`    | `#FBF8F3` | White text and white buttons on dark                         |
| `mist`     | `#D2D0CD` | Body text on dark sections                                   |
| `ash`      | `#403E3C` | Product names, secondary text on light                       |
| `stone`    | `#74706D` | Muted text on light (footer links, meta)                     |
| `line`     | `#D6D2CA` | Hairline borders on light                                    |
| `error`    | `#9B2C1F` | Form error messages (muted brick)                            |

### Typography (Google Fonts via `next/font`, see `frontend/src/lib/fonts.ts`)

- **Display** `font-display`: _Cormorant Garamond_ (500–700). Logo, hero, section headings. Headings are uppercase, tight leading.
- **Body** `font-serif` (default): _Spectral_ (300–600). Body copy, nav, buttons, prices.
- **Labels:** Spectral, uppercase, small (`text-[11px]`–`text-xs`), wide letter-spacing (`tracking-label` = 0.3em, `tracking-wide-label` = 0.45em). Used for nav, eyebrows ("THE COLLECTION"), buttons and product names.
- **Hand** `font-hand`: _Covered By Your Grace_. Only for the handwritten side quotes ("Some things live better in art."), slightly rotated, with a short hand-drawn underline.

### Mood and layout

- Minimal, editorial, brutalist concrete. Black & white photography (grayscale, warm-tinted).
- **Sharp corners everywhere**: no `rounded-*` except circular icon buttons and color swatches.
- Thin 1px lines and outlined buttons. Primary button = `paper` on dark / `ink` on light, secondary = 1px outline.
- Lots of whitespace, a strong grid, generous section padding.
- Arrows (→) after CTA labels.

## Frontend structure (`frontend/src/`)

- `app/`: routes. `layout.tsx` holds the header, footer, skip link and default French SEO metadata.
- `components/ui/`: building blocks: `Button` (filled or outlined, `surface="dark" | "light"`), `SectionLabel`, `SectionTitle`, `ArrowLink`, `HandQuote`, `Container`, `Logo`, `icons.tsx` (thin line SVG icons). Reuse them; do not restyle buttons or labels by hand.
- `components/contact/`: the contact page sections (`ContactHero`, `ContactChannels`, `FaqBand`, `BrandLocation`) and `ContactForm`. `components/ui/form-field.tsx`: `FormField` (label, control, hint, French error; `labelStyle="caps" | "plain"`), `inputClasses` and `describedBy`, shared by the order and contact forms.
- `components/layout/`: `SiteHeader` (transparent over the hero on `/`, dark band elsewhere, full-screen menu below `lg`), `SiteFooter`, `NewsletterForm` (TanStack Form + `newsletterFormSchema`, `revalidateLogic`).
- `components/home/`, `components/collection/`, `components/product/`: page sections, `ProductCard` / `ProductListItem` (the whole card links to the product page, no "+" button), product gallery, quantity stepper, size guide dialog.
- `components/product/order/`: the product page order. `ProductOrderProvider` owns the TanStack Form (`productOrderFormSchema`, `revalidateLogic`) and shares it through context with `ProductOptions` (color, size, quantity), `ProductOrderGallery` (photos of the selected color), `OrderForm` + `OrderSummary`, and `StickyOrderButton` (mobile only: "Commander maintenant" fixed at the bottom, scrolls to the form, hidden once the form is on screen). The provider also sends ViewContent and InitiateCheckout.
- `app/merci/` + `components/order/OrderConfirmation`: thank-you page (`/merci?commande=RSM-123456`, noindex): order number, summary, "Nous vous appellerons pour confirmer votre commande", link to the collection. Sends Purchase.
- French tier texts come from `formatDeliveryDiscountTiers` / `formatTierBenefit` / `formatDiscount` / `formatNextTierMessage`.
- **Collection filters live in the URL** (`?category=hoodie,tshirt&color=noir&size=M&min=5000&max=8000&sort=price-asc&view=list`). Pure logic in `lib/collection-filters.ts` (parse, serialize, facets, filter and sort, tested). The page updates the URL with `window.history.replaceState` (no server round trip) and reads it with `useSearchParams`; the page awaits `searchParams`, so a shared link is server-rendered already filtered.
- `SiteHeader` floats over the photo on `/`, `/collection` and `/contact`, and uses the narrow width on `/collection/*`. `Container size="narrow"` is the shop page width (design/Collection.png).
- `content/`: editorial content that is not API data: `hero-slides.ts` (add a slide = add one entry), `navigation.ts` (menu, footer columns, social links), `contact.ts` (WhatsApp, phone and social links, the single source for them), `size-guide.ts` (placeholder measurements, see `docs/TODO.md`).
- `lib/data/`: the data layer (mocks today, API later). `orders.ts`: `placeProductOrder` validates with `createProductOrderSchema(product)` (color and stock per color + size), prices the order with the shared delivery helper, builds an `Order` (fake number `RSM-123456`) and keeps it in sessionStorage; `getOrder` reads it back for `/merci`. In the connect step both call the API instead. `lib/routes.ts`: every internal URL. `lib/cn.ts`: class name helper.
- Images live in `frontend/public/images/<section>/`. Placeholders and the photos still needed are listed in `docs/PHOTOS-NEEDED.md`; other open items in `docs/TODO.md`.
- Product packshots are square on cream and shown with `object-contain` in 5:4 tiles. After replacing an image with the same file name, delete `frontend/.next` if the dev server still shows the old one (image cache).
- English phrases inside French pages (slogans, quotes) get `lang="en"` (`SectionTitle` has a `lang` prop, `HandQuote` sets it itself).
- **Meta Pixel** (`lib/analytics/meta-pixel.ts`): loaded only when `NEXT_PUBLIC_META_PIXEL_ID` is set (otherwise no Meta script at all). Always go through `trackMetaEvent` / `trackPurchaseOnce`. Events: PageView on every page (`MetaPixelPageView` in the root layout), ViewContent on product pages (id, name, price), InitiateCheckout on the first focus in the order form, Purchase on `/merci` (value = order total, `eventID` = order number, once per order, remembered in localStorage). Currency `DZD` (`PIXEL_CURRENCY`), kept on purpose: DZD is a supported Meta ad account currency, even though the Pixel script logs a currency warning on Purchase. Duplicate calls caused by React Strict Mode in development are dropped.
- Animations respect `prefers-reduced-motion` (`motion-safe:` / `motion-reduce:` classes; the hero slider does not auto-play).

## Code rules

- TypeScript `strict` everywhere. **No `any`** (lint error). Prefer types inferred from Zod schemas.
- Small, reusable components. Shared UI goes in `frontend/src/components/`, not copy-pasted.
- **Data access only through `frontend/src/lib/data/`** (`getFeaturedProducts`, `getCategoryCards`, `subscribeToNewsletter`…). Components and pages never import `@rassm/shared/mocks` directly, so swapping the mocks for the API later only touches that folder.
- **Mobile first:** write base styles for 375px, then add `md:` / `lg:` overrides.
- Secrets and URLs go in env variables. Every app with env vars has a committed `.env.example`. Never commit `.env*` files.
- Use the `@/` alias for imports inside `frontend/src`.
- Prettier formats code (Tailwind classes are auto-sorted). ESLint runs with the shared config.

## Definition of Done (every task)

1. Run `pnpm typecheck`, `pnpm lint` and `pnpm test` from the root and fix all errors in every workspace.
2. Run the app (`pnpm dev`) and check there are **no terminal or browser console errors**.
3. For UI work: compare the result with `design/Homepage.png` at **375px, 768px and 1440px** widths. Headless Chrome cannot go below ~500px, so check 500px automatically and let the user check 375px.
4. End with a short summary: what was done, and what the user needs to do or decide.
