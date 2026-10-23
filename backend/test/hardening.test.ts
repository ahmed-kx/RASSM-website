import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ADMIN_CSRF_HEADER, MIN_FORM_FILL_MS } from "@rassm/shared";
import mongoose from "mongoose";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pruneBackups, restoreBackup, writeBackup } from "../src/backup";
import { parseEnv, weakSecretReason } from "../src/env";
import { stripImageMetadata } from "../src/lib/image-metadata";
import { maskPhone, redact, redactText } from "../src/lib/logger";
import { limitRequests } from "../src/middleware/security";
import { BlacklistModel } from "../src/models/blacklist";
import { ContactMessageModel } from "../src/models/contact-message";
import { NewsletterSubscriberModel } from "../src/models/newsletter-subscriber";
import { OrderModel } from "../src/models/order";
import { ProductModel } from "../src/models/product";
import { adminRouter } from "../src/routes/admin";
import { MAX_ORDERS_PER_PHONE_PER_DAY, PHONE_LIMIT_MESSAGE } from "../src/services/fraud";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ORIGIN,
  TEST_ADMIN_URL,
  adminAgent,
  createTestAdmin,
  csrfFrom,
  fakeImageStorage,
  fakeMetaEvents,
  fakeNewsletterList,
  fakeRevalidator,
  fakeSecurityMailer,
  orderBody,
  testApp,
} from "./helpers";

// Site-wide hardening: CSRF, headers, every admin route behind a session, bot timing, phone
// normalisation, uploads, private fields, rate limits, logs, production env, backups.

afterEach(() => {
  vi.restoreAllMocks();
});

const contactBody = (extra: Record<string, unknown> = {}) => ({
  firstName: "Lina",
  lastName: "Mansouri",
  phone: "0661 22 33 44",
  subject: "order",
  message: "Bonjour, ma commande arrive quand ?",
  elapsedMs: 15_000,
  ...extra,
});

describe("CSRF (admin changes)", () => {
  it("needs the site's Origin and the session's token on every change", async () => {
    const { app } = testApp();
    await createTestAdmin();
    const agent = request.agent(app);
    const login = await agent
      .post("/api/admin/auth/login")
      .set("Origin", ORIGIN)
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);
    const token = csrfFrom(login) ?? "";
    expect(token).toMatch(/^[\w-]{40,}$/);
    // Readable by the dashboard (no HttpOnly), never sent by other sites.
    const cookie = ([] as string[])
      .concat(login.headers["set-cookie"] ?? [])
      .find((line) => line.startsWith("rassm_csrf="));
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).not.toMatch(/HttpOnly/);

    const change = () => agent.put("/api/admin/settings").send({ lowStockThreshold: 7 });
    // No token, a wrong token, no Origin, another site: refused.
    const missing = await change().set("Origin", ORIGIN).expect(403);
    expect(missing.body.error.message).toBe("Requête refusée. Rechargez la page puis réessayez.");
    await change()
      .set("Origin", ORIGIN)
      .set(ADMIN_CSRF_HEADER, `${token.slice(0, -2)}xx`)
      .expect(403);
    await change().set(ADMIN_CSRF_HEADER, token).expect(403);
    await change().set("Origin", "https://evil.example").set(ADMIN_CSRF_HEADER, token).expect(403);
    await change()
      .set("Origin", ORIGIN)
      .set("Sec-Fetch-Site", "cross-site")
      .set(ADMIN_CSRF_HEADER, token)
      .expect(403);
    // The right one: accepted. Reading needs no token.
    await change().set("Origin", ORIGIN).set(ADMIN_CSRF_HEADER, token).expect(200);
    await agent.get("/api/admin/settings").expect(200);
  });

  it("gives the token back when the browser lost it, and clears it at logout", async () => {
    const { app } = testApp();
    const agent = await adminAgent(app);
    const session = await agent.get("/api/admin/auth/me").expect(200);
    expect(csrfFrom(session)).toBeNull(); // already has the right one

    // A session cookie alone (cookie cleared, session opened before CSRF tokens existed).
    const cookies = ([] as string[]).concat(
      (
        await request(app)
          .post("/api/admin/auth/login")
          .set("Origin", ORIGIN)
          .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      ).headers["set-cookie"] ?? [],
    );
    const sessionOnly =
      cookies.find((line) => line.startsWith("rassm_admin="))?.split(";")[0] ?? "";
    const renewed = await request(app)
      .get("/api/admin/auth/me")
      .set("Cookie", sessionOnly)
      .expect(200);
    const token = csrfFrom(renewed);
    expect(token).toBeTruthy();
    await request(app)
      .put("/api/admin/settings")
      .set("Cookie", sessionOnly)
      .set("Origin", ORIGIN)
      .set(ADMIN_CSRF_HEADER, token ?? "")
      .send({ lowStockThreshold: 8 })
      .expect(200);

    const logout = await agent.post("/api/admin/auth/logout").expect(200);
    expect(String(logout.headers["set-cookie"])).toMatch(/rassm_csrf=;/);
  });
});

