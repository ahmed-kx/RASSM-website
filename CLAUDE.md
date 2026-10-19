# RASSM

E-commerce website for **RASSM**, an Algerian streetwear brand. Tagline: **"Draw what you can't say."**
Oversized hoodies, sweatshirts and t-shirts with artistic sketch prints.

- Prices in Algerian Dinar, integers only, always displayed as `7 900 DA` (narrow no-break space for thousands, `DA` after the number, discounts as `−100 DA`) (use `formatPrice` from `@rassm/shared`, never format by hand).
- Cash on delivery only, to the **58 wilayas** of Algeria (home delivery or stop desk), shipped by our courier **Anderson** from Alger. Some wilayas have **no stop desk** (see Business rules).
- Customer-facing language is **French** (see Language rule below).
- The design references are `design/Homepage.png` and `design/Collection.png`. Read the relevant one before any UI work.

## Language rule

- **All code is in English:** names, files, folders, comments, commit messages, schema fields, enum values.
- **Everything customers see is in French:** navigation, buttons, labels, forms, error messages, empty states, page titles, SEO metadata (`<title>`, description, Open Graph), product content. The `<html>` tag uses `lang="fr"`. The **admin dashboard is in French too**.
- **Exception:** brand slogans and artistic phrases stay in **English**: "Draw what you can't say.", "Wear your silence.", "Art lives in all of us.", "Real people. Bigger feelings.", and the handwritten quotes ("Some things live better in art.", "Different thoughts. Same human.", "Same people. Different stories."). Product names (e.g. "Signature Hoodie") are brand names and stay as they are.
- `design/Homepage.png` shows English UI text (nav, buttons, section labels). Translate it to French when building, e.g. Accueil, Collection, Lookbook, À propos, Contact, "Découvrir la collection", "Voir tout", "Produits phares". Keep the slogans in English.
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
- The **backend always recalculates** from the products loaded from the database and the fee table. It never trusts tiers, discounts or delivery amounts sent by the client. Cart items carry no discount data.
- Orders store `deliveryFeeBase`, `deliveryDiscount`, `deliveryFee`, `freeDelivery` and `deliveryDiscountLines`. Order checks: `deliveryFee = deliveryFeeBase − deliveryDiscount` (never negative), the discount matches the lines, `freeDelivery` is true exactly when a free tier applied, and `total = subtotal + deliveryFee`.

**UI for later steps (not built yet, build it when that step comes):**

- **Product page:** show the product's tiers in French, e.g. "1 article : −100 DA · 2 articles : −200 DA · 3 articles : livraison gratuite".
- **Checkout, wilaya select:** list the 58 wilayas as "16 - Alger" (`formatWilaya`). Under the select, show a French hint telling customers from the new wilayas to choose their former wilaya, e.g. "Vous habitez dans une nouvelle wilaya (Aflou, Barika, Bou Saâda…) ? Choisissez votre ancienne wilaya de rattachement." Show the estimated delivery time ("Livraison estimée : 1 jour").
- **Checkout:** only offer the delivery types from `getAvailableDeliveryTypes`. For a wilaya without stop desk, hide or disable "Retrait au stop desk" and explain it in French.
- **Cart and checkout:** show the base delivery fee, the discount line ("Réduction livraison −150 DA"), then the final fee or "Livraison gratuite". Show the next-tier message from `nextDeliveryDiscountTiers`, e.g. "Ajoutez 1 sweatshirt pour la livraison gratuite".
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
- **Sharp corners everywhere**: no `rounded-*` except circular icon buttons (the "+" add-to-cart).
- Thin 1px lines and outlined buttons. Primary button = `paper` on dark / `ink` on light, secondary = 1px outline.
- Lots of whitespace, a strong grid, generous section padding.
- Arrows (→) after CTA labels.

## Frontend structure (`frontend/src/`)

- `app/`: routes. `layout.tsx` holds the header, footer, skip link and default French SEO metadata.
- `components/ui/`: building blocks: `Button` (filled or outlined, `surface="dark" | "light"`), `SectionLabel`, `SectionTitle`, `ArrowLink`, `HandQuote`, `Container`, `Logo`, `icons.tsx` (thin line SVG icons). Reuse them; do not restyle buttons or labels by hand.
- `components/layout/`: `SiteHeader` (transparent over the hero on `/`, dark band elsewhere, full-screen menu below `lg`), `SiteFooter`, `NewsletterForm` (TanStack Form + `newsletterFormSchema`, `revalidateLogic`).
- `components/home/`, `components/collection/`, `components/product/`: page sections, `ProductCard` / `ProductListItem`, `QuickAdd` (the "+" size picker), product gallery, add-to-cart form, size guide dialog.
- `components/cart/`: `CartProvider` (in the root layout: loads the saved cart after mount, syncs it with the catalog and other tabs, renders the drawer), `CartDrawer`, `DeliveryProgress`, `QuantityStepper`.
- **Cart:** Zustand store in `lib/cart/cart-store.ts`, persisted in localStorage (`rassm-cart`) with `skipHydration` + rehydrate after mount, so there is no hydration mismatch. Items are the shared `CartItem` type and are re-validated with `cartItemSchema` when loaded. One line per product + size; quantity is capped at `getMaxQuantity` (stock, max 10). Read the count with `useCartCount()`.
- **Delivery progress in the cart** uses `getDeliveryDiscountProgress` from `@rassm/shared` (same tier rules, no wilaya needed). French tier texts come from `formatDeliveryDiscountTiers` / `formatTierBenefit` / `formatDiscount`.
- **Collection filters live in the URL** (`?category=hoodie,tshirt&color=noir&size=M&min=5000&max=8000&sort=price-asc&view=list`). Pure logic in `lib/collection-filters.ts` (parse, serialize, facets, filter and sort, tested). The page updates the URL with `window.history.replaceState` (no server round trip) and reads it with `useSearchParams`; the page awaits `searchParams`, so a shared link is server-rendered already filtered.
- `SiteHeader` floats over the photo on `/` and `/collection`, and uses the narrow width on `/collection/*`. `Container size="narrow"` is the shop page width (design/Collection.png).
- `content/`: editorial content that is not API data: `hero-slides.ts` (add a slide = add one entry), `navigation.ts` (menu, footer columns, social links), `size-guide.ts` (placeholder measurements, see `docs/TODO.md`).
- `lib/data/`: the data layer (mocks today, API later). `lib/routes.ts`: every internal URL. `lib/cn.ts`: class name helper.
- Images live in `frontend/public/images/<section>/`. Placeholders and the photos still needed are listed in `docs/PHOTOS-NEEDED.md`; other open items in `docs/TODO.md`.
- Product packshots are square on cream and shown with `object-contain` in 5:4 tiles. After replacing an image with the same file name, delete `frontend/.next` if the dev server still shows the old one (image cache).
- English phrases inside French pages (slogans, quotes) get `lang="en"` (`SectionTitle` has a `lang` prop, `HandQuote` sets it itself).
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
