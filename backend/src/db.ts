import mongoose from "mongoose";

// Unknown fields in query filters are dropped instead of being sent to MongoDB.
mongoose.set("strictQuery", true);

export async function connectDatabase(uri: string, dbName: string): Promise<typeof mongoose> {
  return mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10_000 });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
