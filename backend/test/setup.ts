import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, inject } from "vitest";
import { seedDatabase } from "../src/seed";

// Every test starts from empty collections seeded from the shared mocks. The collections and
// their indexes are created once per file and only emptied between tests: dropping the whole
// database every time leaves mongod a lot of files to clean up and makes it shut down slowly.

beforeAll(async () => {
  await mongoose.connect(inject("mongoUri"), { dbName: "rassm-test" });
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
});

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.models).map((model) => model.collection.deleteMany({})));
  await seedDatabase();
});

afterAll(async () => {
  await mongoose.connection.db?.dropDatabase();
  await mongoose.disconnect();
});
