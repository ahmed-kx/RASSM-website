import { existsSync } from "node:fs";
import { z } from "zod";

/** Empty values in .env ("KEY=") count as not set. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  MONGODB_URI: z
    .string({ error: "MONGODB_URI is required (MongoDB Atlas connection string)." })
    .trim()
    .regex(
      /^mongodb(\+srv)?:\/\/\S+$/,
      "MONGODB_URI must start with mongodb:// or mongodb+srv://.",
    ),
  /** Database used in the cluster (it takes precedence over a name in MONGODB_URI). */
  MONGODB_DB_NAME: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{1,38}$/, "MONGODB_DB_NAME must be a simple name, e.g. rassm.")
    .default("rassm"),
  /** Site origin(s) allowed by CORS, comma-separated, e.g. https://rassm.dz,https://www.rassm.dz */
  FRONTEND_ORIGIN: z
    .string({ error: "FRONTEND_ORIGIN is required, e.g. http://localhost:3000." })
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(
          z
            .url("FRONTEND_ORIGIN must contain full origins, e.g. https://rassm.dz.")
            .transform((url) => new URL(url).origin),
        )
        .min(1, "FRONTEND_ORIGIN is required."),
    ),
  /**
   * Number of reverse proxies in front of the API (hosting load balancer). Needed to read
   * the real client IP for rate limiting and fraud checks. 0 when the API is reached directly.
   */
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  /** Meta Pixel ID (same as the frontend NEXT_PUBLIC_META_PIXEL_ID). */
  META_PIXEL_ID: optional(
    z.string().regex(/^\d{5,20}$/, "META_PIXEL_ID must contain digits only."),
  ),
  /** Conversions API access token (Events Manager > Settings). Secret. */
  META_CAPI_ACCESS_TOKEN: optional(z.string().min(20, "META_CAPI_ACCESS_TOKEN looks too short.")),
  /** Optional: Events Manager "Test events" code, to check events without counting them. */
  META_TEST_EVENT_CODE: optional(z.string().max(50)),
  META_GRAPH_API_VERSION: z
    .string()
    .regex(/^v\d+\.\d+$/, 'META_GRAPH_API_VERSION must look like "v23.0".')
    .default("v23.0"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Reads and validates the environment once at startup (backend/.env is loaded when it
 * exists). Exits with a clear message when a variable is missing or invalid.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (source === process.env && existsSync(".env")) process.loadEnvFile(".env");
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `  - ${issue.path.join(".")}: ${issue.message}`,
    );
    console.error(`Invalid environment variables (see backend/.env.example):\n${lines.join("\n")}`);
    process.exit(1);
  }
  return result.data;
}

/** Validates a given set of variables without exiting (tests). */
export function parseEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(source);
}
