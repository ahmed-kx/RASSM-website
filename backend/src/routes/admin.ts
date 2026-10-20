import {
  ADMIN_SESSION_COOKIE,
  adminLoginSchema,
  adminNoteSchema,
  adminOrderEditSchema,
  adminOrderQuerySchema,
  adminSearchQuerySchema,
  adminStatusChangeSchema,
  andersonExportSchema,
  blacklistAddSchema,
  bulkShipSchema,
} from "@rassm/shared";
import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { getClientInfo } from "../lib/client-info";
import { HttpError, parseOrThrow } from "../lib/http-error";
import type { MetaEvents } from "../meta/conversions-api";
import {
  currentAdmin,
  readSessionToken,
  requireAdmin,
  requireSameOrigin,
  sessionCookieOptions,
} from "../middleware/admin";
import {
  blacklistOrderPhone,
  addToBlacklist,
  changeStatus,
  confirmedOrdersForExport,
  editOrder,
  getOrder,
  listBlacklist,
  listOrders,
  orderUpdates,
  removeFromBlacklist,
  setNote,
  shipOrders,
} from "../services/admin-orders";
import { login, logout } from "../services/admin-auth";
import { searchDashboard } from "../services/admin-search";
import { andersonFileName, buildAndersonCsv } from "../services/anderson-export";
import { ProductModel } from "../models/product";
import { addCatalogRoutes, type CatalogRouteOptions } from "./admin-catalog";

export interface AdminRouterOptions extends CatalogRouteOptions {
  allowedOrigins: readonly string[];
  /** Secure cookies (HTTPS only): true in production. */
  secureCookies: boolean;
  loginLimiter: RequestHandler;
  adminLimiter: RequestHandler;
  metaEvents: MetaEvents;
}

/** The dashboard API, under /api/admin. Everything except login needs a session. */
export function adminRouter(options: AdminRouterOptions): Router {
  const router = Router();
  router.use(requireSameOrigin(options.allowedOrigins));
  router.use((_req, res, next) => {
    // Private data: never cached by the browser or a proxy.
    res.set("Cache-Control", "no-store");
    next();
  });

  router.post("/auth/login", options.loginLimiter, async (req, res) => {
    const { email, password } = parseOrThrow(adminLoginSchema, req.body);
    const session = await login(email, password, getClientInfo(req));
    res.cookie(
      ADMIN_SESSION_COOKIE,
      session.token,
      sessionCookieOptions(options.secureCookies, session.expiresAt),
    );
    res.json({ admin: session.admin });
  });

  router.post("/auth/logout", async (req, res) => {
    const token = readSessionToken(req);
    if (token) await logout(token);
    res.clearCookie(ADMIN_SESSION_COOKIE, sessionCookieOptions(options.secureCookies));
    res.json({ ok: true });
  });

  // Everything below requires a session.
  router.use(options.adminLimiter, requireAdmin);

  router.get("/auth/me", (_req, res) => {
    res.json({ admin: currentAdmin(res) });
  });

  addCatalogRoutes(router, {
    revalidator: options.revalidator,
    imageStorage: options.imageStorage,
  });

  router.get("/search", async (req, res) => {
    res.json(await searchDashboard(adminSearchQuerySchema.parse(req.query).q));
  });

  router.get("/orders", async (req, res) => {
    res.json(await listOrders(adminOrderQuerySchema.parse(req.query)));
  });

  router.get("/orders/updates", async (req, res) => {
    const since = z.iso.datetime().safeParse(req.query.since);
    res.json(await orderUpdates(since.success ? new Date(since.data) : null));
  });

  router.post("/orders/export", async (req, res) => {
    const { ids, all } = parseOrThrow(andersonExportSchema, req.body);
    const orders = await confirmedOrdersForExport(ids, all === true);
    if (orders.length === 0) throw new HttpError(400, "Aucune commande confirmée à exporter.");
    const products = await ProductModel.find(
      { _id: { $in: [...new Set(orders.map((order) => order.item.productId))] } },
      { sku: 1 },
    ).lean<{ _id: string; sku?: string }[]>();
    const skus = new Map(
      products.flatMap((product) => (product.sku ? [[product._id, product.sku]] : [])),
    );
    res
      .set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${andersonFileName()}"`,
        "X-Exported-Ids": orders.map((order) => order._id.toString()).join(","),
      })
      .send(buildAndersonCsv(orders, skus));
  });

  router.post("/orders/ship", async (req, res) => {
    const { ids } = parseOrThrow(bulkShipSchema, req.body);
    res.json(await shipOrders(ids, currentAdmin(res), options.metaEvents));
  });

  router.get("/orders/:id", async (req, res) => {
    res.json(await getOrder(req.params.id));
  });

  router.patch("/orders/:id", async (req, res) => {
    const edit = parseOrThrow(adminOrderEditSchema, req.body);
    res.json({ order: await editOrder(req.params.id, edit, currentAdmin(res)) });
  });

  router.post("/orders/:id/status", async (req, res) => {
    const { status } = parseOrThrow(adminStatusChangeSchema, req.body);
    res.json({
      order: await changeStatus(req.params.id, status, currentAdmin(res), options.metaEvents),
    });
  });

  router.put("/orders/:id/note", async (req, res) => {
    const { note } = parseOrThrow(adminNoteSchema, req.body);
    res.json({ order: await setNote(req.params.id, note) });
  });

  router.post("/orders/:id/blacklist", async (req, res) => {
    const { reason } = parseOrThrow(blacklistAddSchema.pick({ reason: true }), req.body);
    res.json({ order: await blacklistOrderPhone(req.params.id, reason, currentAdmin(res)) });
  });

  router.get("/blacklist", async (_req, res) => {
    res.json({ entries: await listBlacklist() });
  });

  router.post("/blacklist", async (req, res) => {
    const { phone, reason } = parseOrThrow(blacklistAddSchema, req.body);
    await addToBlacklist(phone, reason, currentAdmin(res));
    res.status(201).json({ entries: await listBlacklist() });
  });

  router.delete("/blacklist/:phone", async (req, res) => {
    if (!(await removeFromBlacklist(req.params.phone))) {
      throw new HttpError(404, "Ce numéro n'est pas sur la liste noire.");
    }
    res.json({ entries: await listBlacklist() });
  });

  return router;
}
