# RASSM

E-commerce website for **RASSM**, an Algerian streetwear brand. Tagline: **"Draw what you can't say."**
Oversized hoodies, sweatshirts and t-shirts with artistic sketch prints.

- Prices in Algerian Dinar, integers only, always displayed as `7 900 DA` (narrow no-break space for thousands, `DA` after the number, discounts as `−100 DA`) (use `formatPrice` from `@rassm/shared`, never format by hand).
- Cash on delivery only, to the **58 wilayas** of Algeria (home delivery or stop desk), shipped by our courier **Anderson** from Alger. Some wilayas have **no stop desk** (see Business rules).
- **Sales flow (Meta Ads):** visitors land on a product page from an ad and order that product directly with the form on the page. There is **no cart and no checkout page**: one order = one product (one color, one size, a quantity). After the order, the customer lands on `/merci` ("commande reçue") and the team calls them: **the order is confirmed only after this phone call**.
- Customer-facing language is **French** (see Language rule below).
- The design references are `design/Homepage.png`, `design/Collection.png`, `design/Contact.png` and `design/About.png` (ignore the cart icon in the designs: there is no cart), and for the dashboard `design/admin-orders.png`, `design/admin-order-detail.png`, `design/admin-products.png` and `design/admin-delivery.png` (see "Admin design system"). Read the relevant one before any UI work.

## Language rule

- **All code is in English:** names, files, folders, comments, commit messages, schema fields, enum values.
- **Everything customers see is in French:** navigation, buttons, labels, forms, error messages, empty states, page titles, SEO metadata (`<title>`, description, Open Graph), product content. The `<html>` tag uses `lang="fr"`. The **admin dashboard is in French too**.
- **Everything is French, slogans, titles and handwritten quotes included.** The only exceptions:
  - the brand name **RASSM**;
  - **product names** (Signature Hoodie, Fragment Sweatshirt…);
  - the logo tagline **"Draw what you can't say."**, only next to the logo in the footer (with `lang="en"`). Everywhere else it is "Dessiner ce qu'on ne peut pas dire.";
  - common fashion words used in French as-is: **Hoodies, Sweatshirts, T-shirts, Drop, Oversize**.
