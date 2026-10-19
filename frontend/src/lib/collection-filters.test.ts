import { mockProducts } from "@rassm/shared/mocks";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  colorKey,
  filterAndSortProducts,
  getCollectionFacets,
  hasActiveFilters,
  parseCollectionFilters,
  serializeCollectionFilters,
} from "./collection-filters";

const slugs = (query: string) =>
  filterAndSortProducts(mockProducts, parseCollectionFilters(new URLSearchParams(query))).map(
    (product) => product.slug,
  );

describe("URL parsing and serializing", () => {
  it("parses a shared link", () => {
    expect(
      parseCollectionFilters(
        new URLSearchParams(
          "category=tshirt,hoodie&color=Crème&size=m,xl&min=5000&sort=new&view=list",
        ),
      ),
    ).toEqual({
      categories: ["tshirt", "hoodie"],
      colors: ["creme"],
      sizes: ["M", "XL"],
      minPrice: 5000,
      maxPrice: null,
      sort: "new",
      view: "list",
    });
  });

  it("ignores invalid values instead of failing", () => {
    expect(
      parseCollectionFilters({
        category: "shoes",
        size: "XS",
        min: "abc",
        sort: "random",
        view: "3d",
      }),
    ).toEqual(DEFAULT_FILTERS);
  });

  it("round-trips, in a stable order, without defaults", () => {
    const query = "category=hoodie,tshirt&color=creme,noir&size=S,XXL&max=7000&sort=price-asc";
    expect(serializeCollectionFilters(parseCollectionFilters(new URLSearchParams(query)))).toBe(
      query,
    );
    expect(serializeCollectionFilters(DEFAULT_FILTERS)).toBe("");
  });

  it("makes URL-friendly color keys", () => {
    expect(colorKey("Crème")).toBe("creme");
    expect(colorKey("Anthracite")).toBe("anthracite");
  });

  it("knows when filters narrow the list", () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, sort: "new", view: "list" })).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, minPrice: 5000 })).toBe(true);
  });
});

describe("filtering and sorting", () => {
  it("homepage category link: ?category=hoodie", () => {
    expect(slugs("category=hoodie")).toEqual([
      "signature-hoodie",
      "sketch-hoodie",
      "silence-hoodie",
      "canvas-hoodie",
    ]);
  });

  it("combines several categories", () => {
    expect(slugs("category=sweatshirt,tshirt")).toHaveLength(5);
  });

  it("filters by color", () => {
    expect(slugs("color=anthracite")).toEqual(["canvas-hoodie"]);
    expect(slugs("color=creme").sort()).toEqual(
      ["classic-tee", "inner-voice-tee", "sketch-hoodie", "unspoken-tee"].sort(),
    );
  });

  it("filters by size in stock (Silence Hoodie has no XXL left)", () => {
    expect(slugs("size=XXL")).not.toContain("silence-hoodie");
    expect(slugs("size=S")).not.toContain("inner-voice-tee");
  });

  it("filters by price range", () => {
    expect(slugs("min=5000&max=7000").sort()).toEqual(["echo-sweatshirt", "fragment-sweatshirt"]);
  });

  it("sorts by price and novelty", () => {
    const asc = slugs("sort=price-asc");
    expect(asc[0]).toMatch(/tee$/);
    expect(asc.at(-1)).toBe("canvas-hoodie");
    expect(slugs("sort=price-desc")[0]).toBe("canvas-hoodie");
    expect(slugs("sort=new")[0]).toBe("canvas-hoodie");
  });

  it("featured sort puts featured products first", () => {
    expect(slugs("").slice(0, 5)).toEqual([
      "signature-hoodie",
      "sketch-hoodie",
      "fragment-sweatshirt",
      "unspoken-tee",
      "classic-tee",
    ]);
  });

  it("returns nothing when no product matches", () => {
    expect(slugs("color=anthracite&category=tshirt")).toEqual([]);
  });
});

describe("facets", () => {
  it("counts categories, colors, sizes and prices from the data", () => {
    const facets = getCollectionFacets(mockProducts);
    expect(facets.total).toBe(9);
    expect(facets.categories.map((c) => [c.label, c.count])).toEqual([
      ["Hoodies", 4],
      ["Sweatshirts", 2],
      ["T-shirts", 3],
    ]);
    expect(facets.colors.find((c) => c.key === "noir")?.count).toBe(5);
    expect(facets.sizes).toEqual(["S", "M", "L", "XL", "XXL"]);
    expect(facets.price).toEqual({ min: 4900, max: 8900 });
  });
});
