# Photos needed

Placeholders are dark or cream images with their file name printed on them. Replace each file in `frontend/public/` with the real photo, **keeping exactly the same name and format** (`.jpg`), and the site picks it up with no code change.

## Shared art direction

- **Black & white**, slightly warm (no pure blue-grey). High contrast, deep blacks, soft natural light.
- **Brutalist concrete**: raw concrete walls, columns, stairs, underpasses. No colourful or busy backgrounds.
- **Mood**: quiet, introspective, editorial. Faces often turned away, looking down, or half hidden by hair or hood.
- The **sketch prints** on the garments must be clearly visible when the shot is about a product.
- Keep the subject away from the very edges: the site crops photos differently on mobile and desktop.
- Export as **JPEG, quality 80–85, sRGB**, at the size below or larger with the same ratio. Next.js resizes and converts them automatically.

## Hero (`frontend/public/images/hero/`)

Already provided: `hero-1.jpg` and `hero-2.jpg` (1672 × 941).

| File                                  | Used in           | Recommended size                 | Notes                                                                                                                                                        |
| ------------------------------------- | ----------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `hero-1.jpg`, `hero-2.jpg` (provided) | Home, hero slider | **2400 × 1350** (16:9) or larger | The current files work, but on phones the tall crop enlarges them and they look soft. A larger export (at least 1350 px tall) would be sharper.              |
| `hero-3.jpg` (optional)               | Home, hero slider | 2400 × 1350, landscape           | Person on the **right half**, face in the upper third, empty concrete on the left for the text. Then add one entry in `frontend/src/content/hero-slides.ts`. |

## Collection page (`frontend/public/images/collection/`)

Provided: `collection-hero.jpg`, `drop-banner.jpg` and the three category photos.

## Contact page (`frontend/public/images/contact/`) — placeholders

| File                         | Used in                                                      | Recommended size          | Description of the shot                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contact-hero.jpg`           | /contact, photo banner behind "Let's talk."                  | **2400 × 900**, landscape | Model in a black RASSM hoodie seen from below, **on the centre-right**, brutalist concrete behind (see design/Contact.png). Keep the **left third dark** for the text and the **far right calm** for the handwritten quote.                                                                                               |
| `contact-side.jpg`           | /contact, tall photo next to "Autres moyens de nous joindre" | **900 × 1300**, portrait  | Model **from behind** climbing concrete stairs, the back print of the hoodie visible.                                                                                                                                                                                                                                     |
| `algeria-map.jpg`            | /contact, "Une marque algérienne." (right half)              | **1600 × 800**, landscape | **Stylized map of Algeria** on a near-black background (thin grey lines or dotted texture, a few light points for cities), in the spirit of the world map in design/Contact.png. Keep the **right quarter empty** for "Art connects us everywhere." Use an accurate map source; it must not be drawn by hand from memory. |
| `contact-faq.jpg` (optional) | /contact, "Besoin d'une réponse rapide ?" band               | **2400 × 500**, very wide | Dark raw concrete wall, no person. Today the band is a plain dark gradient; with this photo it can match the design (ask to wire it in).                                                                                                                                                                                  |

## Products (`frontend/public/images/products/`)

Packshots **on a plain cream background** (close to `#E8E4DC`), square (1200 × 1200 or larger), garment centred, same scale for every product, named `<product-slug>-front.jpg` and `<product-slug>-back.jpg`.

- Provided: the front photo of every product except Canvas Hoodie, and `sketch-hoodie-back.jpg`.
- Still needed: `canvas-hoodie-front.jpg` and `canvas-hoodie-back.jpg` (placeholders today), and the back photos of the other products (optional: add `"back"` to the product in `shared/src/mocks/products.ts` once the file exists).
- A color with its own photos (e.g. Classic Tee Crème) can get its own `images` list on that color.

## Social sharing (`frontend/public/images/og/`)

| File          | Used in                                                                    | Recommended size      | Description                                                                                                 |
| ------------- | -------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------- |
| `og-home.jpg` | Preview image when the site is shared (WhatsApp, Facebook, Instagram DMs…) | **1200 × 630**, exact | A strong hero photo with "RASSM" and "Draw what you can't say." on the left. Keep text away from the edges. |
