export interface HeroSlide {
  id: string;
  image: string;
  alt: string;
  /**
   * CSS object-position per breakpoint, so the face is never cut.
   * Mobile is a tall crop of a wide photo: centre it on the face.
   */
  position: { mobile: string; desktop: string };
}

/**
 * Hero slides, in order. To add a slide, drop the photo in
 * public/images/hero/ and add one entry here.
 */
export const HERO_SLIDES: readonly HeroSlide[] = [
  {
    id: "hero-1",
    image: "/images/hero/hero-1.jpg",
    alt: "Jeune homme aux cheveux bouclés en hoodie noir RASSM, devant un bâtiment en béton brut",
    position: { mobile: "63% 30%", desktop: "center 25%" },
  },
  {
    id: "hero-2",
    image: "/images/hero/hero-2.jpg",
    alt: "Jeune homme en hoodie noir RASSM assis sur des marches en béton",
    position: { mobile: "48% 30%", desktop: "center 30%" },
  },
];
