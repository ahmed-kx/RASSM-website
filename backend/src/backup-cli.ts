// pnpm backup: saves the whole database into backend/backups (BACKUP_DIR) as one compressed,
// dated file, encrypted when BACKUP_PASSPHRASE is set (required in production, unless
// `-- --unencrypted`), and keeps the BACKUP_KEEP newest.
// Safe to run at any time (read only). See docs/SECURITY.md for the schedule and restoring.
import path from "node:path";
import mongoose from "mongoose";
import { fileSize, plainBackupRefusal, pruneBackups, writeBackup } from "./backup";
import { connectDatabase, disconnectDatabase } from "./db";
import { loadEnv } from "./env";
import { describeError, logger } from "./lib/logger";

const env = loadEnv();
const dir = path.resolve(env.BACKUP_DIR);

try {
  await connectDatabase(env.MONGODB_URI, env.MONGODB_DB_NAME, {
    dnsFallbackServers: env.DNS_FALLBACK_SERVERS,
  });
  const db = mongoose.connection.db;
  if (!db) throw new Error("No database connection");
  const refused = plainBackupRefusal({
    production: env.NODE_ENV === "production",
    passphrase: env.BACKUP_PASSPHRASE,
    allowPlain: process.argv.includes("--unencrypted"),
  });
  if (refused) throw new Error(refused);
  if (!env.BACKUP_PASSPHRASE) {
    logger.warn(
      "BACKUP_PASSPHRASE is not set: the backup is not encrypted (keep it on this computer only)",
    );
  }
  const backup = await writeBackup(db, dir, { passphrase: env.BACKUP_PASSPHRASE });
  const removed = await pruneBackups(dir, env.BACKUP_KEEP);
  logger.info(`Backup saved: ${backup.file} (${await fileSize(backup.file)})`, {
    database: env.MONGODB_DB_NAME,
    encrypted: backup.encrypted,
    documents: backup.counts,
    oldBackupsDeleted: removed.length,
  });
} catch (error) {
  logger.error("Backup failed", describeError(error));
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
