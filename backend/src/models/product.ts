import {
  CATEGORIES,
  SIZES,
  productSchema,
  type DeliveryDiscountTier,
  type Product,
  type ProductColor,
} from "@rassm/shared";
import { Schema, model } from "mongoose";

/** A product as stored. `_id` is the shared product id (e.g. "prod_001"). */
export interface ProductDoc extends Omit<Product, "id" | "createdAt"> {
  _id: string;
  createdAt: Date;
  updatedAt?: Date;
}

const stockSchema = new Schema<ProductColor["stock"]>(
  Object.fromEntries(SIZES.map((size) => [size, { type: Number, required: true, min: 0 }])),
  { _id: false },
);

const colorSchema = new Schema<ProductColor>(
  {
    name: { type: String, required: true, trim: true },
    hex: { type: String, required: true },
    images: { type: [String], default: undefined },
    stock: { type: stockSchema, required: true },
  },
  { _id: false },
);

const tierSchema = new Schema<DeliveryDiscountTier>(
  {
    type: { type: String, enum: ["amount", "free"], required: true },
    minQuantity: { type: Number, required: true, min: 1 },
    amount: { type: Number, min: 1 },
  },
  { _id: false },
);

const productMongooseSchema = new Schema<ProductDoc>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    category: { type: String, enum: CATEGORIES, required: true },
    price: { type: Number, required: true, min: 1 },
    images: { type: [String], required: true },
    // Stock per variant: colors[].stock.<size>. Orders decrement it atomically.
    colors: { type: [colorSchema], required: true },
    featured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    deliveryDiscountTiers: { type: [tierSchema], default: [] },
    drop: { type: String, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { timestamps: { createdAt: false, updatedAt: true }, versionKey: false },
);
productMongooseSchema.index({ isActive: 1, category: 1 });

export const ProductModel = model<ProductDoc>("Product", productMongooseSchema);

/** Stored product → shared `Product` (validated, so the API always returns the shared shape). */
export function toProduct(doc: ProductDoc): Product {
  return productSchema.parse({
    id: doc._id,
    name: doc.name,
    slug: doc.slug,
    description: doc.description,
    category: doc.category,
    price: doc.price,
    images: doc.images,
    colors: doc.colors.map((color) => ({
      name: color.name,
      hex: color.hex,
      ...(color.images?.length ? { images: color.images } : {}),
      stock: Object.fromEntries(SIZES.map((size) => [size, color.stock[size]])),
    })),
    featured: doc.featured,
    isActive: doc.isActive,
    deliveryDiscountTiers: doc.deliveryDiscountTiers.map((tier) =>
      tier.type === "free"
        ? { type: "free", minQuantity: tier.minQuantity }
        : { type: "amount", minQuantity: tier.minQuantity, amount: tier.amount },
    ),
    drop: doc.drop,
    createdAt: doc.createdAt.toISOString(),
  });
}

/** Shared `Product` → document fields (seed, admin later). */
export function fromProduct(product: Product): ProductDoc {
  const { id, createdAt, ...rest } = product;
  return { ...rest, _id: id, createdAt: new Date(createdAt) };
}
