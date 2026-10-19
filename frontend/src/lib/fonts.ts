import { Cormorant_Garamond, Covered_By_Your_Grace, Spectral } from "next/font/google";

/** High-contrast display serif: logo and headings. */
export const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

/** Clean text serif: body copy and uppercase tracked labels. */
export const bodyFont = Spectral({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-spectral",
  display: "swap",
});

/** Handwritten marker: side quotes only ("Certaines choses vivent mieux dans l'art."). */
export const handFont = Covered_By_Your_Grace({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-covered",
  display: "swap",
});