describe("every admin route needs a session", () => {
  it("answers 401 on all of them except login, logout and the password reset", async () => {
    const { api } = testApp();
    const limiter = limitRequests({ windowMs: 60_000, limit: 1000 });
    const router = adminRouter({
      allowedOrigins: [ORIGIN],
      secureCookies: false,
      loginLimiter: limiter,
      passwordLimiter: () => limiter,
      adminLimiter: limiter,
      sensitiveLimiter: () => limiter,
      mailer: fakeSecurityMailer(),
      adminUrl: TEST_ADMIN_URL,
      metaEvents: fakeMetaEvents(),
      revalidator: fakeRevalidator(),
      imageStorage: fakeImageStorage(),
      newsletterList: fakeNewsletterList(),
    });
    const routes = (
      router.stack as { route?: { path: string; methods: Record<string, boolean> } }[]
    ).flatMap((layer) =>
      layer.route
        ? Object.keys(layer.route.methods).map(
            (method) => [method, layer.route?.path ?? ""] as const,
          )
        : [],
    );
    const open = ["/auth/login", "/auth/logout", "/auth/password/forgot", "/auth/password/reset"];
    const protectedRoutes = routes.filter(([, route]) => !open.includes(route));
    expect(protectedRoutes.length).toBeGreaterThan(40);
    expect(routes.filter(([, route]) => open.includes(route))).toHaveLength(open.length);

    for (const [method, route] of protectedRoutes) {
      const url = `/api/admin${route
        .replace(":id", "6710f0c2a1b2c3d4e5f60718")
        .replace(":phone", "0555123456")
        .replace(":code", "16")}`;
      const call = (api as unknown as Record<string, (url: string) => request.Test>)[method];
      if (!call) throw new Error(`No supertest method ${method}`);
      const res = await call(url).set("Origin", ORIGIN);
      expect(res.status, `${method.toUpperCase()} ${url}`).toBe(401);
      expect(res.body).toEqual({ error: { message: "Veuillez vous connecter." } });
    }
  });
});

