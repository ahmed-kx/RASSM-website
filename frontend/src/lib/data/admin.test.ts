import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import {
  UNREACHABLE_ERROR,
  adminLogin,
  adminLogout,
  fetchAdminSettings,
  saveAdminSettings,
} from "./admin";

// Login errors as the dashboard shows them (French).

const credentials = { email: "admin@rassm.dz", password: "mot-de-passe-123" };

async function loginError(response: Response | Error): Promise<ApiError> {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (response instanceof Error) throw response;
      return response;
    }),
  );
  const error = await adminLogin(credentials).catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("adminLogin errors", () => {
  it("shows the API's French message (wrong password, account locked, database down)", async () => {
    const error = await loginError(
      Response.json({ error: { message: "E-mail ou mot de passe incorrect." } }, { status: 401 }),
    );
    expect(error.message).toBe("E-mail ou mot de passe incorrect.");
  });

  it("says the server is unreachable when the site cannot reach the API", async () => {
    // What Next.js answers when the API behind /api/admin is stopped.
    const error = await loginError(new Response("Internal Server Error", { status: 500 }));
    expect(error.message).toBe(UNREACHABLE_ERROR);
    expect((await loginError(new Response("", { status: 502 }))).message).toBe(UNREACHABLE_ERROR);
  });

  it("says the connection failed when the site itself cannot be reached", async () => {
    const error = await loginError(new TypeError("Failed to fetch"));
    expect(error.status).toBe(0);
    expect(error.message).toBe(
      "Connexion impossible. Vérifiez votre connexion internet et réessayez.",
    );
  });
});

describe("CSRF token (kept in memory, never in a cookie)", () => {
  const settings = { lowStockThreshold: 10, packagingCost: 0, returnCost: 0 };
  const admin = { id: "a1", email: "admin@rassm.dz" };

  /** Answers like the API; `tokens` are given in turn by /auth/me. */
  function stubFetch(tokens: string[] = [], refuse: string[] = []) {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        const headers = (init.headers ?? {}) as Record<string, string>;
        calls.push({ url, headers });
        if (url === "/api/admin/auth/me") {
          return Response.json({ admin, csrfToken: tokens.shift() ?? "" });
        }
        if (url === "/api/admin/auth/login") return Response.json({ admin, csrfToken: "du-login" });
        if (refuse.includes(headers["x-csrf-token"] ?? "")) {
          return Response.json(
            { error: { message: "Requête refusée. Rechargez la page puis réessayez." } },
            { status: 403 },
          );
        }
        return Response.json(settings);
      }),
    );
    return calls;
  }

  afterEach(async () => {
    stubFetch();
    await adminLogout(); // forgets the token kept by the module
  });

  it("uses the token of the login answer for every change, never for reads", async () => {
    const calls = stubFetch();
    await adminLogin(credentials);
    await saveAdminSettings({ lowStockThreshold: 12 });
    await fetchAdminSettings();
    expect(calls[1]).toMatchObject({ url: "/api/admin/settings" });
    expect(calls[1]?.headers["x-csrf-token"]).toBe("du-login");
    expect(calls[2]?.headers["x-csrf-token"]).toBeUndefined();
  });

  it("asks GET /auth/me for the token after a page reload, once", async () => {
    const calls = stubFetch(["jeton-1"]);
    await saveAdminSettings({ lowStockThreshold: 12 });
    await saveAdminSettings({ lowStockThreshold: 13 });
    expect(calls.map((call) => call.url)).toEqual([
      "/api/admin/auth/me",
      "/api/admin/settings",
      "/api/admin/settings",
    ]);
    expect(calls[2]?.headers["x-csrf-token"]).toBe("jeton-1");
  });

  it("fetches a new token and retries once when the API refuses an old one", async () => {
    const calls = stubFetch(["ancien", "nouveau"], ["ancien"]);
    await saveAdminSettings({ lowStockThreshold: 12 });
    expect(calls.map((call) => call.headers["x-csrf-token"] ?? call.url)).toEqual([
      "/api/admin/auth/me",
      "ancien",
      "/api/admin/auth/me",
      "nouveau",
    ]);
  });
});
