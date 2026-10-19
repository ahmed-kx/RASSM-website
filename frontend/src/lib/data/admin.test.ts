import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { UNREACHABLE_ERROR, adminLogin } from "./admin";

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