describe("security headers (API)", () => {
  it("sends a strict policy: nothing rendered, framed or sniffed", async () => {
    const { api } = testApp();
    const res = await api.get("/api/delivery-fees").expect(200);
    expect(res.headers["content-security-policy"]).toBe(
      "default-src 'none';frame-ancestors 'none';base-uri 'none';form-action 'none'",
    );
    expect(res.headers["strict-transport-security"]).toBe("max-age=63072000; includeSubDomains");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("bot timing (forms sent in under 2 seconds)", () => {
  it("keeps such orders, flagged « suspecte » with the reason", async () => {
    const { api } = testApp();
    await api.post("/api/orders").send(orderBody({ phone: "0555000001" }, { elapsedMs: 800 }));
    await api.post("/api/orders").send({ order: orderBody({ phone: "0555000002" }).order });
    await api
      .post("/api/orders")
      .send(orderBody({ phone: "0555000003" }, { elapsedMs: MIN_FORM_FILL_MS + 500 }));
    const byPhone = Object.fromEntries(
      (await OrderModel.find().lean()).map((order) => [order.phone, order]),
    );
    expect(byPhone["0555000001"]).toMatchObject({
      suspicious: true,
      suspiciousReason: "Formulaire envoyé en 0,8 s (robot probable)",
    });
    expect(byPhone["0555000002"]).toMatchObject({
      suspicious: true,
      suspiciousReason: "Envoyé sans passer par le formulaire du site (robot probable)",
    });
    expect(byPhone["0555000003"]).toMatchObject({ suspicious: false, suspiciousReason: null });
  });

  it("keeps fast contact messages « Suspect » and fast sign-ups out of Brevo", async () => {
    const newsletterList = fakeNewsletterList();
    const { app, api, messageNotifier } = testApp({ newsletterList });
    await api
      .post("/api/contact-messages")
      .send(contactBody({ elapsedMs: 500 }))
      .expect(201);
    expect(await ContactMessageModel.findOne().lean()).toMatchObject({
      suspicious: true,
      suspiciousReason: "Formulaire envoyé en 0,5 s (robot probable)",
    });
    await vi.waitFor(() => expect(messageNotifier.notifyNewMessage).toHaveBeenCalled());

    await api
      .post("/api/newsletter")
      .send({ email: "bot@example.com", elapsedMs: 300 })
      .expect(201);
    await api.post("/api/newsletter").send({ email: "humain@example.com", elapsedMs: 20_000 });
    await vi.waitFor(() => expect(newsletterList.add).toHaveBeenCalledWith("humain@example.com"));
    expect(newsletterList.add).toHaveBeenCalledTimes(1);
    expect(
      await NewsletterSubscriberModel.findOne({ email: "bot@example.com" }).lean(),
    ).toMatchObject({ suspicious: true, brevo: { status: "failed" } });

    const agent = await adminAgent(app);
    const messages = await agent.get("/api/admin/messages").expect(200);
    expect(messages.body.messages[0]).toMatchObject({ suspicious: true });
  });

  it("ignores a filled honeypot on the newsletter (nothing saved)", async () => {
    const { api } = testApp();
    await api
      .post("/api/newsletter")
      .send({ email: "bot@example.com", website: "http://spam", elapsedMs: 9000 })
      .expect(201, { ok: true });
    expect(await NewsletterSubscriberModel.countDocuments()).toBe(0);
  });
});

describe("phone numbers, normalised before every check", () => {
  it("stores +213 / 00213 / spaced numbers the same way, for duplicates and the blacklist", async () => {
    const { app, api } = testApp();
    const agent = await adminAgent(app);
    await agent
      .post("/api/admin/blacklist")
      .send({ phone: "+213 661 00 00 09", reason: "Colis refusé" })
      .expect(201);
    expect(await BlacklistModel.findOne().lean()).toMatchObject({ phone: "0661000009" });

    const first = await api
      .post("/api/orders")
      .send(orderBody({ phone: "00213-661-00-00-09" }))
      .expect(201);
    expect(first.body.order.phone).toBe("0661000009");
    // Same number written another way + same product: a duplicate.
    await api
      .post("/api/orders")
      .send(orderBody({ phone: "0661 00 00 09" }))
      .expect(201);
    expect(await OrderModel.countDocuments()).toBe(1);

    const list = await agent.get("/api/admin/orders").expect(200);
    expect(list.body.orders[0].blacklist).toMatchObject({ reason: "Colis refusé" });
    // Removed with any writing of the number.
    await agent.delete(`/api/admin/blacklist/${encodeURIComponent("+213661000009")}`).expect(200);
    expect(await BlacklistModel.countDocuments()).toBe(0);
  });

  it(`refuses more than ${MAX_ORDERS_PER_PHONE_PER_DAY} orders per phone in 24 hours`, async () => {
    const { api } = testApp();
    for (let i = 0; i < MAX_ORDERS_PER_PHONE_PER_DAY; i++) {
      await api
        .post("/api/orders")
        .send(orderBody({ phone: "0770 11 22 33" }))
        .expect(201);
      // Older than the 30-minute duplicate window, still within 24 hours (native update:
      // Mongoose keeps createdAt immutable).
      await OrderModel.collection.updateMany(
        {},
        { $set: { createdAt: new Date(Date.now() - 3_600_000) } },
      );
    }
    const refused = await api
      .post("/api/orders")
      .send(orderBody({ phone: "+213770112233" }))
      .expect(429);
    expect(refused.body.error).toEqual({
      message: PHONE_LIMIT_MESSAGE,
      fields: { phone: PHONE_LIMIT_MESSAGE },
    });
    expect(await OrderModel.countDocuments()).toBe(MAX_ORDERS_PER_PHONE_PER_DAY);
  });
});

// ---------- Uploads ----------

/** A small JPEG whose EXIF holds the orientation (6) and a fake GPS text in the "Make" tag. */
function jpegWithExif(): Buffer {
  const secret = Buffer.from("GPS-SECRET-36.7538N\0", "latin1");
  const tiff = Buffer.alloc(8 + 2 + 2 * 12 + 4);
  tiff.write("II", 0, "latin1");
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(2, 8);
  // Make (ASCII), stored after the IFD.
  tiff.writeUInt16LE(0x010f, 10);
  tiff.writeUInt16LE(2, 12);
  tiff.writeUInt32LE(secret.length, 14);
  tiff.writeUInt32LE(tiff.length, 18);
  // Orientation = 6 (rotated phone photo).
  tiff.writeUInt16LE(0x0112, 22);
  tiff.writeUInt16LE(3, 24);
  tiff.writeUInt32LE(1, 26);
  tiff.writeUInt16LE(6, 30);
  const exif = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff, secret]);
  const segment = (marker: number, data: Buffer) => {
    const head = Buffer.from([0xff, marker, 0, 0]);
    head.writeUInt16BE(data.length + 2, 2);
    return Buffer.concat([head, data]);
  };
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    segment(0xe0, Buffer.from("JFIF\0\x01\x01\0\0\x01\0\x01\0\0", "latin1")),
    segment(0xe1, exif),
    segment(0xfe, Buffer.from("Shot by Lina at home", "latin1")),
    segment(0xdb, Buffer.alloc(65, 1)),
    Buffer.from([0xff, 0xda, 0x00, 0x08, 1, 2, 3, 4, 5, 6, 0x11, 0x22, 0xff, 0xd9]),
  ]);
}

