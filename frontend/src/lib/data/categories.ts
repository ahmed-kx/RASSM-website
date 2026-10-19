import { CATEGORIES, CATEGORY_LABELS, type Category } from "@rassm/shared";
import { routes } from "@/lib/routes";

export interface CategoryCard {
  category: Category;
  label: string;
  href: string;
  image: string;
  imageAlt: string;
}

const CATEGORY_IMAGES: Record<Category, { image: string; imageAlt: string }> = {
  hoodie: {
    image: "/images/collection/category-hoodies.jpg",
    imageAlt:
      "Hoodie noir RASSM vu de dos, avec un imprimé graphique clair, porté dans un espace en béton éclairé par le soleil",
  },
  sweatshirt: {
    image: "/images/collection/category-sweatshirts.jpg",
    imageAlt:
      "Sweatshirt noir RASSM vu de dos, avec un grand imprimé noir et blanc, porté devant des structures en béton",
  },
  tshirt: {
    image: "/images/collection/category-tshirts.jpg",
    imageAlt:
      "T-shirt crème oversize RASSM vu de dos, avec un imprimé géométrique noir, porté devant un bâtiment en béton",
  },
};

export async function getCategoryCards(): Promise<CategoryCard[]> {
  return CATEGORIES.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    href: routes.category(category),
    ...CATEGORY_IMAGES[category],
  }));
}
