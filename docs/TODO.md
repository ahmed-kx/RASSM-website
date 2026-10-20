# To do

Things that are placeholders or decisions still to make. Remove an item once it is done.

## Content to replace

- [ ] **Size guide measurements** (`frontend/src/content/size-guide.ts`, marked `TO REPLACE`). The values are placeholders for an oversized fit, not real RASSM measurements. Ideally one table per garment type (hoodie, sweatshirt, t-shirt).
- [ ] **Photos**: see `docs/PHOTOS-NEEDED.md`.

## Setup

- [ ] **Meta Pixel ID**: set `NEXT_PUBLIC_META_PIXEL_ID` in `frontend/.env.local` (and in the hosting environment). Without it, no Meta script is loaded.

- [ ] **Meta Conversions API**: set `META_PIXEL_ID` and `META_CAPI_ACCESS_TOKEN` in `backend/.env` (and on the API host). Check the events in Events Manager > Test events (`META_TEST_EVENT_CODE`).
- [ ] **Hosting the API**: set `FRONTEND_ORIGIN` to the real domain(s), `TRUST_PROXY` to the number of proxies of the host, `NEXT_PUBLIC_API_URL` in the frontend, and allow the server IP in MongoDB Atlas Network Access.

- [ ] **Brevo**: paste `BREVO_API_KEY` in `backend/.env` (and on the API host). Later, send from your own domain: validate it in Brevo (Senders, domains) and change `EMAIL_FROM`.
- [ ] **Dashboard in production**: set `ADMIN_URL` (e-mail links) to the real `https://…/admin`.
- [ ] **Cloudinary and page refresh in production**: set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` on the API host, and the same long `REVALIDATE_SECRET` on both hosts (`REVALIDATE_URL` = `https://<site>/api/revalidate` if the first `FRONTEND_ORIGIN` is not the site). Optional: `CLOUDINARY_CLOUD_NAME` in the frontend so next/image only accepts this account's photos.

## Dashboard

- [ ] **Costs for the profit**: fill the "Prix de revient" of every product (Produits > edit) and the packaging and return costs (Paramètres). Orders placed before a product had a cost price show as "coût manquant" (their profit counts no product cost).
- [ ] **Ads spend**: enter the Meta Ads spend in Publicité (by day or by period) so the profit, cost per order and ROAS are right.
- [ ] **Newsletter**: paste `BREVO_NEWSLETTER_LIST_ID` in `backend/.env` (and on the API host), then run `pnpm sync-newsletter` once for the existing subscribers.
- [ ] Photos uploaded in the product form and abandoned by closing the browser tab before saving stay in Cloudinary (leaving the page in the dashboard deletes them). Clean them from the Cloudinary media library from time to time, or add a cleanup job later.
- [ ] Renaming a color of a product that has pending orders: their stock is given back to the color name they were ordered in. Rename only colors without open orders (or add the units by hand).
- [ ] Phone notifications when the dashboard is closed: needs the dashboard as an installable app (PWA + Web Push). Today: live toast and sound while it is open, browser notifications on computers.

## Later

- [ ] Search: add a search page and the header search icon back once the catalogue is bigger (removed for now, only 9 products).
- [ ] Lookbook page: add back later when we have a photoshoot (photos linking to the products worn).