const PNG_1PX =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function pngChunk(type: string, data: Buffer) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "latin1");
  return Buffer.concat([head, data, Buffer.alloc(4)]);
}

describe("photo uploads", () => {
  it("removes GPS, camera and comments from a JPEG and keeps its orientation", async () => {
    const { app, imageStorage } = testApp();
    const agent = await adminAgent(app);
    await agent.post("/api/admin/uploads").attach("image", jpegWithExif(), "photo.jpg").expect(201);
    const stored = imageStorage.upload.mock.calls[0]?.[0] ?? Buffer.alloc(0);
    expect(stored.includes(Buffer.from("GPS-SECRET"))).toBe(false);
    expect(stored.includes(Buffer.from("Shot by Lina"))).toBe(false);
    // Orientation entry (big-endian): tag 0x0112, SHORT, count 1, value 6.
    expect(stored.includes(Buffer.from([0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6]))).toBe(true);
    expect(stored.subarray(-2).equals(Buffer.from([0xff, 0xd9]))).toBe(true);
  });

  it("checks the real type from the bytes and refuses broken files", async () => {
    const { app, imageStorage } = testApp();
    const agent = await adminAgent(app);
    // A script named .jpg, an SVG, a PNG signature with broken chunks.
    for (const [file, name] of [
      [Buffer.from("<?php system($_GET['c']); ?>"), "photo.jpg"],
      [
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
        "x.png",
      ],
      [
        Buffer.concat([Buffer.from(PNG_1PX, "base64").subarray(0, 8), Buffer.alloc(30, 0xff)]),
        "x.png",
      ],
    ] as const) {
      const res = await agent.post("/api/admin/uploads").attach("image", file, name).expect(415);
      expect(res.body.error.message).toBe(
        "Format non accepté : photo JPG, PNG ou WebP uniquement.",
      );
    }
    expect(imageStorage.upload).not.toHaveBeenCalled();
  });

  it("strips PNG texts and WebP EXIF / XMP", () => {
    const png = Buffer.from(PNG_1PX, "base64");
    const withText = Buffer.concat([
      png.subarray(0, 33),
      pngChunk("tEXt", Buffer.from("Author\0Lina, GPS 36.75", "latin1")),
      pngChunk("eXIf", Buffer.from("MM\0*secret", "latin1")),
      png.subarray(33),
    ]);
    const cleanPng = stripImageMetadata(withText, "image/png");
    expect(cleanPng.equals(png)).toBe(true);

    const chunk = (type: string, data: Buffer) => {
      const head = Buffer.alloc(8);
      head.write(type, 0, "latin1");
      head.writeUInt32LE(data.length, 4);
      return Buffer.concat([head, data, Buffer.alloc(data.length % 2)]);
    };
    const vp8x = Buffer.alloc(10);
    vp8x[0] = 0x0c; // EXIF + XMP flags
    const body = Buffer.concat([
      chunk("VP8X", vp8x),
      chunk("VP8 ", Buffer.alloc(12, 7)),
      chunk("EXIF", Buffer.from("GPS-SECRET", "latin1")),
      chunk("XMP ", Buffer.from("<x:xmpmeta>owner</x:xmpmeta>", "latin1")),
    ]);
    const riff = Buffer.alloc(12);
    riff.write("RIFF", 0, "latin1");
    riff.writeUInt32LE(body.length + 4, 4);
    riff.write("WEBP", 8, "latin1");
    const clean = stripImageMetadata(Buffer.concat([riff, body]), "image/webp");
    expect(clean.includes(Buffer.from("GPS-SECRET"))).toBe(false);
    expect(clean.includes(Buffer.from("xmpmeta"))).toBe(false);
    expect(clean.readUInt32LE(4)).toBe(clean.length - 8);
    expect((clean[20] ?? 0xff) & 0x0c).toBe(0);
  });
});

