import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { offsiteStorageOf, parseEnv } from "../src/env";
import {
  amzDateOf,
  regionOfEndpoint,
  signS3Request,
  uploadToOffsite,
  type OffsiteStorage,
} from "../src/lib/offsite-storage";
import { testApp } from "./helpers";

// Production setup (docs/DEPLOYMENT.md): off-site backups, the cron job's environment, the
// TRUST_PROXY check page, and the hosting files kept in step with package.json.

const ROOT = path.resolve(import.meta.dirname, "../..");

describe("S3 signature (AWS Signature Version 4)", () => {
  // The two examples of the AWS documentation ("Signature calculation: single chunk").
  const aws = {
    region: "us-east-1",
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  };

  it("matches the AWS GET example", () => {
    const authorization = signS3Request({
      ...aws,
      method: "GET",
      url: new URL("https://examplebucket.s3.amazonaws.com/test.txt"),
      headers: {
        range: "bytes=0-9",
        "x-amz-content-sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "x-amz-date": "20130524T000000Z",
      },
    });
    expect(authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
    );
  });

  it("matches the AWS PUT example", () => {
    const authorization = signS3Request({
      ...aws,
      method: "PUT",
      url: new URL("https://examplebucket.s3.amazonaws.com/test%24file.text"),
      headers: {
        date: "Fri, 24 May 2013 00:00:00 GMT",
        "x-amz-storage-class": "REDUCED_REDUNDANCY",
        "x-amz-content-sha256": "44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072",
        "x-amz-date": "20130524T000000Z",
      },
    });
    expect(authorization).toMatch(
      /Signature=98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd$/,
    );
  });

  it("finds the region of Backblaze B2 and Cloudflare R2 endpoints", () => {
    expect(regionOfEndpoint("https://s3.eu-central-003.backblazeb2.com")).toBe("eu-central-003");
    expect(regionOfEndpoint("https://abc123.r2.cloudflarestorage.com")).toBe("auto");
    expect(regionOfEndpoint("https://storage.example.net")).toBeNull();
    expect(amzDateOf(new Date("2026-10-24T02:00:05.123Z"))).toBe("20261024T020005Z");
  });
});

describe("off-site copy of a backup", () => {
  let dir = "";
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  const storage: OffsiteStorage = {
    endpoint: "https://s3.eu-central-003.backblazeb2.com",
    region: "eu-central-003",
    bucket: "rassm-backups",
    accessKeyId: "0031a2b3c4d5e6f0000000001",
    secretAccessKey: "K003abcdefghijklmnopqrstuvwxyz0123",
    prefix: "rassm/",
  };

  async function backupFile() {
    dir = await mkdtemp(path.join(tmpdir(), "rassm-offsite-"));
    const file = path.join(dir, "rassm-backup-2026-10-24T02-00-00Z.ndjson.gz.enc");
    await writeFile(file, Buffer.from("RASSMBK1 encrypted bytes"));
    return file;
  }

  it("sends one signed PUT with the file, under the prefix", async () => {
    const file = await backupFile();
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: URL, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response("", { status: 200 });
    }) as unknown as typeof fetch;

    const result = await uploadToOffsite(file, storage, {
      fetchImpl,
      now: new Date("2026-10-24T02:00:05Z"),
    });

    expect(result).toEqual({
      object: "rassm/rassm-backup-2026-10-24T02-00-00Z.ndjson.gz.enc",
      bytes: 24,
    });
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.url).toBe(
      "https://s3.eu-central-003.backblazeb2.com/rassm-backups/rassm/rassm-backup-2026-10-24T02-00-00Z.ndjson.gz.enc",
    );
    expect(call?.init.method).toBe("PUT");
    const headers = call?.init.headers as Record<string, string>;
    expect(headers["x-amz-date"]).toBe("20261024T020005Z");
    expect(headers.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=0031a2b3c4d5e6f0000000001\/20261024\/eu-central-003\/s3\/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/,
    );
    expect(Buffer.from(call?.init.body as Uint8Array).toString()).toBe(
      (await readFile(file)).toString(),
    );
  });

  it("fails loudly when the storage refuses (so the cron run fails and Render e-mails)", async () => {
    const file = await backupFile();
    const fetchImpl = (async () =>
      new Response("<Error><Code>InvalidAccessKeyId</Code></Error>", {
        status: 403,
      })) as unknown as typeof fetch;
    await expect(uploadToOffsite(file, storage, { fetchImpl })).rejects.toThrow(
      /HTTP 403.*InvalidAccessKeyId/,
    );
  });
});

