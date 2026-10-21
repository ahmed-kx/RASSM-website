import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { appendFile, mkdir, open, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable, type Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip, createGzip } from "node:zlib";
import { createInterface } from "node:readline";
import mongoose from "mongoose";

// Database backups (pnpm backup / pnpm restore). One file per backup: every document of every
// collection as a line of canonical Extended JSON (dates, ids and numbers keep their exact
// types), gzip-compressed, and encrypted with AES-256-GCM when a passphrase is given.
//
// File: rassm-backup-2026-10-21T03-00-00Z.ndjson.gz(.enc)
//   line 1: { "format": "rassm-backup", "version": 1, "database": "rassm", "createdAt": "…" }
//   then:   { "c": "<collection>", "d": <document> }
// Encrypted: "RASSMBK1" + salt (16 bytes) + IV (12 bytes) + ciphertext + GCM tag (16 bytes).

const { EJSON } = mongoose.mongo.BSON;
type Db = mongoose.mongo.Db;
type Doc = mongoose.mongo.Document;

export const BACKUP_PREFIX = "rassm-backup-";
const MAGIC = Buffer.from("RASSMBK1", "latin1");
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const INSERT_BATCH = 500;

interface Header {
  format: "rassm-backup";
  version: 1;
  database: string;
  createdAt: string;
}

export interface BackupResult {
  file: string;
  /** Documents saved per collection. */
  counts: Record<string, number>;
  encrypted: boolean;
}

const keyOf = (passphrase: string, salt: Buffer) =>
  scryptSync(passphrase, salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });

/** "2026-10-21T03:00:00.000Z" → "2026-10-21T03-00-00Z" (valid on every file system). */
const stamp = (date: Date) =>
  date
    .toISOString()
    .replace(/\.\d+Z$/, "Z")
    .replace(/:/g, "-");

/** The collections to save (MongoDB's own system collections excluded). */
async function collectionNames(db: Db): Promise<string[]> {
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  return collections
    .map((collection) => collection.name)
    .filter((name) => !name.startsWith("system."))
    .sort();
}

/** Writes a backup of the whole database into `dir`. */
export async function writeBackup(
  db: Db,
  dir: string,
  { passphrase, now = new Date() }: { passphrase?: string; now?: Date } = {},
): Promise<BackupResult> {
  await mkdir(dir, { recursive: true });
  const encrypted = Boolean(passphrase);
  const file = path.join(dir, `${BACKUP_PREFIX}${stamp(now)}.ndjson.gz${encrypted ? ".enc" : ""}`);
  const names = await collectionNames(db);
  const counts: Record<string, number> = {};

  async function* lines() {
    const header: Header = {
      format: "rassm-backup",
      version: 1,
      database: db.databaseName,
      createdAt: now.toISOString(),
    };
    yield `${JSON.stringify(header)}\n`;
    for (const name of names) {
      counts[name] = 0;
      for await (const doc of db.collection(name).find({}, { sort: { _id: 1 } })) {
        counts[name] += 1;
        yield `${EJSON.stringify({ c: name, d: doc }, { relaxed: false })}\n`;
      }
    }
  }

  const output = createWriteStream(file, { mode: 0o600 });
  if (!passphrase) {
    await pipeline(Readable.from(lines()), createGzip({ level: 9 }), output);
    return { file, counts, encrypted };
  }
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keyOf(passphrase, salt), iv);
  output.write(Buffer.concat([MAGIC, salt, iv]));
  await pipeline(Readable.from(lines()), createGzip({ level: 9 }), cipher, output as Writable);
  await appendFile(file, cipher.getAuthTag());
  return { file, counts, encrypted };
}

