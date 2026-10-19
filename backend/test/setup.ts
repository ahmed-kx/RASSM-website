import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, inject } from "vitest";
import { seedDatabase } from "../src/seed";

// Every test starts from a clean database seeded from the shared mocks.

beforeAll(async () => {
  await mongoose.connect(inject("mongoUri"), { dbName: "rassm-test" });
});

beforeEach(async () => {
  await mongoose.connection.db?.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
  await seedDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();
});
