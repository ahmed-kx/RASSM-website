import localFont from "next/font/local";

// The fonts are self-hosted (src/fonts/, Latin subset, from Fontsource 5.3.0, SIL Open Font
// License: see the LICENSE-*.txt files there), so a build never depends on Google Fonts being
// reachable, and visitors never call Google. Next.js serves them from the site with a
// size-adjusted fallback while they load.

/** High-contrast display serif: logo and headings. */
export const displayFont = localFont({
  src: [
    { path: "../fonts/cormorant-garamond-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/cormorant-garamond-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/cormorant-garamond-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/cormorant-garamond-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-cormorant",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

/** Clean text serif: body copy and uppercase tracked labels. */
export const bodyFont = localFont({
  src: [
    { path: "../fonts/spectral-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "../fonts/spectral-latin-300-italic.woff2", weight: "300", style: "italic" },
    { path: "../fonts/spectral-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/spectral-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "../fonts/spectral-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/spectral-latin-500-italic.woff2", weight: "500", style: "italic" },
    { path: "../fonts/spectral-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/spectral-latin-600-italic.woff2", weight: "600", style: "italic" },
  ],
  variable: "--font-spectral",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

/** Handwritten marker: side quotes only ("Certaines choses vivent mieux dans l'art."). */
export const handFont = localFont({
  src: "../fonts/covered-by-your-grace-latin-400-normal.woff2",
  weight: "400",
  style: "normal",
  variable: "--font-covered",
  display: "swap",
});

/**
 * Light geometric sans: only the admin login pages (design/admin-login.png: subline, inputs,
 * small links and labels). Applied by AuthShell, so the public site never loads it.
 */
export const authSansFont = localFont({
  src: [
    { path: "../fonts/montserrat-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "../fonts/montserrat-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/montserrat-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-montserrat",
  display: "swap",
  adjustFontFallback: "Arial",
});
