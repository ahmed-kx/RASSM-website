import {
  ADMIN_CSRF_HEADER,
  FORGOT_PASSWORD_MESSAGE,
  INVALID_RESET_LINK,
  MAX_FAILED_LOGINS,
} from "@rassm/shared";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClientInfo } from "../src/lib/client-info";
import { ARGON2_PARAMS, hashPassword, verifyPassword } from "../src/lib/password";
import { parseUserAgent } from "../src/lib/user-agent";
import { AdminModel } from "../src/models/admin";
import { AdminPasswordResetModel } from "../src/models/admin-password-reset";
import { AdminSessionModel } from "../src/models/admin-session";
import { LoginThrottleModel } from "../src/models/login-throttle";
import {
  buildPasswordResetEmail,
  buildSecurityAlertEmail,
  createSecurityMailer,
} from "../src/notifications/security-email";
import {
  REMEMBER_MS,
  SESSION_IDLE_MS,
  SESSION_MAX_MS,
  authenticate,
  hashToken,
  login,
  resetPassword,
  type AuthDeps,
} from "../src/services/admin-auth";
import { lockMinutes } from "../src/services/login-throttle";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  TEST_ADMIN_URL,
  createTestAdmin,
  csrfFrom,
  fakeSecurityMailer,
  testApp,
} from "./helpers";

// Admin account security: 5-attempt lock, sessions, password change and reset, alerts.

const ORIGIN = "http://localhost:3000";
const LOCK_MESSAGE = "Trop de tentatives. Réessayez dans 15 minutes.";
const NEW_PASSWORD = "Bleu-nuit-sur-la-ville-42";
const CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";

const MINUTE = 60_000;
const at = (base: Date, ms: number) => new Date(base.getTime() + ms);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Api = ReturnType<typeof testApp>["api"];

/** A login from a given IP (the API trusts X-Forwarded-For from the local proxy). */
const loginFrom = (
  api: Api | ReturnType<typeof request.agent>,
  ip: string,
  body: Record<string, unknown>,
  userAgent = CHROME_WINDOWS,
) =>
  api
    .post("/api/admin/auth/login")
    .set("X-Forwarded-For", ip)
    .set("User-Agent", userAgent)
    .set("Origin", ORIGIN)
    .send(body);

/** Logs an agent in from a device and keeps its CSRF token, like the dashboard. */
async function signIn(
  agent: ReturnType<typeof request.agent>,
  ip: string,
  body: Record<string, unknown>,
  userAgent = CHROME_WINDOWS,
) {
  const res = await loginFrom(agent, ip, body, userAgent).expect(200);
  agent.set(ADMIN_CSRF_HEADER, csrfFrom(res) ?? "");
  return res;
}

const wrong = { email: ADMIN_EMAIL, password: "pas-le-bon-mot-de-passe" };
const right = { email: ADMIN_EMAIL, password: ADMIN_PASSWORD };

const client = (ip = "198.51.100.7", userAgent = CHROME_WINDOWS): ClientInfo => ({
  ip,
  userAgent,
  location: null,
});

function deps(): AuthDeps & { mailer: ReturnType<typeof fakeSecurityMailer> } {
  return { mailer: fakeSecurityMailer(), adminUrl: TEST_ADMIN_URL };
}

const loginInput = (password: string, overrides: Partial<Parameters<typeof login>[0]> = {}) => ({
  email: ADMIN_EMAIL,
  password,
  remember: false,
  client: client(),
  deviceToken: null,
  previousToken: null,
  ...overrides,
});

/** Calls login() and returns the HTTP status it would answer (200 or the error status). */
async function attempt(password: string, now: Date, ip = "198.51.100.7", d = deps()) {
  try {
    await login(loginInput(password, { client: client(ip) }), d, now);
    return { status: 200, message: "" };
  } catch (error) {
    const { status, message } = error as { status: number; message: string };
    return { status, message };
  }
}

const cookieOf = (res: request.Response, name: string) =>
  ([] as string[])
    .concat(res.headers["set-cookie"] ?? [])
    .find((cookie) => cookie.startsWith(`${name}=`));