/** The decompressed (and decrypted) lines of a backup file. */
async function* readLines(file: string, passphrase?: string): AsyncGenerator<string> {
  const handle = await open(file, "r");
  const prefix = Buffer.alloc(MAGIC.length);
  await handle.read(prefix, 0, MAGIC.length, 0);
  const { size } = await handle.stat();

  let source: Readable;
  if (prefix.equals(MAGIC)) {
    if (!passphrase) {
      await handle.close();
      throw new Error("This backup is encrypted: set BACKUP_PASSPHRASE.");
    }
    const head = Buffer.alloc(SALT_BYTES + IV_BYTES);
    await handle.read(head, 0, head.length, MAGIC.length);
    const tag = Buffer.alloc(TAG_BYTES);
    await handle.read(tag, 0, TAG_BYTES, size - TAG_BYTES);
    await handle.close();
    const decipher = createDecipheriv(
      "aes-256-gcm",
      keyOf(passphrase, head.subarray(0, SALT_BYTES)),
      head.subarray(SALT_BYTES),
    );
    decipher.setAuthTag(tag);
    const start = MAGIC.length + SALT_BYTES + IV_BYTES;
    source = createReadStream(file, { start, end: size - TAG_BYTES - 1 }).pipe(decipher);
  } else {
    await handle.close();
    source = createReadStream(file);
  }
  const gunzip = createGunzip();
  // Errors of the decryption (wrong passphrase, modified file) reach the reader.
  source.on("error", (error) => gunzip.destroy(error));
  yield* createInterface({ input: source.pipe(gunzip), crlfDelay: Infinity });
}

/** Header and documents of a backup, collection by collection. */
export async function* readBackup(
  file: string,
  passphrase?: string,
): AsyncGenerator<{ header: Header } | { collection: string; doc: Doc }> {
  let first = true;
  for await (const line of readLines(file, passphrase)) {
    if (!line.trim()) continue;
    if (first) {
      const header = JSON.parse(line) as Header;
      if (header.format !== "rassm-backup") throw new Error("Not a RASSM backup file.");
      first = false;
      yield { header };
      continue;
    }
    const { c, d } = EJSON.parse(line, { relaxed: false }) as { c: string; d: Doc };
    yield { collection: c, doc: d };
  }
  if (first) throw new Error("Empty backup file.");
}

export interface RestoreResult {
  header: Header;
  counts: Record<string, number>;
}

/**
 * Restores a backup into `db`. Refuses when one of its collections already holds documents,
 * unless `replace` (those collections are then emptied first).
 */
export async function restoreBackup(
  db: Db,
  file: string,
  { passphrase, replace = false }: { passphrase?: string; replace?: boolean } = {},
): Promise<RestoreResult> {
  // First pass: read everything once (checks the passphrase and the file before any change).
  const collections = new Set<string>();
  let header: Header | null = null;
  for await (const entry of readBackup(file, passphrase)) {
    if ("header" in entry) header = entry.header;
    else collections.add(entry.collection);
  }
  if (!header) throw new Error("Not a RASSM backup file.");

  const notEmpty: string[] = [];
  for (const name of collections) {
    if ((await db.collection(name).estimatedDocumentCount()) > 0) notEmpty.push(name);
  }
  if (notEmpty.length > 0 && !replace) {
    throw new Error(
      `These collections are not empty: ${notEmpty.join(", ")}. Restore into an empty database, or pass --replace.`,
    );
  }
  for (const name of notEmpty) await db.collection(name).deleteMany({});

  const counts: Record<string, number> = {};
  let batch: Doc[] = [];
  let current = "";
  const flush = async () => {
    if (batch.length === 0) return;
    await db.collection(current).insertMany(batch, { ordered: true });
    counts[current] = (counts[current] ?? 0) + batch.length;
    batch = [];
  };
  for await (const entry of readBackup(file, passphrase)) {
    if ("header" in entry) continue;
    if (entry.collection !== current) {
      await flush();
      current = entry.collection;
    }
    batch.push(entry.doc);
    if (batch.length >= INSERT_BATCH) await flush();
  }
  await flush();
  return { header, counts };
}

/** Keeps the `keep` newest backups of `dir`, deletes the older ones. Returns the deleted. */
export async function pruneBackups(dir: string, keep: number): Promise<string[]> {
  const files = (await readdir(dir)).filter((name) => name.startsWith(BACKUP_PREFIX)).sort();
  const old = files.slice(0, Math.max(0, files.length - keep));
  for (const name of old) await rm(path.join(dir, name));
  return old;
}

/** Size of a file in a readable form ("1.2 MB"). */
export async function fileSize(file: string): Promise<string> {
  const { size } = await stat(file);
  return size >= 1024 * 1024
    ? `${(size / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} kB`;
}
