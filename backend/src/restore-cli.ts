// pnpm restore -- <file> [--replace]: restores a backup made by pnpm backup into the database
// of MONGODB_URI / MONGODB_DB_NAME. Without --replace it only fills empty collections (safest:
// restore into a new MONGODB_DB_NAME, check, then switch). With --replace the collections of
// the backup are emptied first, after typing the database name to confirm.
import path from "node:path";
import { createInterface } from "node:readline/promises";
import mongoose from "mongoose";
import { restoreBackup } from "./backup";
import { connectDatabase, disconnectDatabase } from "./db";
import { loadEnv } from "./env";
import { describeError, logger } from "./lib/logger";
// Every model, so their indexes are created after the restore.
import "./models/ad-spend";
import "./models/admin";
import "./models/admin-password-reset";
import "./models/admin-session";
import "./models/blacklist";
import "./models/contact-message";
import "./models/counter";
import "./models/delivery-fee";
import "./models/login-throttle";
import "./models/newsletter-subscriber";
import "./models/order";
import "./models/product";
import "./models/setting";

const env = loadEnv();
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const replace = args.includes("--replace");
const fileArg = args.find((arg) => !arg.startsWith("--"));

if (!fileArg) {
  console.error("Usage: pnpm restore -- <backup file> [--replace]");
  process.exit(1);
}
// Relative paths are read from where pnpm was started.
const file = path.resolve(process.env.INIT_CWD ?? process.cwd(), fileArg);

try {
  if (replace) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(
      `--replace empties the collections of database "${env.MONGODB_DB_NAME}" before restoring.\nType the database name to confirm: `,
    );
    rl.close();
    if (answer.trim() !== env.MONGODB_DB_NAME) {
      console.error("Not confirmed: nothing was changed.");
      process.exit(1);
    }
  }
  await connectDatabase(env.MONGODB_URI, env.MONGODB_DB_NAME, {
    dnsFallbackServers: env.DNS_FALLBACK_SERVERS,
  });
  const db = mongoose.connection.db;
  if (!db) throw new Error("No database connection");
  const result = await restoreBackup(db, file, { passphrase: env.BACKUP_PASSPHRASE, replace });
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()));
  logger.info(`Backup restored into "${env.MONGODB_DB_NAME}"`, {
    from: result.header.createdAt,
    documents: result.counts,
  });
} catch (error) {
  logger.error("Restore failed", describeError(error));
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
