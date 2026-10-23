import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildConfirmedOrderEvent,
  createMetaEvents,
  normalizePhone,
  splitFullName,
} from "../src/meta/conversions-api";
import { OrderModel } from "../src/models/order";
import { BlacklistModel } from "../src/models/blacklist";
import request from "supertest";
import { AdminModel } from "../src/models/admin";
import { createTestAdmin, loginAgent, orderBody, testApp } from "./helpers";

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
    // The browser data is kept on the order (for ConfirmedOrder later).
    expect((await OrderModel.findById(res.body.eventId).lean())?.tracking).toMatchObject({
      fbp: "fb.1.1712345678901.123456789",
      fbc: "fb.1.1712345678901.IwAR0abc",
    });
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
});

describe("Meta ConfirmedOrder (dashboard confirmation)", () => {
  const tracking = { fbp: "fb.1.1712345678901.987654321", fbc: "fb.1.1712345678901.test123" };

  /** Meta answering OK (or not), recording every event sent. */
  function metaMock(status = 200) {
    const sent: { name: string; body: Record<string, unknown> }[] = [];
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      for (const event of body.data) sent.push({ name: event.event_name, body });
      return new Response(status === 200 ? '{"events_received":1}' : '{"error":{}}', { status });
    });
    vi.stubGlobal("fetch", fetchMock);
    return { sent, confirmed: () => sent.filter((event) => event.name === "ConfirmedOrder") };
  }

  async function setup(order: Record<string, unknown> = {}, status = 200) {
    const meta = metaMock(status);
    const { app, api } = testApp({
      metaEvents: createMetaEvents({ ...config, testEventCode: "TEST123" }),
    });
    if (!(await AdminModel.exists({}))) await createTestAdmin();
    const agent = request.agent(app);
    await loginAgent(agent);
    const placed = await api.post("/api/orders").send(orderBody(order, { tracking })).expect(201);
    const id = placed.body.eventId as string;
    const setStatus = (to: string) =>
      agent.post(`/api/admin/orders/${id}/status`).send({ status: to });
    const stored = async () => (await OrderModel.findById(id).lean())?.metaConfirmed;
    return { meta, agent, api, id, total: placed.body.order.total as number, setStatus, stored };
  }

  it("is sent once when the order is confirmed, with the Purchase customer data, fbc and fbp", async () => {
    const { meta, id, total, setStatus, stored, agent } = await setup();
    await setStatus("confirmed").expect(200);
    await vi.waitFor(async () => expect((await stored())?.status).toBe("sent"));

    const [event] = meta.confirmed();
    const purchase = meta.sent.find((e) => e.name === "Purchase");
    expect(event?.body.test_event_code).toBe("TEST123");
    const data = (event?.body.data as Record<string, unknown>[])[0];
    expect(data).toMatchObject({
      event_name: "ConfirmedOrder",
      event_id: `${id}:confirmed`,
      action_source: "website",
      custom_data: { value: total, currency: "DZD" },
      user_data: { fbc: tracking.fbc, fbp: tracking.fbp },
    });
    // Exactly the customer fields of Purchase: no new data.
    const purchaseData = (purchase?.body.data as Record<string, unknown>[])[0];
    expect(data?.user_data).toEqual(purchaseData?.user_data);

    // Shown in the order's internal information.
    const detail = await agent.get(`/api/admin/orders/${id}`).expect(200);
    expect(detail.body.order.metaConfirmed).toMatchObject({ status: "sent", detail: null });
    expect(detail.body.order.metaConfirmed.at).toEqual(expect.any(String));
  });

  it("is never sent twice, even when the status goes back and forth", async () => {
    const { meta, setStatus, stored } = await setup();
    await setStatus("confirmed").expect(200);
    await vi.waitFor(async () => expect((await stored())?.status).toBe("sent"));
    await setStatus("cancelled").expect(200);
    await setStatus("pending").expect(200);
    await setStatus("confirmed").expect(200);
    await setStatus("shipped").expect(200);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(meta.confirmed()).toHaveLength(1);
  });

  it("a Meta failure never blocks the status change, and is shown « Échec »", async () => {
    const { meta, setStatus, stored } = await setup({}, 500);
    const res = await setStatus("confirmed").expect(200);
    expect(res.body.order.status).toBe("confirmed");
    await vi.waitFor(async () => expect((await stored())?.status).toBe("failed"));
    expect((await stored())?.detail).toContain("500");
    expect(meta.confirmed()).toHaveLength(1);
  });

  it("is never sent for a test order or a blacklisted number", async () => {
    const first = await setup();
    await first.agent.put(`/api/admin/orders/${first.id}/test`).send({ test: true }).expect(200);
    await first.setStatus("confirmed").expect(200);
    await vi.waitFor(async () =>
      expect(await first.stored()).toMatchObject({ status: "skipped", detail: "Commande de test" }),
    );
    expect(first.meta.confirmed()).toHaveLength(0);

    const second = await setup({ phone: "0661 22 33 44" });
    await BlacklistModel.create({ phone: "0661223344", reason: "Colis refusé" });
    await second.setStatus("confirmed").expect(200);
    await vi.waitFor(async () =>
      expect(await second.stored()).toMatchObject({
        status: "skipped",
        detail: "Numéro sur la liste noire",
      }),
    );
    expect(second.meta.confirmed()).toHaveLength(0);
  });

  it("waits for shipping on a suspicious order, and never sends it when it is cancelled", async () => {
    const shipped = await setup({ phone: "0770 11 22 33" });
    await OrderModel.updateOne({ _id: shipped.id }, { $set: { suspicious: true } });
    await shipped.setStatus("confirmed").expect(200);
    await vi.waitFor(async () => expect((await shipped.stored())?.status).toBe("waiting"));
    expect(shipped.meta.confirmed()).toHaveLength(0);
    await shipped.setStatus("shipped").expect(200);
    await vi.waitFor(async () => expect((await shipped.stored())?.status).toBe("sent"));
    expect(shipped.meta.confirmed()).toHaveLength(1);

    const cancelled = await setup({ phone: "0770 44 55 66" });
    await OrderModel.updateOne({ _id: cancelled.id }, { $set: { suspicious: true } });
    await cancelled.setStatus("confirmed").expect(200);
    await vi.waitFor(async () => expect((await cancelled.stored())?.status).toBe("waiting"));
    await cancelled.setStatus("cancelled").expect(200);
    await vi.waitFor(async () =>
      expect(await cancelled.stored()).toMatchObject({
        status: "skipped",
        detail: "Commande suspecte annulée",
      }),
    );
    expect(cancelled.meta.confirmed()).toHaveLength(0);
  });

  it("uses the confirmation time, or a recent one when it is older than Meta accepts", async () => {
    const { api } = testApp();
    const res = await api.post("/api/orders").send(orderBody()).expect(201);
    const order = await OrderModel.findById(res.body.eventId).lean();
    if (!order) throw new Error("order not saved");
    const now = new Date("2026-10-30T10:00:00Z");
    const recent = new Date("2026-10-28T10:00:00Z");
    expect(buildConfirmedOrderEvent(order, recent, now).event_time).toBe(recent.getTime() / 1000);
    const old = new Date("2026-10-01T10:00:00Z");
    expect(buildConfirmedOrderEvent(order, old, now).event_time).toBe(now.getTime() / 1000);
  });
});
