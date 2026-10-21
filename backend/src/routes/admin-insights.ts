import {
  adminClientQuerySchema,
  adminMessageQuerySchema,
  adminMessageUpdateSchema,
  adminSubscriberQuerySchema,
  presetRange,
  statsQuerySchema,
} from "@rassm/shared";
import type { RequestHandler, Response, Router } from "express";
import { csvFileName } from "../lib/csv";
import { parseOrThrow } from "../lib/http-error";
import { currentAdmin } from "../middleware/admin";
import { adsPage, createAdSpend, deleteAdSpend, updateAdSpend } from "../services/admin-ads";
import { clientsCsv, getClient, listClients } from "../services/admin-clients";
import { deleteMessage, getMessage, listMessages, updateMessage } from "../services/admin-messages";
import { dashboardStats } from "../services/admin-stats";
import {
  deleteSubscriber,
  listSubscribers,
  retrySubscriberSync,
  subscribersCsv,
} from "../services/admin-subscribers";
import type { NewsletterList } from "../services/newsletter-sync";

export interface InsightRouteOptions {
  newsletterList: NewsletterList;
  /** Stricter limit for the CSV exports (customer data). */
  sensitiveLimiter: () => RequestHandler;
}

/** The period of the query, or the last 30 days. */
function rangeOf(query: Record<string, unknown>) {
  if (!query.from && !query.to) return presetRange("30d");
  return parseOrThrow(statsQuerySchema, { from: query.from, to: query.to });
}

const sendCsv = (res: Response, prefix: string, csv: string) =>
  res
    .set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFileName(prefix)}"`,
    })
    .send(csv);

/** Tableau de bord, Publicité, Clients, Messages and Abonnés (session already checked). */
export function addInsightRoutes(router: Router, options: InsightRouteOptions): void {
  const list = options.newsletterList;

  router.get("/stats", async (req, res) => {
    res.json(await dashboardStats(rangeOf(req.query)));
  });

  // ---------- Publicité ----------

  router.get("/ads", async (req, res) => {
    res.json(await adsPage(rangeOf(req.query)));
  });

  router.post("/ads", async (req, res) => {
    res.status(201).json({ entry: await createAdSpend(req.body, currentAdmin(res)) });
  });

  router.put("/ads/:id", async (req, res) => {
    res.json({ entry: await updateAdSpend(req.params.id, req.body) });
  });

  router.delete("/ads/:id", async (req, res) => {
    await deleteAdSpend(req.params.id);
    res.json({ ok: true });
  });

  // ---------- Clients ----------

  router.get("/clients", async (req, res) => {
    res.json(await listClients(adminClientQuerySchema.parse(req.query)));
  });

  router.get("/clients/export", options.sensitiveLimiter(), async (req, res) => {
    sendCsv(res, "clients", await clientsCsv(adminClientQuerySchema.parse(req.query)));
  });

  router.get("/clients/:phone", async (req, res) => {
    res.json(await getClient(req.params.phone));
  });

  // ---------- Messages ----------

  router.get("/messages", async (req, res) => {
    res.json(await listMessages(adminMessageQuerySchema.parse(req.query)));
  });

  router.get("/messages/:id", async (req, res) => {
    res.json({ message: await getMessage(req.params.id) });
  });

  router.patch("/messages/:id", async (req, res) => {
    const update = parseOrThrow(adminMessageUpdateSchema, req.body);
    res.json({ message: await updateMessage(req.params.id, update) });
  });

  router.delete("/messages/:id", async (req, res) => {
    await deleteMessage(req.params.id);
    res.json({ ok: true });
  });

  // ---------- Abonnés ----------

  router.get("/subscribers", async (req, res) => {
    res.json(await listSubscribers(adminSubscriberQuerySchema.parse(req.query), list));
  });

  router.get("/subscribers/export", options.sensitiveLimiter(), async (req, res) => {
    sendCsv(res, "abonnes", await subscribersCsv(adminSubscriberQuerySchema.parse(req.query)));
  });

  router.post("/subscribers/:id/sync", async (req, res) => {
    res.json({ subscriber: await retrySubscriberSync(req.params.id, list) });
  });

  router.delete("/subscribers/:id", async (req, res) => {
    await deleteSubscriber(req.params.id, list);
    res.json({ ok: true });
  });
}
