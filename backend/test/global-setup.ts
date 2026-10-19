import { MongoMemoryServer } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

/** One in-memory MongoDB for the whole test run (the binary is downloaded on the first run). */
export default async function setup(project: TestProject) {
  const mongo = await MongoMemoryServer.create();
  project.provide("mongoUri", mongo.getUri());
  return async () => {
    await mongo.stop();
  };
}
