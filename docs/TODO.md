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

## Dashboard, next step

- [ ] Tableau de bord (statistics, including delivery discounts given and free-delivery orders), Produits (with the tier editor), Livraison (fees), Messages (contact), Abonnés (newsletter): today "Bientôt disponible".
- [ ] Phone notifications when the dashboard is closed: needs the dashboard as an installable app (PWA + Web Push). Today: live toast and sound while it is open, browser notifications on computers.

## Later

- [ ] Search: add a search page and the header search icon back once the catalogue is bigger (removed for now, only 9 products).
- [ ] Lookbook page: add back later when we have a photoshoot (photos linking to the products worn).