describe("login lock: 5 attempts per account and per IP", () => {
  it("locks the account for 15 minutes after 5 failures, from every IP", async () => {
    const { api, securityMailer } = testApp();
    await createTestAdmin();
    for (let i = 1; i < MAX_FAILED_LOGINS; i++) {
      const res = await loginFrom(api, "203.0.113.1", wrong).expect(401);
      expect(res.body.error.message).toBe("E-mail ou mot de passe incorrect.");
    }
    const locked = await loginFrom(api, "203.0.113.1", wrong).expect(429);
    expect(locked.body).toEqual({ error: { message: LOCK_MESSAGE } });
    // The right password from another IP is refused too, with the same message only.
    const other = await loginFrom(api, "203.0.113.99", right).expect(429);
    expect(other.body).toEqual({ error: { message: LOCK_MESSAGE } });
    // The admin is alerted once, with the context of the attempt.
    await vi.waitFor(() => expect(securityMailer.sendAlert).toHaveBeenCalledTimes(1));
    expect(securityMailer.sendAlert).toHaveBeenCalledWith(ADMIN_EMAIL, {
      kind: "locked",
      lockMinutes: 15,
      context: expect.objectContaining({ ip: "203.0.113.1", userAgent: CHROME_WINDOWS }),
    });
  });

  it("blocks the IP that made 5 failures, whatever the e-mails tried", async () => {
    const { api } = testApp();
    await createTestAdmin();
    for (let i = 1; i <= MAX_FAILED_LOGINS; i++) {
      await loginFrom(api, "203.0.113.2", { email: `essai${i}@rassm.test`, password: "x" });
    }
    const blocked = await loginFrom(api, "203.0.113.2", right).expect(429);
    expect(blocked.body.error.message).toBe(LOCK_MESSAGE);
    // The account itself is not locked: another IP logs in.
    await loginFrom(api, "203.0.113.3", right).expect(200);
  });

  it("answers exactly the same for an unknown e-mail (no way to find the accounts)", async () => {
    const { api, securityMailer } = testApp();
    await createTestAdmin();
    const known: unknown[] = [];
    const unknown: unknown[] = [];
    for (let i = 1; i <= MAX_FAILED_LOGINS + 1; i++) {
      const a = await loginFrom(api, "203.0.113.10", wrong);
      const b = await loginFrom(api, "203.0.113.11", { ...wrong, email: "nobody@rassm.test" });
      known.push([a.status, a.body]);
      unknown.push([b.status, b.body]);
    }
    expect(unknown).toEqual(known);
    // No alert for an e-mail that is not an account (only one for the real one).
    await vi.waitFor(() => expect(securityMailer.sendAlert).toHaveBeenCalledTimes(1));
  });

  it("doubles the lock each time it happens again (15, 30, 60 min…), up to 24 hours", async () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 10].map(lockMinutes)).toEqual([
      15, 30, 60, 120, 240, 480, 960, 1440, 1440,
    ]);
    await createTestAdmin();
    let now = new Date("2026-10-21T10:00:00Z");
    for (const minutes of [15, 30, 60]) {
      for (let i = 1; i < MAX_FAILED_LOGINS; i++) {
        expect((await attempt("faux-mot-de-passe", now)).status).toBe(401);
      }
      expect(await attempt("faux-mot-de-passe", now)).toEqual({
        status: 429,
        message: `Trop de tentatives. Réessayez dans ${minutes} minutes.`,
      });
      // Still locked one minute before the end, even with the right password.
      expect((await attempt(ADMIN_PASSWORD, at(now, (minutes - 1) * MINUTE))).status).toBe(429);
      now = at(now, minutes * MINUTE + 1000);
    }
    // After the last lock, the right password works and the counter starts over.
    expect((await attempt(ADMIN_PASSWORD, now)).status).toBe(200);
    expect(await LoginThrottleModel.countDocuments()).toBe(0);
  });

  it("forgets the doubling 24 hours after the last lock", async () => {
    await createTestAdmin();
    let now = new Date("2026-10-21T10:00:00Z");
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) await attempt("faux", now);
    now = at(now, 15 * MINUTE + 24 * 60 * MINUTE + 1000);
    for (let i = 1; i < MAX_FAILED_LOGINS; i++) await attempt("faux", now);
    expect((await attempt("faux", now)).message).toBe(LOCK_MESSAGE);
  });

  it("resets the counter after a successful login", async () => {
    const { api } = testApp();
    await createTestAdmin();
    for (let i = 1; i < MAX_FAILED_LOGINS; i++) await loginFrom(api, "203.0.113.4", wrong);
    await loginFrom(api, "203.0.113.4", right).expect(200);
    for (let i = 1; i < MAX_FAILED_LOGINS; i++) {
      await loginFrom(api, "203.0.113.4", wrong).expect(401);
    }
  });

  it("still sends the reset e-mail while locked, and a reset unlocks the account", async () => {
    const { api, securityMailer } = testApp();
    await createTestAdmin();
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) await loginFrom(api, "203.0.113.5", wrong);
    await loginFrom(api, "203.0.113.5", right).expect(429);

    await api
      .post("/api/admin/auth/password/forgot")
      .set("Origin", ORIGIN)
      .set("X-Forwarded-For", "203.0.113.5")
      .send({ email: ADMIN_EMAIL })
      .expect(200);
    await vi.waitFor(() => expect(securityMailer.sendPasswordReset).toHaveBeenCalled());
    const link = securityMailer.sendPasswordReset.mock.calls[0]?.[1] ?? "";
    const token = link.split("#jeton=")[1];
    await api
      .post("/api/admin/auth/password/reset")
      .set("Origin", ORIGIN)
      .set("X-Forwarded-For", "203.0.113.5")
      .send({ token, password: NEW_PASSWORD })
      .expect(200);
    await loginFrom(api, "203.0.113.5", { email: ADMIN_EMAIL, password: NEW_PASSWORD }).expect(200);
  });
});

