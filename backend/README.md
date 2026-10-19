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

| Variable                 | Required | Example / default                                                                       |
| ------------------------ | -------- | --------------------------------------------------------------------------------------- |
| `MONGODB_URI`            | yes      | `mongodb+srv://user:pass@cluster0.xxx.mongodb.net/rassm`                                |
| `MONGODB_DB_NAME`        | no       | `rassm` (database inside the cluster)                                                   |
| `FRONTEND_ORIGIN`        | yes      | `http://localhost:3000` (comma-separated list)                                          |
| `PORT`                   | no       | `4000`                                                                                  |
| `TRUST_PROXY`            | no       | `0`; set to the number of proxies of the host (often `1`) so the real client IP is used |
| `META_PIXEL_ID`          | no       | Same ID as `NEXT_PUBLIC_META_PIXEL_ID`                                                  |
| `META_CAPI_ACCESS_TOKEN` | no       | Events Manager > Pixel > Settings > Conversions API                                     |
| `META_TEST_EVENT_CODE`   | no       | Events Manager "Test events" code                                                       |
| `META_GRAPH_API_VERSION` | no       | `v23.0`                                                                                 |

Never commit `.env`. On MongoDB Atlas, allow the IP address of the server (or of your
computer in development) in **Network Access**.

## Seed

`pnpm seed` loads the catalog and the 58 Anderson delivery fees from `@rassm/shared/mocks`
and creates the indexes. It is safe to re-run: missing products are created, existing
products are left as they are (real stock is kept), delivery fees are updated.
`pnpm seed --reset` overwrites the existing products (stock included) with the mock values.

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

## Tests

```bash
pnpm --filter @rassm/backend test
```

Vitest + Supertest against an in-memory MongoDB (`mongodb-memory-server`; the MongoDB
binary, about 800 MB, is downloaded on the first run). Meta is mocked.
