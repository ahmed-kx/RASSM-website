import { adSpendInputSchema, type AdsPage, type Admin, type StatsQuery } from "@rassm/shared";
import { Types } from "mongoose";
import { HttpError, parseOrThrow } from "../lib/http-error";
import { logger } from "../lib/logger";
import { AdSpendModel, toAdSpend, type AdSpendDoc } from "../models/ad-spend";
import { adsSummary } from "./admin-stats";

// Publicité: ads spend entries (a day or a period, spread evenly per day in the statistics).

const NOT_FOUND = "Dépense introuvable.";

function parseId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(404, NOT_FOUND);
  return new Types.ObjectId(id);
}

/** Every entry (newest period first) and the figures of the chosen range. */
export async function adsPage(range: StatsQuery): Promise<AdsPage> {
  const [entries, summary] = await Promise.all([
    AdSpendModel.find().sort({ startDate: -1, endDate: -1, _id: -1 }).lean<AdSpendDoc[]>(),
    adsSummary(range.from, range.to),
  ]);
  return { entries: entries.map(toAdSpend), summary, range };
}

export async function createAdSpend(body: unknown, admin: Admin) {
  const input = parseOrThrow(adSpendInputSchema, body);
  const doc = await AdSpendModel.create({ ...input, createdBy: admin.email });
  logger.info("Ads spend added", { amount: doc.amount, by: admin.email });
  return toAdSpend(doc.toObject());
}

export async function updateAdSpend(id: string, body: unknown) {
  const input = parseOrThrow(adSpendInputSchema, body);
  const doc = await AdSpendModel.findByIdAndUpdate(
    parseId(id),
    { $set: input },
    { returnDocument: "after" },
  ).lean<AdSpendDoc>();
  if (!doc) throw new HttpError(404, NOT_FOUND);
  return toAdSpend(doc);
}

export async function deleteAdSpend(id: string) {
  const { deletedCount } = await AdSpendModel.deleteOne({ _id: parseId(id) });
  if (deletedCount === 0) throw new HttpError(404, NOT_FOUND);
}
