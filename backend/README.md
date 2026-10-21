# @rassm/backend

The RASSM API: Express 5 + TypeScript, MongoDB (Atlas) with Mongoose. Every request body
is validated with the Zod schemas of `@rassm/shared`, the same ones the website forms use.
Customer-facing errors are French; logs and code are English.

## Run

From the repository root:

```bash
pnpm install
cp backend/.env.example backend/.env   # then fill in MONGODB_URI (see below)
pnpm seed                              # products + Anderson delivery fees
pnpm dev                               # website on :3000 and API on :4000
```

`pnpm dev` (root) starts both apps. To start the API alone: `pnpm --filter @rassm/backend dev`
(hot reload with `tsx watch`). In production: `pnpm --filter @rassm/backend start`.

## Environment variables (`backend/.env`)

Validated at startup (`src/env.ts`): the API refuses to start and lists what is wrong.

| Variable                                                               | Required | Example / default                                                                         |
| ---------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| `MONGODB_URI`                                                          | yes      | `mongodb+srv://user:pass@cluster0.xxx.mongodb.net/rassm`                                  |
| `MONGODB_DB_NAME`                                                      | no       | `rassm` (database inside the cluster)                                                     |
| `DNS_FALLBACK_SERVERS`                                                 | no       | `1.1.1.1,8.8.8.8` (Atlas lookup when this computer's DNS refuses it; empty = none)        |
| `FRONTEND_ORIGIN`                                                      | yes      | `http://localhost:3000` (comma-separated list)                                            |
| `PORT`                                                                 | no       | `4000`                                                                                    |
| `TRUST_PROXY`                                                          | no       | `0`; set to the number of proxies of the host (often `1`) so the real client IP is used   |
| `META_PIXEL_ID`                                                        | no       | Same ID as `NEXT_PUBLIC_META_PIXEL_ID`                                                    |
| `META_CAPI_ACCESS_TOKEN`                                               | no       | Events Manager > Pixel > Settings > Conversions API                                       |
| `META_TEST_EVENT_CODE`                                                 | no       | Events Manager "Test events" code                                                         |
| `META_GRAPH_API_VERSION`                                               | no       | `v23.0`                                                                                   |
| `BREVO_API_KEY`                                                        | no       | Brevo > SMTP & API > API keys (empty = no e-mail)                                         |
| `BREVO_NEWSLETTER_LIST_ID`                                             | no       | Brevo > Contacts > Lists: the list ID (empty = subscribers stay on the site)              |
| `NOTIFY_EMAIL`                                                         | no       | `rassmwear@gmail.com`                                                                     |
| `EMAIL_FROM`                                                           | no       | `rassmwear@gmail.com` (validated sender in Brevo)                                         |
| `ADMIN_URL`                                                            | no       | `http://localhost:3000/admin`                                                             |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | no       | Cloudinary > Settings > API Keys (empty = photo uploads off). The secret stays on the API |
| `CLOUDINARY_FOLDER`                                                    | no       | `rassm/products`                                                                          |
| `REVALIDATE_SECRET`                                                    | no       | Same 24+ character value as the frontend `REVALIDATE_SECRET` (empty = no instant refresh) |
| `BACKUP_DIR` / `BACKUP_KEEP`                                           | no       | `backups` (relative to `backend/`) / `14` backups kept                                    |
| `BACKUP_PASSPHRASE`                                                    | no       | 16+ characters: encrypts `pnpm backup` files (needed to restore them)                     |
| `REVALIDATE_URL`                                                       | no       | Default: first `FRONTEND_ORIGIN` + `/api/revalidate`                                      |

Never commit `.env`. On MongoDB Atlas, allow the IP address of the server (or of your
computer in development) in **Network Access**.

**`querySrv ECONNREFUSED` at startup** (the dashboard then says "Le serveur est injoignable"):
Node could not look up the Atlas address with this computer's DNS, which some VPNs (e.g. HMA)
point to `127.0.0.1`. The API then retries the lookup with `DNS_FALLBACK_SERVERS` and logs a
warning; if it still fails, disconnect the VPN or fix the DNS of the network adapter. Database
outages after startup are answered with a French 503, never a generic error.

## Seed

`pnpm seed` loads the catalog and the 58 Anderson delivery fees from `@rassm/shared/mocks`
and creates the indexes. It is safe to re-run: missing products are created, existing
products are left as they are (real stock is kept), missing wilayas are added and existing
delivery prices are kept (they are edited in the dashboard). Products without a SKU get one.
`pnpm seed --reset` overwrites the existing products (stock included) and the delivery prices
with the mock values.

## API

| Route                        | What it does                                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/products`          | Products on sale; same filters as the collection page (`?category=hoodie&color=noir&size=M&min=5000&max=8000&sort=price-asc`) |
| `GET /api/products/:slug`    | One product, or 404                                                                                                           |
| `GET /api/delivery-fees`     | The 58 wilayas with home / stop desk prices and delays                                                                        |
| `POST /api/orders`           | Places an order (body: `orderRequestSchema`)                                                                                  |
| `POST /api/contact-messages` | Saves a contact message (body: `contactRequestSchema`)                                                                        |
| `POST /api/newsletter`       | Signs up an email (one entry per email)                                                                                       |
| `GET /health`                | `{ ok: true }`                                                                                                                |
| `/api/admin/*`               | Dashboard API (session cookie required except login), see below                                                               |

Errors: `{ "error": { "message": "…", "fields": { "size": "…" } } }`, French.

### Orders

The API loads the product and the delivery fees from the database and recomputes
everything with the shared helpers (price, delivery fee, discount tiers, total): prices sent
by the client are ignored. The stock of the ordered color + size is decremented with one
conditional update, so two simultaneous orders cannot sell the same last unit. New orders
are `pending` (reçue): they are confirmed only after the confirmation phone call. The
internal order number (`RSM-000123`) is never sent to the browser; the answer contains the
order summary and an `eventId` (the order id) used as the Meta event id.

Fake orders: rate limit per IP, hidden honeypot field (`website`: when filled, the API
answers as usual and saves nothing), duplicates (same phone + same product within 30 min
return the first order), and a `suspicious` flag with a French reason (3+ orders from the
same phone or 5+ from the same IP in 24 h), for the dashboard.

### Meta Conversions API

With `META_PIXEL_ID` and `META_CAPI_ACCESS_TOKEN` set, each new order sends a server-side
Purchase (same event id as the browser Pixel, hashed phone / name / city, country, IP, user
agent, fbp/fbc cookies, value in DZD) in the background. A Meta failure is logged and
stored on the order (`metaPurchase.status`), never blocking the order.

## Dashboard (admin)

Create the first admin (asks the e-mail and the password in the terminal, nothing is stored in code):

```bash
pnpm create-admin
```

Run it again with the same e-mail to set a new password (the open sessions are closed and a login
lock is lifted). Passwords: 12 characters minimum, not containing "rassm", not a common password;
hashed with argon2id. Log in at
`/admin/connexion` on the website. The dashboard calls `/api/admin/*` on the website's domain
(Next.js rewrites it to the API), with an httpOnly SameSite=Strict session cookie (Secure in production).
Five wrong passwords in a row lock the account and the IP for 15 minutes, doubled at each new lock
(up to 24 hours). "Mot de passe oublié ?" sends a single-use link valid 30 minutes (Brevo), which
also works while the account is locked. Without "Se souvenir de moi" a session lasts 12 hours (2 hours
without activity); with it, 30 days. The admin gets an e-mail alert for a login from a new browser, a
password change or reset, and a lock. Sessions are listed and revoked in Paramètres > Sécurité.

| Route                                                                                                        | What it does                                                                                                 |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `POST /api/admin/auth/login` / `logout`                                                                      | Session cookie in / out (`remember`: 30 days)                                                                |
| `POST /api/admin/auth/password/forgot` / `reset`                                                             | Reset link by e-mail (neutral answer), new password with the link                                            |
| `GET /api/admin/security/sessions`, `DELETE …/sessions/:id`, `DELETE …/sessions/others`                      | Open sessions, revoke one or all the others                                                                  |
| `POST /api/admin/security/password`                                                                          | Change the password (current one required; other sessions logged out)                                        |
| `GET /api/admin/auth/me`                                                                                     | The logged-in admin                                                                                          |
| `GET /api/admin/search?q=`                                                                                   | Top bar search: orders (name, phone, order number) and products                                              |
| `GET /api/admin/orders`                                                                                      | List: `status` tab, `q` (name, phone or "RSM-000123"), `wilaya`, `from`, `to`, `page` (or `cursor`), `limit` |
| `GET /api/admin/orders/updates?since=`                                                                       | New orders since the last poll (live dashboard)                                                              |
| `GET /api/admin/orders/:id`                                                                                  | One order (marks it opened) and its product                                                                  |
| `PATCH /api/admin/orders/:id`                                                                                | Edit before shipping (totals and stock recomputed)                                                           |
| `POST /api/admin/orders/:id/status`                                                                          | Allowed status changes only; stock given back once                                                           |
| `PUT /api/admin/orders/:id/note`                                                                             | Internal note                                                                                                |
| `POST /api/admin/orders/:id/blacklist`                                                                       | Blacklist the order's phone                                                                                  |
| `POST /api/admin/orders/export`                                                                              | Anderson CSV of confirmed orders (`ids` or `all`)                                                            |
| `POST /api/admin/orders/ship`                                                                                | Mark exported orders as shipped                                                                              |
| `GET/POST /api/admin/blacklist`, `DELETE /api/admin/blacklist/:phone`                                        | Blacklist                                                                                                    |
| `GET/POST /api/admin/products`                                                                               | Products list (filters, tab counts, KPIs) / create (SKU and id made by the API)                              |
| `GET/PUT/DELETE /api/admin/products/:id`                                                                     | One product (+ `updatedAt` for the save) / edit / delete (refused with orders: hide it)                      |
| `PATCH /api/admin/products/:id/stock`, `/flags`; `POST /api/admin/products/:id/duplicate`                    | Stock grid; visible / featured; hidden copy with stock 0                                                     |
| `POST/DELETE /api/admin/uploads`                                                                             | One product photo to Cloudinary (field `image`, JPG/PNG/WebP, 8 MB) / delete an unused one                   |
| `GET /api/admin/delivery-fees`, `PUT /api/admin/delivery-fees/:code`, `POST /api/admin/delivery-fees/bulk`   | Delivery prices, stop desk, suspension; bulk ± X DA / suspend / reactivate; `?apercu=1` previews             |
| `GET /api/admin/settings`, `PUT /api/admin/settings`                                                         | Dashboard settings: "Stock faible" threshold (total units, default 10)                                       |
| `GET /api/admin/stats?from=&to=`                                                                             | Tableau de bord: KPIs with trends, sales chart, statuses, latest orders, best sellers, performance, ads      |
| `GET/POST /api/admin/ads`, `PUT/DELETE /api/admin/ads/:id`                                                   | Ads spend entries (spread per day) and the figures of a period                                               |
| `GET /api/admin/clients`, `/clients/export`, `/clients/:phone`                                               | Clients grouped by phone, badges, CSV, detail                                                                |
| `GET /api/admin/messages`, `GET/PATCH/DELETE /api/admin/messages/:id`                                        | Contact messages: folders, read / archive, delete                                                            |
| `GET /api/admin/subscribers`, `/subscribers/export`, `POST /subscribers/:id/sync`, `DELETE /subscribers/:id` | Newsletter subscribers, CSV, Brevo retry, delete                                                             |

### Product photos (Cloudinary) and instant page refresh

With the three Cloudinary variables set, the dashboard uploads photos through the API (signed:
the secret never reaches the browser). They are checked (JPG, PNG or WebP from the file's bytes,
8 MB), stored resized to 2 000 px as compressed WebP, and deleted from Cloudinary once no product
and no order uses them. `pnpm migrate-images` moves the photos still in
`frontend/public/images/products` to Cloudinary and updates the products (safe to re-run).

With `REVALIDATE_SECRET` set (same value in the frontend), every product or delivery change asks
the website (`POST /api/revalidate`) to refresh its pages at once.

### Team e-mails and newsletter (Brevo)

With `BREVO_API_KEY` set, each real new order (not a honeypot or a duplicate) and each new contact
message sends a French e-mail to `NOTIFY_EMAIL` from `EMAIL_FROM` (a sender validated in Brevo), with
a link to the order or the message (`ADMIN_URL`). Sent in the background: a Brevo failure is logged
and never blocks the order or the message.

With `BREVO_NEWSLETTER_LIST_ID` set too, every newsletter sign-up is added to that Brevo list in the
background, and deleting a subscriber in the dashboard removes it from the list (the status of each
subscriber is shown in "Abonnés", with "Réessayer"). `pnpm sync-newsletter` adds the subscribers
not yet in the list (safe to re-run). Newsletters are written and sent from Brevo.

### Statistics

The Tableau de bord and Publicité figures are MongoDB aggregations over the orders (by order date,
Algeria time), the products and the ads spend; see "Statistics, profit and ads" in CLAUDE.md for
every formula. Cost prices are copied on each order when it is placed, packaging and return costs
when it becomes delivered or returned, so later changes never rewrite past profit.

## Security and backups

With `NODE_ENV=production` the API refuses to start with weak or example secrets, or non-https
URLs. Every dashboard change needs the site's `Origin` and the session's `X-CSRF-Token`. `pnpm backup`
saves the database (compressed, encrypted with `BACKUP_PASSPHRASE`); `pnpm restore -- <file>`
restores it. Details, secret rotation and the backup schedule: [`docs/SECURITY.md`](../docs/SECURITY.md).

## Tests

```bash
pnpm --filter @rassm/backend test
```

Vitest + Supertest against an in-memory MongoDB (`mongodb-memory-server`; the MongoDB
binary, about 800 MB, is downloaded on the first run). Meta is mocked.
