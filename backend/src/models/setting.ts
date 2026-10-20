import { DEFAULT_ADMIN_SETTINGS, adminSettingsSchema, type AdminSettings } from "@rassm/shared";
import { Schema, model } from "mongoose";

/** Dashboard settings: one document (`_id: "admin"`), the defaults while nothing is saved. */
interface SettingDoc {
  _id: string;
  lowStockThreshold?: number;
  packagingCost?: number;
  returnCost?: number;
}

const settingSchema = new Schema<SettingDoc>(
  {
    _id: { type: String, required: true },
    lowStockThreshold: { type: Number, min: 0 },
    packagingCost: { type: Number, min: 0 },
    returnCost: { type: Number, min: 0 },
  },
  { versionKey: false, timestamps: true },
);

export const SettingModel = model<SettingDoc>("Setting", settingSchema);

const SETTINGS_ID = "admin";

const toSettings = (doc: SettingDoc | null): AdminSettings =>
  adminSettingsSchema.parse({
    lowStockThreshold: doc?.lowStockThreshold ?? DEFAULT_ADMIN_SETTINGS.lowStockThreshold,
    packagingCost: doc?.packagingCost ?? DEFAULT_ADMIN_SETTINGS.packagingCost,
    returnCost: doc?.returnCost ?? DEFAULT_ADMIN_SETTINGS.returnCost,
  });

/** The saved settings, with the defaults for what was never saved. */
export async function loadSettings(): Promise<AdminSettings> {
  return toSettings(await SettingModel.findById(SETTINGS_ID).lean<SettingDoc>());
}

/** Saves the given settings (the others are kept). */
export async function saveSettings(update: Partial<AdminSettings>): Promise<AdminSettings> {
  const doc = await SettingModel.findOneAndUpdate(
    { _id: SETTINGS_ID },
    { $set: Object.fromEntries(Object.entries(update).filter(([, value]) => value !== undefined)) },
    { upsert: true, returnDocument: "after" },
  ).lean<SettingDoc>();
  return toSettings(doc);
}