describe("sessions", () => {
  it("without « Se souvenir de moi »: browser cookie, 2 hours idle, 12 hours at most", async () => {
    const { api } = testApp();
    await createTestAdmin();
    const res = await loginFrom(api, "198.51.100.1", right).expect(200);
    const cookie = cookieOf(res, "rassm_admin") ?? "";
    expect(cookie).not.toMatch(/Expires=|Max-Age=/i);
    expect(cookie).toMatch(/HttpOnly/);

    const d = deps();
    const now = new Date("2026-10-21T08:00:00Z");
    const session = await login(loginInput(ADMIN_PASSWORD), d, now);
    // Active every 1 h 50: still there at 11 h 50, gone at 12 h.
    let time = now;
    for (let i = 0; i < 6; i++) {
      time = at(time, 110 * MINUTE);
      expect(await authenticate(session.token, time)).not.toBeNull();
    }
    expect(await authenticate(session.token, at(now, SESSION_MAX_MS))).toBeNull();

    // 2 hours without activity: closed (and deleted).
    const idle = await login(loginInput(ADMIN_PASSWORD), d, now);
    expect(await authenticate(idle.token, at(now, SESSION_IDLE_MS - MINUTE))).not.toBeNull();
    const later = at(now, SESSION_IDLE_MS - MINUTE + SESSION_IDLE_MS);
    expect(await authenticate(idle.token, later)).toBeNull();
    expect(await AdminSessionModel.countDocuments({ tokenHash: hashToken(idle.token) })).toBe(0);
  });

  it("with « Se souvenir de moi »: 30 days on this device, even without activity", async () => {
    const { api } = testApp();
    await createTestAdmin();
    const res = await loginFrom(api, "198.51.100.1", { ...right, remember: true }).expect(200);
    const expires = /Expires=([^;]+)/i.exec(cookieOf(res, "rassm_admin") ?? "")?.[1];
    const days = (new Date(expires ?? 0).getTime() - Date.now()) / (24 * 60 * MINUTE);
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);

    const now = new Date("2026-10-21T08:00:00Z");
    const session = await login(loginInput(ADMIN_PASSWORD, { remember: true }), deps(), now);
    expect(await authenticate(session.token, at(now, REMEMBER_MS - MINUTE))).not.toBeNull();
    expect(await authenticate(session.token, at(now, REMEMBER_MS))).toBeNull();
  });

  it("gives a new session id on every login and closes the previous one", async () => {
    const { app } = testApp();
    await createTestAdmin();
    const agent = request.agent(app);
    const first = cookieOf(
      await loginFrom(agent, "198.51.100.1", right).expect(200),
      "rassm_admin",
    );
    const second = cookieOf(
      await loginFrom(agent, "198.51.100.1", right).expect(200),
      "rassm_admin",
    );
    expect(first).toBeTruthy();
    expect(second?.split(";")[0]).not.toBe(first?.split(";")[0]);
    // The old token is no longer valid (no session fixation).
    await request(app)
      .get("/api/admin/auth/me")
      .set("Cookie", first?.split(";")[0] ?? "")
      .expect(401);
    await agent.get("/api/admin/auth/me").expect(200);
    expect(await AdminSessionModel.countDocuments()).toBe(1);
  });

  it("lists the sessions and revokes one, or all the others", async () => {
    const { app } = testApp();
    await createTestAdmin();
    const laptop = request.agent(app);
    const phone = request.agent(app);
    const tablet = request.agent(app);
    await signIn(laptop, "198.51.100.1", right);
    await signIn(phone, "198.51.100.2", { ...right, remember: true }, SAFARI_IPHONE);
    await signIn(tablet, "198.51.100.3", right);

    const { body } = await laptop.get("/api/admin/security/sessions").expect(200);
    expect(body.sessions).toHaveLength(3);
    expect(body.sessions[0]).toMatchObject({
      current: true,
      browser: "Chrome 141",
      os: "Windows",
      deviceType: "desktop",
      ip: "198.51.100.1",
      remember: false,
    });
    const iphone = body.sessions.find((s: { ip: string }) => s.ip === "198.51.100.2");
    expect(iphone).toMatchObject({
      current: false,
      browser: "Safari 18",
      os: "iOS",
      deviceType: "mobile",
      remember: true,
    });

    // "Déconnecter" one session: that phone is logged out at once.
    await laptop
      .delete(`/api/admin/security/sessions/${iphone.id}`)
      .set("Origin", ORIGIN)
      .expect(200);
    await phone.get("/api/admin/auth/me").expect(401);
    await laptop
      .delete(`/api/admin/security/sessions/${iphone.id}`)
      .set("Origin", ORIGIN)
      .expect(404);

    // "Déconnecter toutes les autres sessions".
    const others = await laptop
      .delete("/api/admin/security/sessions/others")
      .set("Origin", ORIGIN)
      .expect(200);
    expect(others.body.closed).toBe(1);
    await tablet.get("/api/admin/auth/me").expect(401);
    await laptop.get("/api/admin/auth/me").expect(200);
  });
});

