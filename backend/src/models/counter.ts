import { Schema, model } from "mongoose";

/** Sequences (e.g. the order number). Incremented atomically with $inc. */
interface CounterDoc {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CounterDoc>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false },
);

export const CounterModel = model<CounterDoc>("Counter", counterSchema);

const ORDER_COUNTER = "orderNumber";

/**
 * Next internal order number: RSM-000001, RSM-000002… A single atomic `$inc` on one
 * document, so simultaneous orders always get different numbers.
 */
export async function nextOrderNumber(): Promise<string> {
  const increment = () =>
    CounterModel.findOneAndUpdate(
      { _id: ORDER_COUNTER },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" },
    ).lean<CounterDoc>();
  let counter: CounterDoc | null;
  try {
    counter = await increment();
  } catch (error) {
    // Two first-ever orders at the same instant can both try to create the counter:
    // one wins, the other gets a duplicate key error and simply retries.
    if ((error as { code?: number }).code !== 11000) throw error;
    counter = await increment();
  }
  if (!counter) throw new Error("Order counter could not be incremented.");
  return `RSM-${String(counter.seq).padStart(6, "0")}`;
}
