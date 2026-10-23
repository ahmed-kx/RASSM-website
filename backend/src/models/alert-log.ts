import { Schema, model } from "mongoose";

/**
 * Alerts already e-mailed to the team ("ip:<address>", "stock:<product>:<color>:<size>"), so the
 * same alert is sent once per period. MongoDB deletes each record once `expiresAt` is past.
 */
export interface AlertLogDoc {
  _id: string;
  sentAt: Date;
  expiresAt: Date;
}

const alertLogSchema = new Schema<AlertLogDoc>(
  {
    _id: { type: String, required: true },
    sentAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);
alertLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AlertLogModel = model<AlertLogDoc>("AlertLog", alertLogSchema);