describe("password change (Paramètres > Sécurité)", () => {
  it("needs the current password, logs out the other sessions and alerts", async () => {
    const { app, securityMailer } = testApp();
    await createTestAdmin();
    const laptop = request.agent(app);
    const phone = request.agent(app);
    await signIn(laptop, "198.51.100.1", right);
    await signIn(phone, "198.51.100.2", right, SAFARI_IPHONE);
    const change = (body: Record<string, string>) =>
      laptop.post("/api/admin/security/password").set("Origin", ORIGIN).send(body);

    const bad = await change({ currentPassword: "faux", newPassword: NEW_PASSWORD }).expect(400);
    expect(bad.body.error.fields).toEqual({
      currentPassword: "Le mot de passe actuel est incorrect.",
    });
    const weak = await change({ currentPassword: ADMIN_PASSWORD, newPassword: "court" });
    expect(weak.status).toBe(400);
    expect(weak.body.error.fields.newPassword).toBe(
      "Le mot de passe doit contenir au moins 12 caractères.",
    );

    const ok = await change({ currentPassword: ADMIN_PASSWORD, newPassword: NEW_PASSWORD });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ closedSessions: 1 });
    await phone.get("/api/admin/auth/me").expect(401);
    await laptop.get("/api/admin/auth/me").expect(200);
    await loginFrom(request(app), "198.51.100.3", right).expect(401);
    await loginFrom(request(app), "198.51.100.3", { ...right, password: NEW_PASSWORD }).expect(200);
    await vi.waitFor(() =>
      expect(securityMailer.sendAlert).toHaveBeenCalledWith(
        ADMIN_EMAIL,
        expect.objectContaining({ kind: "password-changed" }),
      ),
    );
  });
});

