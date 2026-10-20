import { argon2, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Password hashing with argon2id (built into Node 24), stored in the PHC format:
//   $argon2id$v=19$m=65536,t=3,p=1$<salt base64>$<hash base64>
// Hashes made before (scrypt$N$r$p$salt$hash) are still verified, and replaced by an argon2id
// hash at the next successful login (needsRehash).

interface Argon2Params {
  /** Memory in KiB. */
  m: number;
  /** Passes. */
  t: number;
  /** Parallelism. */
  p: number;
}

/** 64 MiB, 3 passes (RFC 9106 second recommendation, ~250 ms here). */
export const ARGON2_PARAMS: Argon2Params = { m: 65_536, t: 3, p: 1 };
/** The test suite hashes hundreds of passwords: same algorithm, lighter cost. */
const TEST_PARAMS: Argon2Params = { m: 8192, t: 1, p: 1 };
const params = process.env.VITEST ? TEST_PARAMS : ARGON2_PARAMS;
const TAG_LENGTH = 32;

function argon2id(password: string, salt: Buffer, { m, t, p }: Argon2Params): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    argon2(
      "argon2id",
      {
        message: password.normalize("NFKC"),
        nonce: salt,
        memory: m,
        passes: t,
        parallelism: p,
        tagLength: TAG_LENGTH,
      },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await argon2id(password, salt, params);
  return `$argon2id$v=19$m=${params.m},t=${params.t},p=${params.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

function parseArgon2(stored: string) {
  const match = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([^$]+)\$([^$]+)$/.exec(stored);
  if (!match) return null;
  const [, m, t, p, salt, hash] = match;
  return {
    params: { m: Number(m), t: Number(t), p: Number(p) },
    salt: Buffer.from(salt ?? "", "base64"),
    hash: Buffer.from(hash ?? "", "base64"),
  };
}

function scryptKey(password: string, salt: Buffer, N: number, r: number, p: number) {
  const options: ScryptOptions = { N, r, p, maxmem: 128 * N * r * 2 };
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, 64, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

/** Constant-time check. False for a malformed hash. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const argon = parseArgon2(stored);
  if (argon) {
    const key = await argon2id(password, argon.salt, argon.params);
    return key.length === argon.hash.length && timingSafeEqual(key, argon.hash);
  }
  // Legacy scrypt hashes (before argon2id).
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !n || !r || !p || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await scryptKey(
    password,
    Buffer.from(salt, "base64"),
    Number(n),
    Number(r),
    Number(p),
  );
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** True when the hash is not argon2id with the current cost (rehash after a good login). */
export function needsRehash(stored: string): boolean {
  const argon = parseArgon2(stored);
  return (
    !argon ||
    argon.params.m !== params.m ||
    argon.params.t !== params.t ||
    argon.params.p !== params.p
  );
}

/** A valid hash of a random password: verified for unknown e-mails so timing looks the same. */
export const DUMMY_PASSWORD_HASH = await hashPassword(randomBytes(16).toString("hex"));
