import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/env";
import { OrderModel } from "../src/models/order";
import { orderBody, testApp } from "./helpers";

describe("security", () => {
  it("rate limits orders per IP, in French", async () => {
    const { api } = testApp({ rateLimits: { orders: { windowMs: 60_000, limit: 2 } } });
    await api
      .post("/api/orders")
      .send(orderBody({ phone: "0555000001" }))
      .expect(201);
    await api
      .post("/api/orders")
      .send(orderBody({ phone: "0555000002" }))
      .expect(201);
    const res = await api
      .post("/api/orders")
      .send(orderBody({ phone: "0555000003" }))
      .expect(429);
    expect(res.body.error.message).toBe(
      "Trop de tentatives depuis votre connexion. Veuillez réessayer dans quelques minutes.",
    );
    expect(await OrderModel.countDocuments()).toBe(2);
  });

  it("rate limits contact messages and newsletter sign-ups", async () => {
    const { api } = testApp({
      rateLimits: {
        contact: { windowMs: 60_000, limit: 1 },
        newsletter: { windowMs: 60_000, limit: 1 },
      },
    });
    await api.post("/api/newsletter").send({ email: "a@example.com" }).expect(201);
    await api.post("/api/newsletter").send({ email: "b@example.com" }).expect(429);
    await api.post("/api/contact-messages").send({}).expect(400);
    await api.post("/api/contact-messages").send({}).expect(429);
  });

  it("refuses MongoDB operators in the body (NoSQL injection)", async () => {
    const { api } = testApp();
    const res = await api
      .post("/api/orders")
      .send(orderBody({ productId: { $gt: "" } } as Record<string, unknown>))
      .expect(400);
    expect(res.body).toEqual({ error: { message: "Requête invalide." } });
    await api
      .post("/api/newsletter")
      .send({ email: { $ne: null } })
      .expect(400);
  });

  it("answers invalid JSON, big bodies and unknown routes in French without details", async () => {
    const { api } = testApp();
    const invalid = await api
      .post("/api/orders")
      .set("Content-Type", "application/json")
      .send("{not json")
      .expect(400);
    expect(invalid.body).toEqual({ error: { message: "Requête invalide." } });

    const big = await api
      .post("/api/contact-messages")
      .send({ message: "x".repeat(30_000) })
      .expect(413);
    expect(big.body.error.message).toBe("Votre demande est trop volumineuse.");

    await api.get("/api/nope").expect(404, { error: { message: "Ressource introuvable." } });
  });

  it("allows CORS for the website origin only, and sets security headers", async () => {
    const { api } = testApp();
    const allowed = await api.get("/api/delivery-fees").set("Origin", "http://localhost:3000");
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(allowed.headers["x-content-type-options"]).toBe("nosniff");
    expect(allowed.headers["x-powered-by"]).toBeUndefined();
    const other = await api.get("/api/delivery-fees").set("Origin", "https://evil.example");
    expect(other.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("environment", () => {
  const valid = {
    MONGODB_URI: "mongodb+srv://user:pass@cluster0.example.mongodb.net/rassm",
    FRONTEND_ORIGIN: "http://localhost:3000, http://127.0.0.1:3000/",
  };

  it("parses valid variables with defaults", () => {
    expect(parseEnv(valid)).toMatchObject({
      PORT: 4000,
      FRONTEND_ORIGIN: ["http://localhost:3000", "http://127.0.0.1:3000"],
      META_GRAPH_API_VERSION: "v23.0",
      MONGODB_DB_NAME: "rassm",
      DNS_FALLBACK_SERVERS: ["1.1.1.1", "8.8.8.8"],
    });
    expect(parseEnv({ ...valid, DNS_FALLBACK_SERVERS: "" }).DNS_FALLBACK_SERVERS).toEqual([]);
    expect(() => parseEnv({ ...valid, DNS_FALLBACK_SERVERS: "dns.google" })).toThrow();
  });

  it("rejects a missing database URL or a bad origin", () => {
    expect(() => parseEnv({ ...valid, MONGODB_URI: "" })).toThrow();
    expect(() => parseEnv({ ...valid, FRONTEND_ORIGIN: "localhost" })).toThrow();
  });
});
