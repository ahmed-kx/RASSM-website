import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildOrderConfirmedEvent,
  createMetaEvents,
  normalizePhone,
  splitFullName,
} from "../src/meta/conversions-api";
import { OrderModel } from "../src/models/order";
import { orderBody, testApp } from "./helpers";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const config = { pixelId: "1234567890", accessToken: "test-token-0123456789", apiVersion: "v23.0" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Meta Conversions API", () => {
  it("normalizes the phone and splits the name like Meta expects", () => {
    expect(normalizePhone("0555 12 34 56")).toBe("213555123456");
    expect(splitFullName("  Yacine  Ben-Ali ")).toEqual({
      firstName: "yacine",
      lastName: "benali",
    });
    expect(splitFullName("Amina")).toEqual({ firstName: "amina" });
  });

  it("sends a Purchase with the browser event id, hashed customer data and DZD", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { api } = testApp({ metaEvents: createMetaEvents(config) });

    const res = await api
      .post("/api/orders")
      .set("User-Agent", "TestBrowser/1.0")
      .send(
        orderBody(
          { wilayaCode: 6, quantity: 2 },
          { tracking: { fbp: "fb.1.1712345678901.123456789", fbc: "fb.1.1712345678901.IwAR0abc" } },
        ),
      )
      .expect(201);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v23.0/1234567890/events");
    expect(url).not.toContain("token");
    const body = JSON.parse(String(init.body));
    expect(body.access_token).toBe(config.accessToken);
    expect(body.data).toEqual([
      {
        event_name: "Purchase",
        event_time: expect.any(Number),
        event_id: res.body.eventId,
        action_source: "website",
        user_data: {
          ph: [sha256("213555123456")],
          fn: [sha256("yacine")],
          ln: [sha256("benali")],
          ct: [sha256("bejaia")],
          country: [sha256("dz")],
          client_ip_address: expect.stringMatching(/127\.0\.0\.1|::1/),
          client_user_agent: "TestBrowser/1.0",
          fbp: "fb.1.1712345678901.123456789",
          fbc: "fb.1.1712345678901.IwAR0abc",
        },
        custom_data: {
          value: res.body.order.total,
          currency: "DZD",
          content_ids: ["prod_003"],
          content_type: "product",
          contents: [{ id: "prod_003", quantity: 2 }],
          num_items: 2,
        },
      },
    ]);
    await vi.waitFor(async () =>
      expect((await OrderModel.findById(res.body.eventId).lean())?.metaPurchase.status).toBe(
        "sent",
      ),
    );
  });

  it("a Meta error is logged on the order and never fails it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"error":{"message":"Invalid token"}}', { status: 400 })),
    );
    const { api } = testApp({ metaEvents: createMetaEvents(config) });
    const res = await api.post("/api/orders").send(orderBody()).expect(201);
    await vi.waitFor(async () => {
      const order = await OrderModel.findById(res.body.eventId).lean();
      expect(order?.metaPurchase.status).toBe("failed");
      expect(order?.metaPurchase.error).toContain("400");
    });
  });

  it("does nothing without a Pixel ID and token", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { api } = testApp({ metaEvents: createMetaEvents(null) });
    const res = await api.post("/api/orders").send(orderBody()).expect(201);
    await vi.waitFor(async () =>
      expect((await OrderModel.findById(res.body.eventId).lean())?.metaPurchase.status).toBe(
        "skipped",
      ),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("prepares the 'confirmed by phone' event for the dashboard step", async () => {
    const { api } = testApp();
    const res = await api.post("/api/orders").send(orderBody()).expect(201);
    const order = await OrderModel.findById(res.body.eventId).lean();
    if (!order) throw new Error("order not saved");
    const confirmedAt = new Date("2026-10-20T10:00:00Z");
    const event = buildOrderConfirmedEvent(order, confirmedAt);
    expect(event).toMatchObject({
      event_name: "CommandeConfirmee",
      event_id: `${res.body.eventId}:confirmed`,
      action_source: "phone_call",
      event_time: confirmedAt.getTime() / 1000,
      custom_data: { value: 7200, currency: "DZD" },
    });
  });
});
