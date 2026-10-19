import { SIZES, type AdminSearchResult } from "@rassm/shared";
import { OrderModel, type OrderDoc } from "../models/order";
import { ProductModel } from "../models/product";
import { orderSearchFilter } from "./admin-orders";

const LIMIT = 5;
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Global search of the dashboard: orders (name, phone, order number) and products (name). */
export async function searchDashboard(q: string): Promise<AdminSearchResult> {
  if (q.length < 2) return { orders: [], products: [] };
  const [orders, products] = await Promise.all([
    OrderModel.find(orderSearchFilter(q))
      .sort({ createdAt: -1, _id: -1 })
      .limit(LIMIT)
      .lean<OrderDoc[]>(),
    ProductModel.find({ name: { $regex: escapeRegex(q), $options: "i" } })
      .sort({ name: 1 })
      .limit(LIMIT)
      .lean(),
  ]);
  return {
    orders: orders.map((order) => ({
      id: order._id.toString(),
      orderNumber: order.orderNumber,
      fullName: order.fullName,
      phone: order.phone,
      status: order.status,
      total: order.total,
      createdAt: order.createdAt.toISOString(),
      productName: order.item.name,
    })),
    products: products.map((product) => ({
      id: String(product._id),
      name: product.name,
      slug: product.slug,
      image: product.images[0] ?? "",
      price: product.price,
      stock: product.colors.reduce(
        (sum, color) => sum + SIZES.reduce((units, size) => units + (color.stock[size] ?? 0), 0),
        0,
      ),
      isActive: product.isActive,
    })),
  };
}