describe("public routes expose public data only", () => {
  it("never sends cost prices, internal numbers, IPs, history or notes", async () => {
    const { api } = testApp();
    await ProductModel.updateMany({}, { $set: { costPrice: 2100 } });
    const list = await api.get("/api/products").expect(200);
    const one = await api.get("/api/products/fragment-sweatshirt").expect(200);
    for (const body of [list.text, one.text]) {
      expect(body).not.toMatch(/costPrice|2100|unitCost/);
    }

    const placed = await api
      .post("/api/orders")
      .set("X-Forwarded-For", "203.0.113.9")
      .send(orderBody())
      .expect(201);
    await OrderModel.updateMany({}, { $set: { adminNote: "Client difficile" } });
    expect(Object.keys(placed.body).sort()).toEqual(["eventId", "order"]);
    expect(placed.text).not.toMatch(
      /orderNumber|RSM-|client|"ip"|history|adminNote|suspicious|unitCost|costs|tracking|stockReserved/,
    );
    await api.post("/api/contact-messages").send(contactBody()).expect(201, { ok: true });
    await api
      .post("/api/newsletter")
      .send({ email: "a@example.com", elapsedMs: 9000 })
      .expect(201, {
        ok: true,
      });
  });

  it("answers unexpected errors without details", async () => {
    const { api } = testApp();
    vi.spyOn(ProductModel, "find").mockImplementationOnce(() => {
      throw new TypeError(
        "Cannot read properties of undefined (reading 'secretField') at /srv/app",
      );
    });
    const res = await api.get("/api/products").expect(500);
    expect(res.body).toEqual({
      error: { message: "Une erreur est survenue. Veuillez réessayer dans un instant." },
    });
  });
});

