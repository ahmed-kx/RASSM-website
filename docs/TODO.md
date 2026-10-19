# To do

Things that are placeholders or decisions still to make. Remove an item once it is done.

## Content to replace

- [ ] **Size guide measurements** (`frontend/src/content/size-guide.ts`, marked `TO REPLACE`). The values are placeholders for an oversized fit, not real RASSM measurements. Ideally one table per garment type (hoodie, sweatshirt, t-shirt).
- [ ] **Exchange policy.** The product page says "Échange possible". Decide the conditions (delay, state of the item, who pays the return) and write the "Retours & échanges" page.
- [ ] **Photos**: see `docs/PHOTOS-NEEDED.md`.

## Setup

- [ ] **Meta Pixel ID**: set `NEXT_PUBLIC_META_PIXEL_ID` in `frontend/.env.local` (and in the hosting environment). Without it, no Meta script is loaded.

## Pages linked but not built yet

- [ ] `/recherche`, `/lookbook`, `/a-propos`, `/contact`, `/livraison`, `/retours-et-echanges`, `/guide-des-tailles`, `/faq`. They show the French 404 page for now.
