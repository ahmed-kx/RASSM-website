import type { Size } from "@rassm/shared";

export interface SizeGuideRow {
  size: Size;
  /** Chest width, measured flat, in cm. */
  chest: number;
  /** Body length, from the shoulder to the hem, in cm. */
  length: number;
  /** Shoulder width, in cm. */
  shoulders: number;
  /** Sleeve length, in cm. */
  sleeve: number;
}

// TO REPLACE: placeholder measurements for the oversized fit, NOT real RASSM
// measurements. Replace with the real ones per garment type (see docs/TODO.md).
export const SIZE_GUIDE_ROWS: readonly SizeGuideRow[] = [
  { size: "S", chest: 60, length: 70, shoulders: 56, sleeve: 58 },
  { size: "M", chest: 63, length: 72, shoulders: 58, sleeve: 60 },
  { size: "L", chest: 66, length: 74, shoulders: 60, sleeve: 61 },
  { size: "XL", chest: 69, length: 76, shoulders: 62, sleeve: 62 },
  { size: "XXL", chest: 72, length: 78, shoulders: 64, sleeve: 63 },
];
