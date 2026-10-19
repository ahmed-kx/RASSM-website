import { z } from "zod";
import { WILAYAS } from "../constants/wilayas";
import { deliveryFeeSchema, type DeliveryFee } from "../schemas/delivery";

/**
 * Anderson courier rates, departure Alger.
 * [code, name, estimated days, home price DA, stop-desk price DA or null = no stop desk]
 */
const ANDERSON_RATES: readonly (readonly [number, string, number, number, number | null])[] = [
  [1, "Adrar", 5, 1500, 750],
  [2, "Chlef", 1, 650, 400],
  [3, "Laghouat", 1, 750, 400],
  [4, "Oum El Bouaghi", 1, 750, 400],
  [5, "Batna", 1, 750, 400],
  [6, "Béjaïa", 1, 750, 400],
  [7, "Biskra", 1, 750, 400],
  [8, "Béchar", 3, 1100, 600],
  [9, "Blida", 1, 600, 360],
  [10, "Bouira", 1, 600, 400],
  [11, "Tamanrasset", 5, 1650, 900],
  [12, "Tébessa", 1, 750, 400],
  [13, "Tlemcen", 1, 750, 400],
  [14, "Tiaret", 1, 750, 400],
  [15, "Tizi Ouzou", 1, 600, 400],
  [16, "Alger", 1, 400, 250],
  [17, "Djelfa", 1, 750, 400],
  [18, "Jijel", 1, 750, 400],
  [19, "Sétif", 1, 750, 400],
  [20, "Saïda", 1, 750, 400],
  [21, "Skikda", 1, 750, 400],
  [22, "Sidi Bel Abbès", 1, 750, 400],
  [23, "Annaba", 1, 750, 400],
  [24, "Guelma", 1, 750, 400],
  [25, "Constantine", 1, 750, 400],
  [26, "Médéa", 1, 600, 400],
  [27, "Mostaganem", 1, 750, 400],
  [28, "M'Sila", 1, 750, 400],
  [29, "Mascara", 1, 750, 400],
  [30, "Ouargla", 2, 900, 450],
  [31, "Oran", 1, 750, 400],
  [32, "El Bayadh", 2, 750, 400],
  [33, "Illizi", 9, 1550, 800],
  [34, "Bordj Bou Arréridj", 1, 600, 400],
  [35, "Boumerdès", 1, 600, 360],
  [36, "El Tarf", 1, 750, 500],
  [37, "Tindouf", 5, 1500, null],
  [38, "Tissemsilt", 1, 750, 400],
  [39, "El Oued", 2, 850, 500],
  [40, "Khenchela", 1, 750, 400],
  [41, "Souk Ahras", 1, 750, 400],
  [42, "Tipaza", 1, 600, 400],
  [43, "Mila", 1, 750, 400],
  [44, "Aïn Defla", 1, 600, 400],
  [45, "Naâma", 1, 850, 450],
  [46, "Aïn Témouchent", 1, 750, 400],
  [47, "Ghardaïa", 2, 850, 600],
  [48, "Relizane", 1, 750, 400],
  [49, "Timimoun", 5, 1500, 750],
  [50, "Bordj Badji Mokhtar", 10, 1450, null],
  [51, "Ouled Djellal", 1, 850, 400],
  [52, "Béni Abbès", 3, 1200, null],
  [53, "In Salah", 5, 1500, 750],
  [54, "In Guezzam", 5, 1350, null],
  [55, "Touggourt", 2, 850, 450],
  [56, "Djanet", 9, 1800, 900],
  [57, "El M'Ghair", 5, 850, 450],
  [58, "El Meniaa", 5, 850, 450],
];

const rawDeliveryFees = ANDERSON_RATES.map(
  ([wilayaCode, , estimatedDays, homePrice, stopDeskPrice]) => ({
    wilayaCode,
    homePrice,
    stopDeskPrice,
    estimatedDays,
  }),
);

const deliveryFeeListSchema = z.array(deliveryFeeSchema).superRefine((fees, ctx) => {
  const codes = new Set(fees.map((fee) => fee.wilayaCode));
  if (codes.size !== fees.length) {
    ctx.addIssue({ code: "custom", message: "Wilaya en double dans les tarifs de livraison." });
  }
  for (const wilaya of WILAYAS) {
    if (!codes.has(wilaya.code)) {
      ctx.addIssue({
        code: "custom",
        message: `Tarif de livraison manquant pour la wilaya ${wilaya.code}.`,
      });
    }
  }
  // The names in the rate table must match the official list (catches typos and shifts).
  ANDERSON_RATES.forEach(([code, name], index) => {
    const official = WILAYAS.find((wilaya) => wilaya.code === code);
    if (official?.name !== name) {
      ctx.addIssue({
        code: "custom",
        path: [index],
        message: `Wilaya ${code} : "${name}" ne correspond pas à "${official?.name ?? "?"}".`,
      });
    }
  });
});

/** Parsed at module load: a mismatch with the schema throws immediately. */
export const mockDeliveryFees: readonly DeliveryFee[] =
  deliveryFeeListSchema.parse(rawDeliveryFees);

export function getMockDeliveryFee(wilayaCode: number): DeliveryFee | undefined {
  return mockDeliveryFees.find((fee) => fee.wilayaCode === wilayaCode);
}