describe("password reset by e-mail", () => {
  const forgot = (api: Api, email: string, ip = "198.51.100.20") =>
    api
      .post("/api/admin/auth/password/forgot")
      .set("X-Forwarded-For", ip)
      .set("Origin", ORIGIN)
      .send({ email });

  async function resetLink(mailer: ReturnType<typeof fakeSecurityMailer>, call = 0) {
    await vi.waitFor(() =>
      expect(mailer.sendPasswordReset.mock.calls.length).toBeGreaterThan(call),
    );
    return mailer.sendPasswordReset.mock.calls[call]?.[1] ?? "";
  }

  it("answers the same neutral message whether the account exists or not", async () => {
    const { api, securityMailer } = testApp();
    await createTestAdmin();
    const known = await forgot(api, ADMIN_EMAIL).expect(200);
    const unknown = await forgot(api, "personne@rassm.test").expect(200);
    expect(known.body).toEqual({ message: FORGOT_PASSWORD_MESSAGE });
    expect(unknown.body).toEqual(known.body);
    expect(FORGOT_PASSWORD_MESSAGE).toMatch(/^Si ce compte existe, un e-mail a été envoyé/);
    await resetLink(securityMailer);
    expect(securityMailer.sendPasswordReset).toHaveBeenCalledTimes(1);
    expect(securityMailer.sendPasswordReset.mock.calls[0]?.[0]).toBe(ADMIN_EMAIL);
  });

  it("sends a random single-use link, stored hashed, that logs out every session", async () => {
    const { app, api, securityMailer } = testApp();
    await createTestAdmin();
    const laptop = request.agent(app);
    await loginFrom(laptop, "198.51.100.1", right).expect(200);
    await forgot(api, ADMIN_EMAIL).expect(200);
    const link = await resetLink(securityMailer);
    expect(link).toMatch(
      /^http:\/\/localhost:3000\/admin\/nouveau-mot-de-passe#jeton=[A-Za-z0-9_-]{43}$/,
    );
    const token = link.split("#jeton=")[1] ?? "";
    const stored = await AdminPasswordResetModel.findOne().lean();
    expect(stored?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.tokenHash).not.toBe(token);

    const reset = (password: string) =>
      api.post("/api/admin/auth/password/reset").set("Origin", ORIGIN).send({ token, password });
    const weak = await reset("rassm-2026-collection");
    expect(weak.status).toBe(400);
    expect(weak.body.error.fields.password).toBe("Le mot de passe ne doit pas contenir « rassm ».");
    await reset(NEW_PASSWORD).expect(200);
    await laptop.get("/api/admin/auth/me").expect(401);
    // Single use.
    const again = await reset("Encore-un-autre-mot-42").expect(400);
    expect(again.body.error.message).toBe(INVALID_RESET_LINK);
    await loginFrom(api, "198.51.100.1", { ...right, password: NEW_PASSWORD }).expect(200);
    await vi.waitFor(() =>
      expect(securityMailer.sendAlert).toHaveBeenCalledWith(
        ADMIN_EMAIL,
        expect.objectContaining({ kind: "password-reset" }),
      ),
    );
  });

  it("expires after 30 minutes, and only the latest link works", async () => {
    const { api, securityMailer } = testApp();
    await createTestAdmin();
    await forgot(api, ADMIN_EMAIL).expect(200);
    const first = (await resetLink(securityMailer, 0)).split("#jeton=")[1] ?? "";
    await forgot(api, ADMIN_EMAIL).expect(200);
    const second = (await resetLink(securityMailer, 1)).split("#jeton=")[1] ?? "";
    const d = deps();
    await expect(resetPassword(first, NEW_PASSWORD, client(), d)).rejects.toMatchObject({
      status: 400,
      message: INVALID_RESET_LINK,
    });
    await expect(
      resetPassword(second, NEW_PASSWORD, client(), d, at(new Date(), 31 * MINUTE)),
    ).rejects.toMatchObject({ status: 400 });
    await resetPassword(second, NEW_PASSWORD, client(), d, at(new Date(), 29 * MINUTE));
  });

  it("is rate limited: 3 e-mails per account per hour, and per IP", async () => {
    const { api, securityMailer } = testApp();
    await createTestAdmin();
    for (let i = 0; i < 5; i++) await forgot(api, ADMIN_EMAIL, `198.51.100.${30 + i}`).expect(200);
    await resetLink(securityMailer, 2);
    expect(securityMailer.sendPasswordReset).toHaveBeenCalledTimes(3);

    const limited = testApp({ rateLimits: { password: { windowMs: 60_000, limit: 2 } } });
    await forgot(limited.api, "a@rassm.test").expect(200);
    await forgot(limited.api, "b@rassm.test").expect(200);
    const res = await forgot(limited.api, "c@rassm.test").expect(429);
    expect(res.body.error.message).toMatch(/Trop de tentatives/);
  });
});

describe("password rules and hashing", () => {
  it("hashes with argon2id (64 MiB, 3 passes in production)", async () => {
    expect(ARGON2_PARAMS).toEqual({ m: 65_536, t: 3, p: 1 });
    const hash = await hashPassword(NEW_PASSWORD);
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=\d+,t=\d+,p=1\$/);
    expect(await verifyPassword(NEW_PASSWORD, hash)).toBe(true);
    expect(await verifyPassword("autre-mot-de-passe", hash)).toBe(false);
  });

  it("still accepts an old scrypt hash and replaces it at the next login", async () => {
    // scrypt$N$r$p$salt$hash of "mot-de-passe-solide" (made by the previous version).
    const { scryptSync } = await import("node:crypto");
    const salt = Buffer.from("0123456789abcdef");
    const key = scryptSync(ADMIN_PASSWORD, salt, 64, { N: 1024, r: 8, p: 1 });
    await AdminModel.create({
      email: ADMIN_EMAIL,
      passwordHash: `scrypt$1024$8$1$${salt.toString("base64")}$${key.toString("base64")}`,
    });
    const { api } = testApp();
    await loginFrom(api, "198.51.100.1", right).expect(200);
    const admin = await AdminModel.findOne({ email: ADMIN_EMAIL }).lean();
    expect(admin?.passwordHash).toMatch(/^\$argon2id\$/);
    await loginFrom(api, "198.51.100.1", right).expect(200);
  });
});