- Brand phrases in French (use exactly these): "Dessiner ce qu'on ne peut pas dire.", "Certaines choses vivent mieux dans l'art.", "Portez votre silence.", "L'art vit en chacun de nous.", "Pensées différentes, même humain.", "Pensées différentes. Même humain.", "Mêmes personnes, histoires différentes.", "Mêmes pensées. Histoires différentes.", "De vraies personnes. Des émotions plus grandes.", "Parlons-en.", "Nous sommes là pour vous.", "Plus que des vêtements.", "Ce que nous défendons.", "L'art nous relie partout.", "Nouveau Drop 001". Any new text: natural French in the same tone (short, poetic, "vous").
- Avoid other English words in customer text ("streetwear" → "mode urbaine", "premium", "look"…). Tolerated because customers use them: brand names (WhatsApp, Instagram, TikTok), "e-mail", "newsletter" and "stop desk" (Anderson's term, always next to "au bureau").
- French typography: accents on capitals (CSS `uppercase` keeps them: "À PROPOS"), a space before ":" "?" "!" (a no-break space `&nbsp;` in titles so the sign never starts a line), French quotes « … ».
- The designs (`design/*.png`) show English text: translate all of it to French when building (Accueil, Collection, À propos, Contact, "Découvrir la collection", "Voir tout", "Produits phares", and the slogans above). French is often longer: check that titles, buttons and handwritten quotes still fit at 500 / 768 / 1440 px.
- **Every Zod error message in `shared/` is French.** `shared/src/schemas/common.ts` also sets Zod's French locale (`z.config(z.locales.fr())`), so built-in messages are French too. Never add an English error message.

## Stack

- **Monorepo:** pnpm workspaces
  - `frontend/`: Next.js (App Router), TypeScript, Tailwind CSS v4, TanStack Form, TanStack Query
  - `backend/`: Express 5 + TypeScript, MongoDB (Atlas) with Mongoose, run with `tsx`
  - `shared/`: Zod schemas, inferred types, constants, helpers (pricing, collection filters), API request/response shapes, mock data
  - `config/eslint/`: shared ESLint flat config (`/base`, `/next`)
- **Validation:** Zod v4. **All schemas live in `shared/`** and are used by both the frontend forms and the backend. Never redefine a schema or type in an app; import it from `@rassm/shared`.
- Mock data (`@rassm/shared/mocks`, parsed through the schemas at load time) is used **only by the seed script and the tests**. The site reads everything from the API.
- TypeScript is pinned to `~6.0` because typescript-eslint does not support 7.x yet.
- Next.js is v16 (Turbopack, `next lint` removed, ESLint runs directly). Read `frontend/AGENTS.md` and the docs in `frontend/node_modules/next/dist/docs/` before using a Next API you are unsure about.
- `@rassm/shared` ships TS source with extensionless imports. It runs through Next (`transpilePackages`) or `tsx`, not plain `node`.

### Commands (run from the root)

| Command               | What it does                                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`            | Starts the web app (http://localhost:3000) and the API (http://localhost:4000)                                                |
| `pnpm seed`           | Loads the products and the Anderson fees into MongoDB (`--reset` overwrites products)                                         |
| `pnpm create-admin`   | Creates a dashboard admin, or resets its password (asks the e-mail and password in the terminal)                              |
| `pnpm migrate-images` | Uploads the product photos still in `frontend/public/images/products` to Cloudinary and updates the products (safe to re-run) |
| `pnpm build`          | Builds every workspace                                                                                                        |
| `pnpm typecheck`      | Type-checks every workspace                                                                                                   |
| `pnpm lint`           | Lints every workspace                                                                                                         |
| `pnpm test`           | Runs the tests (Vitest: `shared/`, `frontend/`, `backend/` with an in-memory MongoDB)                                         |
| `pnpm format`         | Formats everything with Prettier                                                                                              |

## Build order

1. **Frontend first**, using mock data from `@rassm/shared/mocks`. Done.
2. **Backend:** Express API + MongoDB. Done (step 3A).
3. **Connect** the frontend to the API, replacing mocks. Done (step 3A): server components fetch with a short revalidation, forms post with `fetch`. TanStack Query is not needed yet; add it when the dashboard needs client-side caching.
4. **Admin dashboard.** Step 3B done: auth, orders (list, detail, statuses, edits, blacklist, Anderson export), live notifications, new order e-mail. Step 3C done: Produits (list, form, photos on Cloudinary, stock, duplicate, hide, delete) and Livraison (prices, stop desk, suspension, bulk changes), with on-demand refresh of the public pages. Next: Tableau de bord, Messages, Abonnés (today "Bientôt disponible").

Do only the step you are asked to do. Do not start a later step early.

## Business rules

### Exchange policy (the "Échanges" page, `/echanges`)

- The exchange must be **requested on the day of delivery**.
- The product must be **unworn and in its original condition**.
- The **customer pays the delivery costs** of the exchange.
- If the product does not come back in the same condition, there is **no exchange**: the same product is sent back to the customer.
- Wherever the site mentions exchanges, say "Échange possible le jour de la livraison" and link to `/echanges` (`routes.exchanges`). Today: the product page reassurance line, the note under the order button, the size guide and the FAQ. The `/echanges` page writes the four rules as numbered steps with a WhatsApp button "Demander un échange" (prefilled message, `whatsappLink` from `content/contact.ts`); keep it in sync with these rules.

### Contact

- WhatsApp and phone: **0780 29 49 10** (`https://wa.me/213780294910`, `tel:+213780294910`); Instagram **@rassm.wear**. These live in `frontend/src/content/contact.ts` (`CONTACT`): never hard-code the number or the links elsewhere. The footer, the contact page and `SOCIAL_LINKS` read it.
- No public e-mail address and no opening hours are shown.
- Contact form (`contactFormSchema` in `shared/src/schemas/forms.ts`): Prénom, Nom, Téléphone (required, Algerian format), E-mail (optional, empty = `undefined`), Sujet (`CONTACT_SUBJECTS`: Commande, Échange, Collaboration, Autre), Message (10 to 2 000 characters). `sendContactMessage` (`lib/data/contact.ts`) posts to `POST /api/contact-messages`, which validates with the same schema (`contactRequestSchema` = the form + the honeypot) and saves a `ContactMessage` (`read: false`, read in the admin dashboard).

### Delivery fees and stop desk

- `WILAYAS` holds the **58 official wilayas** (codes 01 to 58), the list Anderson uses. The wilayas created in 2025 (Aflou, Barika, Bou Saâda…) are deliberately not in the list.
- Each wilaya has a `homePrice`, a `stopDeskPrice` and `estimatedDays` (delivery time from Alger). `stopDeskPrice: null` means **no stop desk, home delivery only**. Today that applies to Tindouf (37), Bordj Badji Mokhtar (50), Béni Abbès (52) and In Guezzam (54).
- Use `getAvailableDeliveryTypes(fee)` to decide which delivery options to show. `getDeliveryPrice` and `getDeliveryFeeWithDiscount` throw `DeliveryTypeUnavailableError` (French message) for stop desk in those wilayas. The backend must turn it into a 400 error and never accept such an order.
- Mock fees (`shared/src/mocks/delivery-fees.ts`) are the real **Anderson rates, departure Alger**, e.g. Alger 400 home / 250 stop desk, 1 day. The highest home price is Djanet (1,800 DA), which is the limit for discount tier amounts.
- **Prices are edited in the dashboard** (`/admin/livraison`): home and office prices (positive whole DA), delay, stop desk on/off (`stopDeskPrice: null`), and **`suspended`**: a suspended wilaya is shown disabled in the order form ("Livraison temporairement indisponible", `WILAYA_SUSPENDED_LABEL`), marked on `/livraison`, and the API refuses its orders (400 under `wilayaCode`, `WILAYA_SUSPENDED_MESSAGE`; an admin edit that keeps the order's wilaya is allowed). A price change that would make a product tier invalid (amount not lower than the new highest home price) is shown as a warning before saving (`?apercu=1` preview), never silently. `pnpm seed` only adds missing wilayas (it never overwrites edited prices, except `--reset`).
- **Regions** (dashboard tabs, `region` on each wilaya in `WILAYAS`, `REGION_LABELS`): four regions. Centre = Alger, the central coast, Kabylie, Médéa and Aïn Defla (06, 09, 10, 15, 16, 26, 35, 42, 44); Est = the north-east with M'Sila (04, 05, 12, 18, 19, 21, 23, 24, 25, 28, 34, 36, 40, 41, 43); Ouest = the north-west with Chlef, Tiaret and Tissemsilt (02, 13, 14, 20, 22, 27, 29, 31, 38, 46, 48); Sud = the Sahara, its gates (Laghouat, Djelfa, Biskra, El Bayadh, Naâma) and the new wilayas (01, 03, 07, 08, 11, 17, 30, 32, 33, 37, 39, 45, 47, 49 to 58).

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

### Order confirmation (phone call first, no order number for customers)

- A new order has the status `pending` and is **"reçue" (received)**, never "confirmée". It is **confirmed only after our phone call** (we check the product, the size and the address, then the status becomes `confirmed`). Customer texts must never say the order is confirmed before that call.
- **The customer never sees an order number**: not on `/merci` (the URL has no query string), not in the FAQ, the delivery steps, the form notes or the metadata. `orderNumber` (`RSM-000123`, from an atomic counter) exists **internally only**, for the admin dashboard: the API never sends it to the browser. The browser receives the order summary (`orderSummarySchema`: the order without id and number) and an `eventId` (the internal order id), used only as the Meta event id.
- `/merci` says "Merci, votre commande est bien reçue. Nous vous appellerons très bientôt pour la confirmer. Gardez votre téléphone à portée de main.", keeps the order summary (product, color, size, quantity, delivery, total) and reads the last order saved on the device (`getLastOrder`). A customer who needs to change an order contacts us by WhatsApp with their name and product.

### Order form (product page)

- Schemas in `shared/src/schemas/product-order.ts`: `productOrderSchema` (the payload the API validates, inside `orderRequestSchema`) and `productOrderFormSchema` (same rules for the form, whose wilaya select and size start empty; its output is a `ProductOrder`). Customer fields and the "address required for home delivery" rule come from `customer.ts`.
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
- **Backend:** the stock is stored per variant on the product (same structure). Each order is validated with `createProductOrderSchema(product)` against the product loaded from the database, then the stock of the ordered variant is **decremented atomically** (`reserveStock` in `backend/src/services/orders.ts`: one `updateOne` whose filter only matches when `colors.$elemMatch { name, stock.<size> ≥ quantity }`, with `$inc` on `colors.$.stock.<size>`), so two orders can never sell the same last unit; when it does not match, the API answers 409 with the French stock error under the size or quantity. If saving the order fails, the units are given back. **Dashboard step:** restore the stock when an order is cancelled or returned.
- Live summary above the button: price × quantity, delivery fee, discount line or "Livraison gratuite", total, and the next-tier hint (`formatNextTierMessage`: "Ajoutez 1 article pour la livraison gratuite"). Before the wilaya is chosen it uses `getDeliveryDiscountProgress`.
- "Confirmer la commande" is disabled while sending and a second click is ignored (one order only). Invalid submit: French error under each field, then scroll to and focus the first invalid field (color and size first).

The product page shows the product's tiers in French ("1 article : −100 DA · 2 articles : −200 DA · 3 articles : livraison gratuite").

### Order statuses, stock and blacklist (dashboard)

- Statuses: `pending` (Reçue, "Nouvelles" tab) → `confirmed` → `shipped` → `delivered`; `cancelled` and `returned` close it. Allowed changes only (`ORDER_STATUS_TRANSITIONS` in `shared/src/schemas/admin.ts`): pending → confirmed / cancelled; confirmed → shipped / cancelled; shipped → delivered / returned; delivered → returned; cancelled → pending (reopen). Never "livrée" before "expédiée".
- **Stock:** the units are taken when the order is placed (`stockReserved: true`; orders saved before the dashboard have no flag and count as holding their units). Cancelled or returned → given back **exactly once** (the flag flips atomically first, so double clicks or repeated changes never give them back twice). Reopening a cancelled order takes them again if they are still in stock (otherwise a French 409).
- **Edits** are allowed while `pending` or `confirmed` (after the call: other size, color, quantity, wilaya, commune, address, delivery type, name, phone). Every amount is recomputed with the shared helpers (unit price kept as agreed, tiers and fees from the database), and the stock moves atomically: the new variant is taken first, the old one given back once the order is saved. Each edit is written in the history ("Taille M → L, Total 7 200 DA → 14 000 DA").
- Every change (creation, status, edit, blacklist) is in `history` with date, time and admin e-mail. `adminNote` is a free internal note. `openedAt` (null = "Nouveau" badge) is set when an admin opens the order.
- Confirming an order sends the Meta event `sendOrderConfirmed` in the background (only with the Meta env variables).
- **Blacklist** (`Blacklist` model, phone + French reason): new orders from these numbers are still saved, but flagged "Liste noire" (red) in the dashboard and the e-mail. Checked when orders are read, so removing a number removes the flag.
- **Anderson export:** confirmed orders (chosen, or all) as a CSV for Excel (UTF-8 BOM, `;`): Référence, Nom, Téléphone (with spaces so Excel keeps the 0), Wilaya, Commune, Adresse ("Stop desk (bureau Anderson)" for stop desk), Type de livraison (Domicile / Stop desk), Produit, Montant à encaisser (DA). Then "Marquer expédiées" ships the exported orders in one action.
- **New order e-mail** (Brevo, `backend/src/notifications/new-order-email.ts`): sent in the background for each real new order (never for a honeypot or a duplicate) to `NOTIFY_EMAIL`, in French (customer, phone, wilaya, commune, product, color, size, quantity, total, flags, button to the order). A Brevo failure is logged and stored on the order (`emailNotification.status`), never failing the order.

### Products in the dashboard (step 3C)

- **SKU** (`sku`, `skuSchema`): readable and unique, made by the API from the category (`RSM-H-001` hoodies, `RSM-S-` sweatshirts, `RSM-T-` t-shirts, next free number; `nextSku`), never typed by hand and never changed (even if the category changes). Products saved before step 3C get one when the API starts (`ensureProductSkus`, safe to re-run). The Anderson export puts it before the product name.
- **Form** (`adminProductInputSchema` / `createAdminProductInputSchema(maxHomeDeliveryPrice)`, TanStack Form, French errors under each field, server errors too): name, slug (from the name with `slugify`, editable, unique: 409 under `slug`), description, category, price, drop ("Drop 001"), colors (name + swatch, up to 8), **photos per color** (at least 1, up to 12; the first is the main photo; the product's `images` = the first color's photos), stock grid per color × size, the tier editor "Réductions sur la livraison" with a live preview identical to the product page, switches "Visible sur le site" (`isActive`) and "Mis en avant" (`featured`). Saving sends the `updatedAt` read with the product: if it changed meanwhile (an order took stock), the API answers 409 and the admin reloads. Leaving with unsaved changes asks for confirmation.
- **Status** (`getProductStatus(product, lowStockThreshold)`): Masqué (hidden) / Rupture (total stock 0) / Stock faible (**total stock** of all colors and sizes at or below the threshold) / Actif; stock dot green / ochre / red. The threshold (default 10, `DEFAULT_LOW_STOCK_THRESHOLD`) is a dashboard setting stored in the database (`Setting` model, `GET|PUT /api/admin/settings`, button "Seuil de stock faible" on the products page). A variant with 1 to 3 units (`LOW_VARIANT_STOCK`) is only highlighted in ochre inside the stock grid, never as a product status.
- **Duplicate:** hidden copy, "(copie)" in the name, new slug (`-copie`, `-copie-2`…), new SKU, stock at 0, same photos.
- **Delete / hide:** a product with orders can only be hidden (orders keep their data); a product without orders can be deleted after confirmation. Hidden products are absent from the collection and their page is the French 404; out-of-stock products stay visible (sizes crossed out).
- **Photos** (Cloudinary, `backend/src/services/image-storage.ts`): uploaded through the API (`POST /api/admin/uploads`, signed, the secret never reaches the browser), JPG / PNG / WebP only (checked from the file's bytes), 8 MB max, stored resized to 2 000 px and compressed as WebP; next/image serves them (`images.remotePatterns` in `next.config.ts`). A photo is deleted from Cloudinary when nothing uses it any more: removed from a product (on save), removed in the form before saving, or its product deleted, but never while another product (a duplicate) or an order still uses it.
- **Public pages refresh at once** after any product or delivery change: the API calls the website's `POST /api/revalidate` (secret header `x-revalidate-secret`, `REVALIDATE_SECRET` in both apps), which revalidates the cache tags `products` / `delivery-fees` used by `apiGet` (`{ expire: 0 }`: the next visitor gets fresh data).

**UI for later steps (not built yet, build it when that step comes):**

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
| `error`    | `#9B2C1F` | Form error messages (muted brick); "Liste noire" badge       |
| `warning`  | `#8A5D14` | Admin only: "Suspecte" badge (muted ochre)                   |
| `success`  | `#4A6B44` | Admin only: "Confirmée" / "Livrée" pills (muted green)       |
| `info`     | `#3D5A7A` | Admin only: "Expédiée" pill (muted blue)                     |
| `rose`     | `#8E3B54` | Admin only: "Retournée" pill (muted rose)                    |
| `sand`     | `#E9DFCD` | Admin only: "Nouvelle" pill, unopened order rows (beige)     |

### Typography (Google Fonts via `next/font`, see `frontend/src/lib/fonts.ts`)

- **Display** `font-display`: _Cormorant Garamond_ (500–700). Logo, hero, section headings. Headings are uppercase, tight leading.
- **Body** `font-serif` (default): _Spectral_ (300–600). Body copy, nav, buttons, prices.
- **Labels:** Spectral, uppercase, small (`text-[11px]`–`text-xs`), wide letter-spacing (`tracking-label` = 0.3em, `tracking-wide-label` = 0.45em). Used for nav, eyebrows ("THE COLLECTION"), buttons and product names.
- **Hand** `font-hand`: _Covered By Your Grace_. Only for the handwritten side quotes ("Some things live better in art."), slightly rotated, with a short hand-drawn underline.

### Mood and layout

- Minimal, editorial, brutalist concrete. Black & white photography (grayscale, warm-tinted).
- **Sharp corners everywhere** on the public site: no `rounded-*` except circular icon buttons and color swatches. The dashboard follows its own designs (small radius, see "Admin design system").
- Thin 1px lines and outlined buttons. Primary button = `paper` on dark / `ink` on light, secondary = 1px outline.
- Lots of whitespace, a strong grid, generous section padding.
- Arrows (→) after CTA labels.

## Admin design system (every dashboard page)

**Every admin page, including the ones built later (Tableau de bord, Produits, Livraison, Messages, Abonnés…), follows `design/admin-orders.png`, `design/admin-order-detail.png`, `design/admin-products.png` and `design/admin-delivery.png`, and is built from the shared pieces below.** Never restyle by hand what a piece already does.

- **Frame** (`AdminShell`, `components/admin/admin-shell.tsx`): dark sidebar (`onyx`, "RASSM" / "ADMIN", thin line icons, active item lighter with a hairline ring, beige "Nouveau" counter on Commandes, concrete texture fading at the bottom, admin card with initial and e-mail; the menu toggle folds it to icons, remembered). Light top bar: menu toggle, global search (`admin-search.tsx`: orders by name, phone or internal number, and products, grouped, arrow keys), sound, bell, avatar menu (logout). Breadcrumb under it. Phones: dark top bar (menu, logo, search, sound, bell, avatar), the sidebar as a drawer, the bottom navigation and the "Plus" sheet; everything reachable with one hand.
- **Pieces** (`components/admin/admin-ui.tsx`): `AdminPageHeader` (large serif uppercase title with lining figures, count next to it such as "10 commandes", small spaced uppercase subtitle, actions on the right), `AdminCard` (paper card, hairline border, `rounded-md`, spaced uppercase title, optional action), `InfoRow` (label / value lines; `strong` for "Total à encaisser"), `InitialAvatar` (round initial, `tone="inverse"` on dark), `buttonClass(variant, className, "caps" | "plain")` (primary black, outline, soft beige, danger red outline, on-dark variants), `adminInput` / `adminField`, `adminLabel`, `AdminEmpty`, `Pagination` ("N par page", "1–10 sur 69 commandes", page numbers). `AdminMenu` (`admin-top-bar.tsx`) for dropdowns (top bar menus and "⋯"). `AdminDialog` for confirmations (bottom sheet on phones).
- **Pills** (`components/admin/badges.tsx`): `StatusBadge` (Nouvelle sand, Confirmée and Livrée green, Expédiée blue, Annulée red, Retournée rose; a pending order is "Nouvelle" in the dashboard) and `OrderFlags` (Nouveau black, Liste noire red, Suspecte ochre).
- **Tables**: a paper card with spaced uppercase column headers, rows with an avatar or a thumbnail on `cream`, soft pills, a chevron, a stretched link covering the row, checkboxes and a dark bar of bulk actions when rows are selected, then `Pagination`. On phones each row becomes a card with the same information.
- **Style**: content on `bone`, cards on `paper`, radius `rounded-sm` (buttons, inputs, tabs, pills) and `rounded-md` (cards, menus, dialogs), status tabs as pill buttons with counts (active black). Admin texts are French like the rest of the site.
- `cn()` only joins class names (no merging): never pass a class that overrides one of a piece (background, padding, size); add a variant to the piece instead.

## Backend (`backend/src/`)

- `server.ts` (entry: env, MongoDB, listen; `connectDatabase` in `db.ts` retries the Atlas SRV lookup with `DNS_FALLBACK_SERVERS` when the computer's DNS refuses it, e.g. behind a VPN), `app.ts` (`createApp(options)`: helmet, CORS limited to `FRONTEND_ORIGIN`, JSON body limit 20 kB, NoSQL key guard, routes, 404, error handler), `env.ts` (Zod validation of the environment at startup, see `backend/.env.example`), `db.ts`, `seed.ts` + `seed-cli.ts` (`pnpm seed`).
- `models/`: Mongoose models matching the shared schemas: `Product` (`_id` = the shared id, e.g. `prod_001`; stock per color + size), `DeliveryFee` (58 wilayas), `Order`, `ContactMessage`, `NewsletterSubscriber` (unique email), `Counter` (order numbers), `Setting` (dashboard settings: low stock threshold). `toProduct`, `toOrderSummary`, `toOrder` convert documents to the shared types and validate them, so the API always answers in the shared shapes.
- Public API (paths in `API_PATHS`, `shared/src/schemas/api.ts`): `GET /api/products` (same query parameters as the collection page: `category`, `color`, `size`, `min`, `max`, `sort`; uses the shared `parseCollectionFilters` / `filterAndSortProducts`), `GET /api/products/:slug`, `GET /api/delivery-fees`, `POST /api/orders`, `POST /api/contact-messages`, `POST /api/newsletter`, `GET /health`.
- **Errors:** every body is validated with a shared schema (`parseOrThrow`). Errors the client may see are `HttpError` (status + French message + French `fields`), answered as `{ error: { message, fields? } }` (`apiErrorSchema`). Anything else is logged (English) and answered with a generic French 500 (503 "Le service est momentanément indisponible." when MongoDB cannot be reached): internals never leak.
- **Order flow** (`services/orders.ts`, `placeOrder`): validate → load the product → `createProductOrderSchema(product)` → price with `getDeliveryFeeWithDiscount` and the fees from the database → honeypot → duplicate check → atomic stock decrement → order number + fraud flags → save (`pending`, with client IP and user agent, Meta cookies) → Meta Purchase in the background → `201 { order, eventId }`.
- **Fake orders** (`services/fraud.ts`): rate limit per IP (orders 10, contact 5, newsletter 10 per 15 min, French 429); honeypot `website` filled → same success answer, nothing saved, no stock taken; same phone + same product within 30 min (not cancelled) → the first order is returned, nothing created; from the 3rd order of a phone or the 5th order of an IP in 24 h the order is saved with `suspicious: true` and a French `suspiciousReason`, never blocked.
- **Meta Conversions API** (`meta/conversions-api.ts`): only when `META_PIXEL_ID` and `META_CAPI_ACCESS_TOKEN` are set. Purchase with `event_id` = order id (same as the browser), `action_source: website`, hashed (SHA-256) phone `213…`, first and last name, wilaya as city, country `dz`, plus IP, user agent, fbp, fbc; value + `DZD`. Sent in the background, the result is stored on the order (`metaPurchase.status`: sent / failed / skipped); a failure is logged and never fails the order. `sendOrderConfirmed` (custom event `CommandeConfirmee`, `action_source: phone_call`) is ready for the dashboard step, when an order is confirmed by phone.
- **Seed:** creates missing products and wilayas; existing products and delivery prices are never overwritten (real stock and dashboard edits are kept) unless `pnpm seed --reset`. It also gives SKUs to products without one.
- **Tests** (`backend/test/`): Vitest + Supertest + mongodb-memory-server (one in-memory MongoDB, cleaned and re-seeded before each test, Meta mocked). Cover server-side pricing and discount tiers, ignored client prices, atomic stock, stop desk refused in Tindouf, honeypot, duplicates, fraud flags, rate limits, French validation errors, NoSQL injection, CORS, the Conversions API payload.

### Admin API (`/api/admin`, `backend/src/routes/admin.ts`)

- `POST /auth/login` (shared `adminLoginSchema`; 5 failures in a row lock the account 15 min, plus 10 attempts per IP per 15 min), `POST /auth/logout`, `GET /auth/me`. Passwords hashed with scrypt (`lib/password.ts`). Sessions (`AdminSession`): random token in the `rassm_admin` cookie (httpOnly, SameSite=Strict, Secure in production), only its SHA-256 stored, 14 days, extended while used, TTL index.
- Everything else requires a session (`requireAdmin`, 401 "Veuillez vous connecter."), changes must come from `FRONTEND_ORIGIN` (`requireSameOrigin`, CSRF), answers are `Cache-Control: no-store`: `GET /search?q=` (top bar: 5 orders by name, phone or internal number, and 5 products), `GET /orders` (tabs, counts, search by name, phone or order number "RSM-000123" / "123", wilaya, dates, numbered `page` or cursor), `GET /orders/updates?since=` (live polling), `GET /orders/:id` (marks it opened, returns the product for edits), `PATCH /orders/:id` (edit), `POST /orders/:id/status`, `PUT /orders/:id/note`, `POST /orders/:id/blacklist`, `POST /orders/export` (CSV), `POST /orders/ship`, `GET|POST /blacklist`, `DELETE /blacklist/:phone`.
- Products, photos and delivery prices (`routes/admin-catalog.ts`, services `admin-products.ts`, `admin-delivery.ts`, `image-storage.ts`): `GET|POST /products` (list with filters `category`, `q`, `status`, `drop`, `sort`, `page`, `limit`, tab counts, drops and KPIs; create), `GET|PUT|DELETE /products/:id`, `PATCH /products/:id/stock` (stock grid), `PATCH /products/:id/flags` (`isActive`, `featured`), `POST /products/:id/duplicate`, `GET|PUT /settings` (low stock threshold), `POST /uploads` (one photo, multipart field `image`; 503 in French when the Cloudinary keys are missing), `DELETE /uploads` (`{ url }`), `GET /delivery-fees` (with tier warnings), `PUT /delivery-fees/:code`, `POST /delivery-fees/bulk` (`adjust` ± amount, `suspend`, `reactivate`); `?apercu=1` = preview without saving. The admin router accepts JSON bodies up to 200 kB (public forms stay at 20 kB). KPI trends are only sent when computed from real data (count now against 30 days ago from creation dates); stock and price trends are not kept, so they are null.
- `pnpm migrate-images` (`src/migrate-images-cli.ts`) uploads the photos still served from `frontend/public/images/products` to Cloudinary (fixed names, `overwrite: false`: safe to re-run) and points the products to them; orders keep their paths (the files stay in the repo).
- `pnpm create-admin` (`src/create-admin-cli.ts`) asks the e-mail and the password (hidden, 10 characters minimum, `adminPasswordSchema`) in the terminal; an existing e-mail can get a new password (its sessions are closed). Never put credentials in code.
- Express trusts `X-Forwarded-For` from the configured proxies (`TRUST_PROXY`) and from the local Next.js server (loopback), which forwards the dashboard requests with the visitor's IP.

## Frontend structure (`frontend/src/`)

- `app/`: routes. `layout.tsx` (root): fonts and default French SEO metadata only. `app/(site)/`: the public site (route group, URLs unchanged); its layout holds the skip link, header, footer and Meta Pixel. `app/not-found.tsx` brings its own header and footer. `app/admin/`: the dashboard (own layout, see below).
- **Dashboard** (`app/admin/`, components in `components/admin/`, French, mobile first): `/admin/connexion` (login, TanStack Form + `adminLoginSchema`), and in `app/admin/(espace)/` (layout checks the session with the API via `getAdminSession`, else redirect): `/admin` (Tableau de bord), `/admin/commandes` (+ `/[id]`), `/admin/produits` (+ `/nouveau`, `/[id]`), `/admin/livraison`, `/admin/liste-noire`, and "Bientôt disponible" pages (messages, abonnes). `src/proxy.ts` redirects `/admin/*` to the login page when there is no session cookie (optimistic check). Admin pages are noindex (metadata + `X-Robots-Tag` in `next.config.ts`) and never linked from the public site. `next.config.ts` rewrites `/api/admin/*` to the API, so the dashboard calls it on the site's own domain (first-party cookie). Data: `lib/data/admin.ts` (browser, `ApiError` in French, 401 → back to login, a non-JSON 5xx from the Next.js proxy → "Le serveur est injoignable pour le moment.") with TanStack Query (`AdminProviders`). `AdminShell` and the pieces of every page: see "Admin design system". The top bar's right side (`admin-top-bar.tsx`) holds the sound button, the notification bell (red dot while there are unopened new orders; its panel lists the 5 latest, links to the "Nouvelles" tab, offers browser notifications and clears the toasts) and the admin's initial (menu: e-mail, Déconnexion). Toasts appear just under the top bar. Orders list (`orders-page.tsx`): filters, tab and page in the URL (`statut`, `q`, `wilaya`, `du`, `au`, `page`, `par`), "Exporter pour Anderson" (all confirmed) in the header, selected orders exported or marked shipped from the bulk bar. Order detail (`order-detail.tsx`): number, "Reçue le … à …", status pill and "⋯" menu (modifier, export, copy the number, liste noire), Appeler / WhatsApp then only the allowed status changes, then the cards and the history timeline. `LiveOrdersProvider` polls `/orders/updates` every 5 s: toast, short sound (mute button, remembered), counter, browser notification when allowed and the tab is hidden. `AdminDialog` is a bottom sheet on phones. Products (`products-page.tsx`: KPI cards with `KpiCard`, category tabs, search, Statut / Drop / Trier par, table with photo, name + SKU, drop, price, `StockLevel`, `ProductStatusBadge`, edit / duplicate / "⋯" with the stock grid `StockGridDialog`, "Visible sur le site", "Mis en avant", Masquer, Supprimer; filters in the URL `categorie`, `q`, `statut`, `drop`, `tri`, `page`, `par`). Product form: `product-editor.tsx` (loads the product and the fee table for the tier limit) + `product-form.tsx` + `product-photos.tsx` (upload several, drag or arrows to reorder, "Principale", delete). Delivery (`delivery-page.tsx`: KPI cards, region tabs, search, stop desk / statut filters, sort, table with "Non disponible", delay `formatDeliveryWindow` ("24 h" or "Jusqu'à 5 jours"), Actif / Suspendu, edit dialog, "⋯" suspend / reactivate, bulk ± X DA with preview, suspend, reactivate, CSV export, tier warnings). The global search opens the admin product page. Admin URLs: `lib/admin/routes.ts`; formatting (relative dates, Algeria time, WhatsApp confirmation message): `lib/admin/format.ts`.
- `components/ui/`: building blocks: `Button` (filled or outlined, `surface="dark" | "light"`), `SectionLabel`, `SectionTitle`, `ArrowLink`, `HandQuote`, `Container`, `Logo`, `icons.tsx` (thin line SVG icons). Reuse them; do not restyle buttons or labels by hand.
- `components/about/`: the About page sections (`AboutHero`, `AboutStory`, `AboutValues`).
- `components/info/`: the customer info pages (`/livraison`, `/echanges`, `/guide-des-tailles`, `/faq`). `InfoPage` is their shared layout (dark band over concrete with label, title and intro, then the content on bone at reading width), with `InfoSection`, `Prose`, `NumberedSteps`, `InfoNote` and `proseLink`. `DeliveryRates` is the searchable table of the 58 wilayas (data from `getDeliveryRates()` in `lib/data/delivery.ts`, never hard-coded; accent-insensitive search with `matchesSearch` from `lib/search-text.ts`; stacked cards below `md`; delays with `formatDeliveryDelay` from `@rassm/shared`). `FaqAccordion` renders `content/faq.ts` with native `<details>`; `/faq` also outputs FAQPage JSON-LD built from the same content.
- `components/contact/`: the contact page sections (`ContactHero`, `ContactChannels`, `FaqBand`, `BrandLocation`) and `ContactForm`. `components/ui/form-field.tsx`: `FormField` (label, control, hint, French error; `labelStyle="caps" | "plain"`), `inputClasses` and `describedBy`, shared by the order and contact forms.
- `components/layout/`: `SiteHeader` (transparent over the hero on `/`, dark band elsewhere, full-screen menu below `lg`), `SiteFooter`, `NewsletterForm` (TanStack Form + `newsletterFormSchema`, `revalidateLogic`).
- `components/home/`, `components/collection/`, `components/product/`: page sections, `ProductCard` / `ProductListItem` (the whole card links to the product page, no "+" button), product gallery, quantity stepper, size guide dialog.
- `components/product/order/`: the product page order. `ProductOrderProvider` owns the TanStack Form (`productOrderFormSchema`, `revalidateLogic`) and shares it through context with `ProductOptions` (color, size, quantity), `ProductOrderGallery` (photos of the selected color), `OrderForm` + `OrderSummary`, and `StickyOrderButton` (mobile only: "Commander maintenant" fixed at the bottom, scrolls to the form, hidden once the form is on screen). The provider also sends ViewContent and InitiateCheckout.
- `app/merci/` + `components/order/OrderReceived`: thank-you page (`/merci`, no query string, noindex): "Merci, votre commande est bien reçue. Nous vous appellerons très bientôt pour la confirmer.", the order summary, link to the collection. It reads the last order saved on the device (`getLastOrder`). Sends Purchase.
- French tier texts come from `formatDeliveryDiscountTiers` / `formatTierBenefit` / `formatDiscount` / `formatNextTierMessage`.
- **Collection filters live in the URL** (`?category=hoodie,tshirt&color=noir&size=M&min=5000&max=8000&sort=price-asc&view=list`). Pure logic in `lib/collection-filters.ts` (parse, serialize, facets, filter and sort, tested). The page updates the URL with `window.history.replaceState` (no server round trip) and reads it with `useSearchParams`; the page awaits `searchParams`, so a shared link is server-rendered already filtered.
- `SiteHeader` floats over the photo on `/`, `/collection`, `/a-propos`, `/contact` and the info pages (`HEADER_OVER_HERO`). It has no search icon for now (see `docs/TODO.md`), and uses the narrow width on `/collection/*`. `Container size="narrow"` is the shop page width (design/Collection.png).
- `content/`: editorial content that is not API data: `hero-slides.ts` (add a slide = add one entry), `navigation.ts` (menu, footer columns, social links), `contact.ts` (WhatsApp, phone and social links, the single source for them), `size-guide.ts` (placeholder measurements, see `docs/TODO.md`; shown by `SizeGuideTable`, used by both the product page dialog and `/guide-des-tailles`), `faq.ts` (questions and answers, links built from `routes` and `CONTACT`).
- `lib/data/`: the data layer, calling the API through `lib/api.ts` (`apiGet`: server-side fetch cached `revalidate` seconds, 30 s for products, 5 min for delivery fees; `apiPost`: browser POST throwing an `ApiError` with the French message and `fields`). `orders.ts`: `placeProductOrder(order, { website, tracking })` posts `orderRequestSchema` (the customer's choices only, never a price) and keeps the answer (`PlacedOrder`) in sessionStorage; `getLastOrder` reads it back for `/merci`. Server errors with `fields` are shown under the matching form field (`toServerErrors` in `lib/form-errors.ts`, set with `form.setErrorMap({ onDynamic })`), e.g. a variant sold out since the page loaded. The order and contact forms have a hidden honeypot field (`components/ui/honeypot-field.tsx`). `lib/routes.ts`: every internal URL (every route in it exists: never link to a page that is not built). `lib/cn.ts`: class name helper.
- Images live in `frontend/public/images/<section>/`. Placeholders and the photos still needed are listed in `docs/PHOTOS-NEEDED.md`; other open items in `docs/TODO.md`.
- Product packshots are square on cream and shown with `object-contain` in 5:4 tiles. After replacing an image with the same file name, delete `frontend/.next` if the dev server still shows the old one (image cache).
- The only English text on the site is the footer tagline next to the logo (`lang="en"`). The homepage story photos (`images/story/`) have English quotes painted on the wall: their alt texts give the quote in French; replace the photos to remove the English.
- **Meta Pixel** (`lib/analytics/meta-pixel.ts`): loaded only when `NEXT_PUBLIC_META_PIXEL_ID` is set (otherwise no Meta script at all). Always go through `trackMetaEvent` / `trackPurchaseOnce`. Events: PageView on every page (`MetaPixelPageView` in the root layout), ViewContent on product pages (id, name, price), InitiateCheckout on the first focus in the order form, Purchase on `/merci` (value = order total, `eventID` = the `eventId` returned by the API, once per order, remembered in localStorage). The API sends the same Purchase server-side (Conversions API) with the same event id, so Meta counts it once. The order form sends the `_fbp` / `_fbc` cookies and the page URL with the order (`getMetaTracking`; without `_fbc`, fbc is built from `?fbclid=`). Currency `DZD` (`PIXEL_CURRENCY`), kept on purpose: DZD is a supported Meta ad account currency, even though the Pixel script logs a currency warning on Purchase. Duplicate calls caused by React Strict Mode in development are dropped.
- Animations respect `prefers-reduced-motion` (`motion-safe:` / `motion-reduce:` classes; the hero slider does not auto-play).

## Code rules

- TypeScript `strict` everywhere. **No `any`** (lint error). Prefer types inferred from Zod schemas.
- Small, reusable components. Shared UI goes in `frontend/src/components/`, not copy-pasted.
- **Data access only through `frontend/src/lib/data/`** (`getFeaturedProducts`, `getCategoryCards`, `subscribeToNewsletter`…). Components and pages never call `fetch` or import `@rassm/shared/mocks`: only `lib/data/` talks to the API.
- **Mobile first:** write base styles for 375px, then add `md:` / `lg:` overrides.
- Secrets and URLs go in env variables. Every app with env vars has a committed `.env.example`. Never commit `.env*` files.
- Use the `@/` alias for imports inside `frontend/src`.
- Prettier formats code (Tailwind classes are auto-sorted). ESLint runs with the shared config.

## Definition of Done (every task)

1. Run `pnpm typecheck`, `pnpm lint` and `pnpm test` from the root and fix all errors in every workspace.
2. Run the app (`pnpm dev`) and check there are **no terminal or browser console errors**.
3. For UI work: compare the result with `design/Homepage.png` at **375px, 768px and 1440px** widths. Headless Chrome cannot go below ~500px, so check 500px automatically and let the user check 375px.
4. End with a short summary: what was done, and what the user needs to do or decide.
