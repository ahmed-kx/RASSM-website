# Photos needed

Every photo on the site except the hero is a **placeholder** for now: a grey or cream image with its file name printed on it. Replace each file in `frontend/public/` with the real photo, **keeping exactly the same name and format** (`.jpg`), and the site picks it up with no code change.

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

| File                  | Used in                                               | Recommended size               | Description of the shot                                                                                                                                                                                            |
| --------------------- | ----------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `collection-hero.jpg` | /collection, photo banner behind "Wear your silence." | **2400 × 900**, wide landscape | Model in a black RASSM hoodie, **on the right half**, looking down or away, brutalist concrete behind. Keep the **left half calm and dark** for the text. On mobile the photo is cropped around 70% from the left. |
| `drop-banner.jpg`     | /collection, "New Drop 001" banner under the grid     | **1800 × 800**, landscape      | Model in a black hoodie **sitting on concrete steps**, head down, moody light. Keep the **top-left corner dark** for "RASSM / New Drop 001".                                                                       |

## Products (`frontend/public/images/products/`)

Packshots, one front and one back view per product, **on a plain cream background** (close to `#E8E4DC`), garment flat or on an invisible mannequin, centred, same scale for every product.

| File                                                            | Product                                                | Recommended size    |
| --------------------------------------------------------------- | ------------------------------------------------------ | ------------------- |
| `signature-hoodie-front.jpg`, `signature-hoodie-back.jpg`       | Signature Hoodie (black, small chest logo)             | 1200 × 1200, square |
| `sketch-hoodie-front.jpg`, `sketch-hoodie-back.jpg`             | Sketch Hoodie (cream, sketch on the back)              | 1200 × 1200, square |
| `fragment-sweatshirt-front.jpg`, `fragment-sweatshirt-back.jpg` | Fragment Sweatshirt (black, fragmented portrait)       | 1200 × 1200, square |
| `unspoken-tee-front.jpg`, `unspoken-tee-back.jpg`               | Unspoken Tee (cream, face sketch)                      | 1200 × 1200, square |
| `classic-tee-front.jpg`, `classic-tee-back.jpg`                 | Classic Tee (black, RASSM wordmark)                    | 1200 × 1200, square |
| `silence-hoodie-front.jpg`, `silence-hoodie-back.jpg`           | Silence Hoodie (black, back print)                     | 1200 × 1200, square |
| `echo-sweatshirt-front.jpg`, `echo-sweatshirt-back.jpg`         | Echo Sweatshirt (cream, ink strokes)                   | 1200 × 1200, square |
| `inner-voice-tee-front.jpg`, `inner-voice-tee-back.jpg`         | Inner Voice Tee (black, handwritten quote on the back) | 1200 × 1200, square |
| `canvas-hoodie-front.jpg`, `canvas-hoodie-back.jpg`             | Canvas Hoodie (washed charcoal, layered sketches)      | 1200 × 1200, square |

The home page shows the **front** view of the 5 featured products. The back views are for the product page (later step).

## Social sharing (`frontend/public/images/og/`)

| File          | Used in                                                                    | Recommended size      | Description                                                                                                 |
| ------------- | -------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------- |
| `og-home.jpg` | Preview image when the site is shared (WhatsApp, Facebook, Instagram DMs…) | **1200 × 630**, exact | A strong hero photo with "RASSM" and "Draw what you can't say." on the left. Keep text away from the edges. |
