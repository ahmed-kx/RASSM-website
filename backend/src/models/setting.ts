import { DEFAULT_ADMIN_SETTINGS, adminSettingsSchema, type AdminSettings } from "@rassm/shared";
import { Schema, model } from "mongoose";

/** Dashboard settings: one document (`_id: "admin"`), created with the defaults when missing. */
interface SettingDoc {
  _id: string;
  lowStockThreshold: number;
}

const settingSchema = new Schema<SettingDoc>(
  {
    _id: { type: String, required: true },
    lowStockThreshold: { type: Number, required: true },
  },
  { versionKey: false, timestamps: true },
);

export const SettingModel = model<SettingDoc>("Setting", settingSchema);

const SETTINGS_ID = "admin";

const toSettings = (doc: SettingDoc | null): AdminSettings =>
  adminSettingsSchema.parse({
    lowStockThreshold: doc?.lowStockThreshold ?? DEFAULT_ADMIN_SETTINGS.lowStockThreshold,
  });

/** The saved settings, or the defaults when none were saved yet. */
export async function loadSettings(): Promise<AdminSettings> {
  return toSettings(await SettingModel.findById(SETTINGS_ID).lean<SettingDoc>());
}

export async function saveSettings(settings: AdminSettings): Promise<AdminSettings> {
  const doc = await SettingModel.findOneAndUpdate(
    { _id: SETTINGS_ID },
    { $set: settings },
    { upsert: true, returnDocument: "after" },
  ).lean<SettingDoc>();
  return toSettings(doc);
}