describe("rate limits", () => {
  it("limits the catalog, the exports and every route per IP", async () => {
    const { api } = testApp({ rateLimits: { catalog: { windowMs: 60_000, limit: 2 } } });
    await api.get("/api/delivery-fees").expect(200);
    await api.get("/api/products").expect(200);
    await api.get("/api/products").expect(429);

    const sensitive = testApp({ rateLimits: { sensitive: { windowMs: 60_000, limit: 1 } } });
    const agent = await adminAgent(sensitive.app);
    await agent.get("/api/admin/clients/export").expect(200);
    await agent.get("/api/admin/clients/export").expect(429);
    await agent.get("/api/admin/subscribers/export").expect(200);

    const global = testApp({ rateLimits: { global: { windowMs: 60_000, limit: 2 } } });
    await global.api.get("/api/nope").expect(404);
    await global.api.get("/api/nope").expect(404);
    const res = await global.api.get("/api/delivery-fees").expect(429);
    expect(res.body.error.message).toMatch(/^Trop de tentatives/);
  });
});

describe("logs", () => {
  it("mask phone numbers and never contain secrets", () => {
    expect(maskPhone("0555123456")).toBe("05••••••56");
    expect(
      redactText(
        'dup key: { phone: "0555123456" } +213 661 22 33 44 mongodb+srv://rassm:S3cr3t-pass@cluster0.example.mongodb.net/db https://graph.facebook.com/v23.0/1/events?access_token=EAAB123 xkeysib-abc123-def',
      ),
    ).toBe(
      'dup key: { phone: "05••••••56" } 21••••••44 mongodb+srv://[redacted]@cluster0.example.mongodb.net/db https://graph.facebook.com/v23.0/1/events?access_token=[redacted] [redacted]',
    );
    expect(
      redact({
        phone: "0661 22 33 44",
        address: "Cité 1200 logements",
        password: "x",
        token: "abc",
        nested: { apiKey: "k", link: "https://rassm.dz/admin/nouveau-mot-de-passe#jeton=abc" },
        orderNumber: "RSM-000123",
        ip: "203.0.113.9",
        documents: { adminpasswordresets: 0, orders: 2 },
        newPassword: "x",
        deviceToken: "x",
      }),
    ).toEqual({
      phone: "06••••••44",
      address: "[redacted]",
      password: "[redacted]",
      token: "[redacted]",
      nested: { apiKey: "[redacted]", link: "[redacted]" },
      orderNumber: "RSM-000123",
      ip: "203.0.113.9",
      documents: { adminpasswordresets: 0, orders: 2 },
      newPassword: "[redacted]",
      deviceToken: "[redacted]",
    });
  });
});

