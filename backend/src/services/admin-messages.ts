import {
  MESSAGE_FOLDERS,
  type AdminMessage,
  type AdminMessageList,
  type AdminMessageUpdate,
  type MessageFolder,
  type adminMessageQuerySchema,
} from "@rassm/shared";
import { Types, type QueryFilter } from "mongoose";
import type { z } from "zod";
import { HttpError } from "../lib/http-error";
import { logger } from "../lib/logger";
import { ContactMessageModel, type ContactMessageDoc } from "../models/contact-message";

// Messages of the contact page: inbox, read / unread, archive, delete.

type MessageQuery = z.output<typeof adminMessageQuerySchema>;

const NOT_FOUND = "Message introuvable.";
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function parseId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(404, NOT_FOUND);
  return new Types.ObjectId(id);
}

const FOLDER_FILTERS: Record<MessageFolder, QueryFilter<ContactMessageDoc>> = {
  inbox: { archived: { $ne: true } },
  unread: { archived: { $ne: true }, read: false },
  read: { archived: { $ne: true }, read: true },
  archived: { archived: true },
};

export function toAdminMessage(doc: ContactMessageDoc): AdminMessage {
  return {
    id: doc._id.toString(),
    firstName: doc.firstName,
    lastName: doc.lastName,
    phone: doc.phone,
    email: doc.email ?? null,
    subject: doc.subject,
    message: doc.message,
    read: doc.read,
    archived: doc.archived ?? false,
    suspicious: doc.suspicious ?? false,
    suspiciousReason: doc.suspiciousReason ?? null,
    createdAt: doc.createdAt.toISOString(),
  };
}

/** Name, phone, e-mail or text of the message. */
function searchFilter(text: string | undefined): QueryFilter<ContactMessageDoc> {
  const q = text?.trim();
  if (!q) return {};
  const pattern = { $regex: escapeRegex(q), $options: "i" };
  const digits = q.replace(/[\s.+-]/g, "");
  return {
    $or: [
      { firstName: pattern },
      { lastName: pattern },
      { email: pattern },
      { message: pattern },
      ...(/^\d{3,}$/.test(digits)
        ? [{ phone: { $regex: escapeRegex(digits.replace(/^213/, "0")) } }]
        : []),
    ],
  };
}

export async function listMessages(query: MessageQuery): Promise<AdminMessageList> {
  const base: QueryFilter<ContactMessageDoc> = {
    ...searchFilter(query.q),
    ...(query.subject !== "all" && { subject: query.subject }),
  };
  const filter = { ...base, ...FOLDER_FILTERS[query.folder] };
  const [docs, total, ...counts] = await Promise.all([
    ContactMessageModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean<ContactMessageDoc[]>(),
    ContactMessageModel.countDocuments(filter),
    ...MESSAGE_FOLDERS.map((folder) =>
      ContactMessageModel.countDocuments({ ...base, ...FOLDER_FILTERS[folder] }),
    ),
  ]);
  return {
    messages: docs.map(toAdminMessage),
    total,
    counts: Object.fromEntries(
      MESSAGE_FOLDERS.map((folder, index) => [folder, counts[index] ?? 0]),
    ) as AdminMessageList["counts"],
  };
}

/** One message, marked as read when it is opened. */
export async function getMessage(id: string): Promise<AdminMessage> {
  const _id = parseId(id);
  const doc =
    (await ContactMessageModel.findOneAndUpdate(
      { _id, read: false },
      { $set: { read: true } },
      { returnDocument: "after" },
    ).lean<ContactMessageDoc>()) ??
    (await ContactMessageModel.findById(_id).lean<ContactMessageDoc>());
  if (!doc) throw new HttpError(404, NOT_FOUND);
  return toAdminMessage(doc);
}

export async function updateMessage(id: string, update: AdminMessageUpdate) {
  const doc = await ContactMessageModel.findByIdAndUpdate(
    parseId(id),
    { $set: update },
    { returnDocument: "after" },
  ).lean<ContactMessageDoc>();
  if (!doc) throw new HttpError(404, NOT_FOUND);
  return toAdminMessage(doc);
}

export async function deleteMessage(id: string) {
  const { deletedCount } = await ContactMessageModel.deleteOne({ _id: parseId(id) });
  if (deletedCount === 0) throw new HttpError(404, NOT_FOUND);
  logger.info("Contact message deleted");
}