describe("security alerts", () => {
  it("alerts on a login from a new browser, not from a known one", async () => {
    const { app, securityMailer } = testApp();
    await createTestAdmin();
    const laptop = request.agent(app);
    // First login of the account: its browser becomes known, no alert.
    const first = await loginFrom(laptop, "198.51.100.1", right).expect(200);
    expect(cookieOf(first, "rassm_device")).toMatch(/HttpOnly/);
    await loginFrom(laptop, "198.51.100.1", right).expect(200);
    // Another browser.
    await loginFrom(request.agent(app), "198.51.100.9", right, SAFARI_IPHONE).expect(200);
    await vi.waitFor(() => expect(securityMailer.sendAlert).toHaveBeenCalledTimes(1));
    expect(securityMailer.sendAlert).toHaveBeenCalledWith(ADMIN_EMAIL, {
      kind: "new-device",
      context: expect.objectContaining({ ip: "198.51.100.9", userAgent: SAFARI_IPHONE }),
    });
  });

  it("writes date, time, device, browser, location and the Sécurité link in French", () => {
    const context = {
      at: new Date("2026-10-21T13:05:00Z"),
      ip: "41.200.10.20",
      userAgent: CHROME_WINDOWS,
      location: "Alger, Algérie",
    };
    const email = buildSecurityAlertEmail({ kind: "new-device", context }, TEST_ADMIN_URL);
    expect(email.subject).toBe("Nouvelle connexion à votre compte RASSM");
    for (const part of [
      "Date : mercredi 21 octobre 2026",
      "Heure : 14:05 (heure d'Algérie)",
      "Appareil : Windows",
      "Navigateur : Chrome 141",
      "Lieu approximatif : Alger, Algérie",
      "Adresse IP : 41.200.10.20",
      "http://localhost:3000/admin/parametres#securite",
    ]) {
      expect(email.text).toContain(part);
    }
    expect(email.html).toContain('href="http://localhost:3000/admin/parametres#securite"');
    const locked = buildSecurityAlertEmail({ kind: "locked", context, lockMinutes: 30 }, "x");
    expect(locked.text).toContain("bloqués pendant 30 minutes");
    expect(buildPasswordResetEmail("https://lien", context).text).toContain("valable 30 minutes");
  });

  it("sends them through Brevo to the admin's address", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const mailer = createSecurityMailer({
      brevoApiKey: "test-brevo-key-0123456789",
      notifyEmail: "team@rassm.test",
      from: "rassmwear@gmail.com",
      adminUrl: TEST_ADMIN_URL,
    });
    await mailer.sendAlert(ADMIN_EMAIL, {
      kind: "password-changed",
      context: { at: new Date(), ip: null, userAgent: null, location: null },
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    const body = JSON.parse(String(init.body));
    expect(body.to).toEqual([{ email: ADMIN_EMAIL }]);
    expect(body.subject).toBe("Votre mot de passe RASSM a été modifié");
    // A Brevo failure never throws.
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 500 }));
    await expect(
      mailer.sendPasswordReset(ADMIN_EMAIL, "https://lien", {
        at: new Date(),
        ip: null,
        userAgent: null,
        location: null,
      }),
    ).resolves.toBeUndefined();
  });

  it("reads browsers and systems for the Sécurité page", () => {
    expect(parseUserAgent(CHROME_WINDOWS)).toEqual({
      browser: "Chrome 141",
      os: "Windows",
      deviceType: "desktop",
    });
    expect(parseUserAgent(SAFARI_IPHONE)).toEqual({
      browser: "Safari 18",
      os: "iOS",
      deviceType: "mobile",
    });
    expect(
      parseUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
      ).browser,
    ).toBe("Edge 141");
    expect(parseUserAgent(null).browser).toBe("Navigateur inconnu");
  });
});