describe("production environment", () => {
  const strong = "Vq7r-L2xK9mPz4Tw8Nc5Hb3Jd6Ys1Fg0";
  const base = {
    NODE_ENV: "production",
    MONGODB_URI: `mongodb+srv://rassm-api:${strong}@cluster0.ab12cd.mongodb.net/`,
    FRONTEND_ORIGIN: "https://rassm.dz,https://www.rassm.dz",
    ADMIN_URL: "https://rassm.dz/admin",
    REVALIDATE_SECRET: strong,
  };

  it("starts with strong secrets and https URLs", () => {
    expect(() => parseEnv(base)).not.toThrow();
    expect(weakSecretReason(strong, 32)).toBeNull();
  });

  it("refuses weak, example or local values", () => {
    const refused = (override: Record<string, string>) =>
      expect(() => parseEnv({ ...base, ...override }), JSON.stringify(override)).toThrow();
    refused({ MONGODB_URI: "mongodb+srv://user:password@cluster0.ab12cd.mongodb.net/" });
    refused({ MONGODB_URI: "mongodb+srv://user:short@cluster0.ab12cd.mongodb.net/" });
    refused({ MONGODB_URI: "mongodb://localhost:27017/" });
    refused({ MONGODB_URI: `mongodb+srv://u:${strong}@cluster0.example.mongodb.net/` });
    refused({ FRONTEND_ORIGIN: "http://rassm.dz" });
    refused({ ADMIN_URL: "http://localhost:3000/admin" });
    refused({ REVALIDATE_SECRET: "changeme-changeme-changeme-changeme" });
    refused({ REVALIDATE_SECRET: "a".repeat(40) });
    refused({ BREVO_API_KEY: "xkeysib-test-0123456789abcdef" });
    refused({ CLOUDINARY_API_SECRET: "your-api-secret-here-1234" });
    refused({ META_CAPI_ACCESS_TOKEN: "placeholder-token-123456789" });
    refused({ META_CAPI_ACCESS_TOKEN: "x".repeat(40) + "-not-a-token" });
    // Real tokens: long letters and digits, with or without the usual EAA prefix.
    expect(() =>
      parseEnv({ ...base, META_CAPI_ACCESS_TOKEN: "EAAG" + "Zq7rL2xK9mPz4Tw8".repeat(12) }),
    ).not.toThrow();
    expect(() =>
      parseEnv({ ...base, META_CAPI_ACCESS_TOKEN: "Q" + "Zq7rL2xK9mPz4Tw8".repeat(12) }),
    ).not.toThrow();
    // Development keeps working with local values.
    expect(() =>
      parseEnv({
        MONGODB_URI: "mongodb://127.0.0.1:27017/",
        FRONTEND_ORIGIN: "http://localhost:3000",
      }),
    ).not.toThrow();
  });
});

describe("backups", () => {
  it("saves every collection (encrypted) and restores it exactly", async () => {
    const { api } = testApp();
    await createTestAdmin();
    await api.post("/api/orders").send(orderBody()).expect(201);
    const db = mongoose.connection.db;
    if (!db) throw new Error("No test database");
    const dir = await mkdtemp(path.join(tmpdir(), "rassm-backup-"));
    try {
      const order = await OrderModel.findOne().lean();
      const backup = await writeBackup(db, dir, { passphrase: "une phrase de passe longue" });
      expect(backup.encrypted).toBe(true);
      expect(backup.counts).toMatchObject({ orders: 1, admins: 1 });
      expect(backup.counts.products).toBeGreaterThan(0);
      expect(backup.file).toMatch(/rassm-backup-\d{4}-\d\d-\d\dT\d\d-\d\d-\d\dZ\.ndjson\.gz\.enc$/);

      // Wrong passphrase, or a database that is not empty: nothing happens.
      await expect(
        restoreBackup(db, backup.file, { passphrase: "pas la bonne phrase" }),
      ).rejects.toThrow();
      await expect(
        restoreBackup(db, backup.file, { passphrase: "une phrase de passe longue" }),
      ).rejects.toThrow(/not empty/);
      expect(await OrderModel.countDocuments()).toBe(1);

      await db.dropDatabase();
      const restored = await restoreBackup(db, backup.file, {
        passphrase: "une phrase de passe longue",
      });
      expect(restored.counts).toEqual(
        Object.fromEntries(Object.entries(backup.counts).filter(([, count]) => count > 0)),
      );
      // Same document, same types (dates, ObjectIds).
      expect(await OrderModel.findOne().lean()).toEqual(order);

      // Unencrypted backups too; only the newest ones are kept.
      const plain = await writeBackup(db, dir, { now: new Date("2020-01-01T00:00:00Z") });
      await writeFile(path.join(dir, "notes.txt"), "keep me");
      expect(await pruneBackups(dir, 1)).toEqual([path.basename(plain.file)]);
      expect((await readdir(dir)).sort()).toEqual([path.basename(backup.file), "notes.txt"].sort());
      await restoreBackup(db, backup.file, {
        passphrase: "une phrase de passe longue",
        replace: true,
      });
      expect(await OrderModel.countDocuments()).toBe(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
