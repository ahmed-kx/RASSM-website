/** Regions of the dashboard's delivery tabs. */
export const REGIONS = ["centre", "est", "ouest", "sud"] as const;
export type Region = (typeof REGIONS)[number];

export const REGION_LABELS: Record<Region, string> = {
  centre: "Centre",
  est: "Est",
  ouest: "Ouest",
  sud: "Sud",
};

/**
 * The 58 official wilayas of Algeria (codes 01 to 58), as used by our courier Anderson.
 * Customers from the newer wilayas choose their former wilaya.
 *
 * Regions (dashboard grouping): Centre = Alger, the central coast, Kabylie, Médéa and
 * Aïn Defla; Est and Ouest = the north-east and north-west (coast and high plateaus, with
 * M'Sila in the Est and Chlef, Tiaret, Tissemsilt in the Ouest); Sud = the Sahara, its gates
 * (Laghouat, Djelfa, Biskra, El Bayadh, Naâma) and the new wilayas.
 */
export const WILAYAS = [
  { code: 1, name: "Adrar", region: "sud" },
  { code: 2, name: "Chlef", region: "ouest" },
  { code: 3, name: "Laghouat", region: "sud" },
  { code: 4, name: "Oum El Bouaghi", region: "est" },
  { code: 5, name: "Batna", region: "est" },
  { code: 6, name: "Béjaïa", region: "centre" },
  { code: 7, name: "Biskra", region: "sud" },
  { code: 8, name: "Béchar", region: "sud" },
  { code: 9, name: "Blida", region: "centre" },
  { code: 10, name: "Bouira", region: "centre" },
  { code: 11, name: "Tamanrasset", region: "sud" },
  { code: 12, name: "Tébessa", region: "est" },
  { code: 13, name: "Tlemcen", region: "ouest" },
  { code: 14, name: "Tiaret", region: "ouest" },
  { code: 15, name: "Tizi Ouzou", region: "centre" },
  { code: 16, name: "Alger", region: "centre" },
  { code: 17, name: "Djelfa", region: "sud" },
  { code: 18, name: "Jijel", region: "est" },
  { code: 19, name: "Sétif", region: "est" },
  { code: 20, name: "Saïda", region: "ouest" },
  { code: 21, name: "Skikda", region: "est" },
  { code: 22, name: "Sidi Bel Abbès", region: "ouest" },
  { code: 23, name: "Annaba", region: "est" },
  { code: 24, name: "Guelma", region: "est" },
  { code: 25, name: "Constantine", region: "est" },
  { code: 26, name: "Médéa", region: "centre" },
  { code: 27, name: "Mostaganem", region: "ouest" },
  { code: 28, name: "M'Sila", region: "est" },
  { code: 29, name: "Mascara", region: "ouest" },
  { code: 30, name: "Ouargla", region: "sud" },
  { code: 31, name: "Oran", region: "ouest" },
  { code: 32, name: "El Bayadh", region: "sud" },
  { code: 33, name: "Illizi", region: "sud" },
  { code: 34, name: "Bordj Bou Arréridj", region: "est" },
  { code: 35, name: "Boumerdès", region: "centre" },
  { code: 36, name: "El Tarf", region: "est" },
  { code: 37, name: "Tindouf", region: "sud" },
  { code: 38, name: "Tissemsilt", region: "ouest" },
  { code: 39, name: "El Oued", region: "sud" },
  { code: 40, name: "Khenchela", region: "est" },
  { code: 41, name: "Souk Ahras", region: "est" },
  { code: 42, name: "Tipaza", region: "centre" },
  { code: 43, name: "Mila", region: "est" },
  { code: 44, name: "Aïn Defla", region: "centre" },
  { code: 45, name: "Naâma", region: "sud" },
  { code: 46, name: "Aïn Témouchent", region: "ouest" },
  { code: 47, name: "Ghardaïa", region: "sud" },
  { code: 48, name: "Relizane", region: "ouest" },
  { code: 49, name: "Timimoun", region: "sud" },
  { code: 50, name: "Bordj Badji Mokhtar", region: "sud" },
  { code: 51, name: "Ouled Djellal", region: "sud" },
  { code: 52, name: "Béni Abbès", region: "sud" },
  { code: 53, name: "In Salah", region: "sud" },
  { code: 54, name: "In Guezzam", region: "sud" },
  { code: 55, name: "Touggourt", region: "sud" },
  { code: 56, name: "Djanet", region: "sud" },
  { code: 57, name: "El M'Ghair", region: "sud" },
  { code: 58, name: "El Meniaa", region: "sud" },
] as const;

export type Wilaya = (typeof WILAYAS)[number];
export type WilayaCode = Wilaya["code"];

export const WILAYA_COUNT = WILAYAS.length;

export function getWilaya(code: number): Wilaya | undefined {
  return WILAYAS.find((wilaya) => wilaya.code === code);
}

/** "16 - Alger" style label for selects. */
export function formatWilaya(wilaya: Wilaya): string {
  return `${String(wilaya.code).padStart(2, "0")} - ${wilaya.name}`;
}
