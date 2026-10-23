import { createHash, createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Off-site copy of the backups (pnpm backup): one PUT to an S3-compatible bucket, Backblaze B2
// or Cloudflare R2, signed with AWS Signature Version 4 (no SDK needed for one request).
// The bucket deletes old files itself (lifecycle rule, 14 days, docs/DEPLOYMENT.md), so the key
// only needs to write: on B2 it can be a "Write Only" key, which cannot read or delete backups.

export interface OffsiteStorage {
  /** e.g. https://s3.eu-central-003.backblazeb2.com or https://<account>.r2.cloudflarestorage.com */
  endpoint: string;
  /** Signing region (eu-central-003 for B2, "auto" for R2). */
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Folder inside the bucket, e.g. "rassm/" (may be empty). */
  prefix: string;
}

/**
 * The signing region of an endpoint: the one in a Backblaze B2 address, "auto" for Cloudflare
 * R2, otherwise null (BACKUP_S3_REGION must then be given).
 */
export function regionOfEndpoint(endpoint: string): string | null {
  const host = new URL(endpoint).hostname;
  const b2 = /^s3\.([a-z0-9-]+)\.backblazeb2\.com$/.exec(host);
  if (b2?.[1]) return b2[1];
  if (host.endsWith(".r2.cloudflarestorage.com")) return "auto";
  return null;
}

const sha256 = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string) =>
  createHmac("sha256", key).update(data).digest();

/** RFC 3986 encoding of one path segment (what S3 expects in the canonical request). */
const encodeSegment = (segment: string) =>
  encodeURIComponent(segment).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/** "2013-05-24T00:00:00.000Z" → "20130524T000000Z". */
export const amzDateOf = (date: Date) =>
  date.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");

export interface SignInput {
  method: string;
  /** Full URL whose path is already encoded (encodeSegment), without a query string. */
  url: URL;
  /** Headers to sign, x-amz-date and x-amz-content-sha256 included (host is added). */
  headers: Record<string, string>;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** The Authorization header of an AWS Signature Version 4 request to S3. */
export function signS3Request(input: SignInput): string {
  const headers = new Map<string, string>([["host", input.url.host]]);
  for (const [name, value] of Object.entries(input.headers)) {
    headers.set(name.toLowerCase(), value.trim().replace(/\s+/g, " "));
  }
  const names = [...headers.keys()].sort();
  const amzDate = headers.get("x-amz-date");
  const payloadHash = headers.get("x-amz-content-sha256");
  if (!amzDate || !payloadHash) throw new Error("x-amz-date and x-amz-content-sha256 are required");

  const canonicalRequest = [
    input.method,
    input.url.pathname,
    "",
    ...names.map((name) => `${name}:${headers.get(name)}`),
    "",
    names.join(";"),
    payloadHash,
  ].join("\n");
  const day = amzDate.slice(0, 8);
  const scope = `${day}/${input.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");
  const key = hmac(
    hmac(hmac(hmac(`AWS4${input.secretAccessKey}`, day), input.region), "s3"),
    "aws4_request",
  );
  const signature = createHmac("sha256", key).update(stringToSign).digest("hex");
  return `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}`;
}

/**
 * Uploads a backup file to the bucket (same file name, under the prefix). Throws with the
 * storage's answer when it refuses (wrong key, bucket, region or clock).
 */
export async function uploadToOffsite(
  file: string,
  storage: OffsiteStorage,
  { fetchImpl = fetch, now = new Date() }: { fetchImpl?: typeof fetch; now?: Date } = {},
): Promise<{ object: string; bytes: number }> {
  const body = await readFile(file);
  const object = `${storage.prefix}${path.basename(file)}`;
  const url = new URL(
    `${storage.endpoint.replace(/\/+$/, "")}/${[storage.bucket, ...object.split("/")]
      .map(encodeSegment)
      .join("/")}`,
  );
  const headers: Record<string, string> = {
    "content-type": "application/octet-stream",
    "x-amz-content-sha256": sha256(body),
    "x-amz-date": amzDateOf(now),
  };
  const authorization = signS3Request({ method: "PUT", url, headers, ...storage });
  const response = await fetchImpl(url, {
    method: "PUT",
    headers: { ...headers, authorization },
    body,
  });
  if (!response.ok) {
    const answer = (await response.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
    throw new Error(`Off-site storage refused the backup: HTTP ${response.status} ${answer}`);
  }
  return { object, bytes: body.length };
}