describe("backup environment", () => {
  const strong = "Vq7r-L2xK9mPz4Tw8Nc5Hb3Jd6Ys1Fg0";
  // Exactly what the Render cron job has (render.yaml): no web server settings.
  const cron = {
    NODE_ENV: "production",
    MONGODB_URI: `mongodb+srv://rassm-backup:${strong}@cluster0.ab12cd.mongodb.net/`,
    FRONTEND_ORIGIN: "https://rassmstore.live",
    BACKUP_PASSPHRASE: "five random words for backups",
    BACKUP_S3_ENDPOINT: "https://s3.eu-central-003.backblazeb2.com",
    BACKUP_S3_BUCKET: "rassm-backups",
    BACKUP_S3_ACCESS_KEY_ID: "0031a2b3c4d5e6f0000000001",
    BACKUP_S3_SECRET_ACCESS_KEY: "K003abcdefghijklmnopqrstuvwxyz0123",
    BACKUP_S3_PREFIX: "rassm/",
  };

  it("lets the backup task run without the web server settings, never the API", () => {
    const env = parseEnv(cron, "task");
    expect(offsiteStorageOf(env)).toMatchObject({
      region: "eu-central-003",
      bucket: "rassm-backups",
      prefix: "rassm/",
    });
    expect(() => parseEnv(cron)).toThrow(/TRUST_PROXY[\s\S]*ADMIN_PROXY_SECRET[\s\S]*ADMIN_URL/);
  });

  it("keeps the other production checks for the task", () => {
    expect(() =>
      parseEnv(
        { ...cron, MONGODB_URI: "mongodb+srv://u:password@cluster0.ab12cd.mongodb.net/" },
        "task",
      ),
    ).toThrow(/MONGODB_URI/);
    expect(() => parseEnv({ ...cron, NODE_ENV: "development" }, "task")).toThrow(/NODE_ENV/);
  });

  it("needs all of the bucket settings or none", () => {
    const { BACKUP_S3_SECRET_ACCESS_KEY: _secret, ...missing } = cron;
    expect(() => parseEnv(missing, "task")).toThrow(/BACKUP_S3_SECRET_ACCESS_KEY/);
    expect(() =>
      parseEnv({ ...cron, BACKUP_S3_ENDPOINT: "https://storage.example.net" }, "task"),
    ).toThrow(/BACKUP_S3_REGION/);
    expect(() =>
      parseEnv(
        { ...cron, BACKUP_S3_ENDPOINT: "https://storage.example.net", BACKUP_S3_REGION: "eu-1" },
        "task",
      ),
    ).not.toThrow();
    expect(() => parseEnv({ ...cron, BACKUP_S3_PREFIX: "../" }, "task")).toThrow(
      /BACKUP_S3_PREFIX/,
    );
    const {
      BACKUP_S3_ENDPOINT: _e,
      BACKUP_S3_BUCKET: _b,
      BACKUP_S3_ACCESS_KEY_ID: _k,
      BACKUP_S3_SECRET_ACCESS_KEY: _s,
      ...none
    } = cron;
    expect(offsiteStorageOf(parseEnv(none, "task"))).toBeNull();
  });
});

describe("GET /health/ip (TRUST_PROXY check)", () => {
  it("shows the IP the API sees and the X-Forwarded-For entries", async () => {
    const { api } = testApp({ trustProxy: 1 });
    const res = await api.get("/health/ip").set("X-Forwarded-For", "203.0.113.9, 41.200.10.20");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    // One proxy trusted: the entry it added (the last one), never the one a visitor wrote.
    expect(res.body).toEqual({ ip: "41.200.10.20", forwardedFor: ["203.0.113.9", "41.200.10.20"] });
  });
});

describe("hosting files", () => {
  it("use the pnpm and Node.js versions of the repository", async () => {
    const pkg = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8")) as {
      packageManager: string;
      engines: { node: string };
    };
    const render = await readFile(path.join(ROOT, "render.yaml"), "utf8");
    const vercel = await readFile(path.join(ROOT, "frontend/vercel.json"), "utf8");
    const nodeVersion = (await readFile(path.join(ROOT, ".node-version"), "utf8")).trim();

    const pnpm = pkg.packageManager.replace(/\+.*$/, "");
    for (const file of [render, vercel]) {
      const used = [...file.matchAll(/npx --yes (pnpm@[\d.]+)/g)].map((match) => match[1]);
      expect(used.length).toBeGreaterThan(0);
      expect(new Set(used)).toEqual(new Set([pnpm]));
    }
    expect(nodeVersion).toMatch(/^24\.\d+\.\d+$/);
    expect(pkg.engines.node).toBe("24.x");
    // Both Render services: Frankfurt, always on, health check on the API.
    expect(render.match(/region: frankfurt/g)).toHaveLength(2);
    expect(render).toContain("healthCheckPath: /health");
    expect(JSON.parse(vercel)).toMatchObject({ regions: ["fra1"] });
  });
});
