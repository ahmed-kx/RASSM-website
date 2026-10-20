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
  /**
   * DNS servers used for the Atlas lookup (mongodb+srv://) when the computer's own DNS refuses
   * it, e.g. under some VPNs. Comma-separated IPs; empty = no fallback.
   */
  DNS_FALLBACK_SERVERS: z
    .string()
    .default("1.1.1.1,8.8.8.8")
    .transform((value) =>
      value
        .split(",")
        .map((server) => server.trim())
        .filter(Boolean),
    )
    .pipe(
      z.array(
        z.union([z.ipv4(), z.ipv6()], {
          error: "DNS_FALLBACK_SERVERS must contain IP addresses, e.g. 1.1.1.1,8.8.8.8.",
        }),
      ),
    ),
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
  /** Brevo transactional e-mail API key (new order e-mails). Secret. Empty = no e-mail. */
  BREVO_API_KEY: optional(z.string().min(20, "BREVO_API_KEY looks too short.")),
  /**
   * Brevo list of the newsletter subscribers (Contacts > Lists, the list ID number). Empty =
   * sign-ups are kept on the site only.
   */
  BREVO_NEWSLETTER_LIST_ID: optional(
    z.coerce
      .number({ error: "BREVO_NEWSLETTER_LIST_ID must be the list number, e.g. 3." })
      .int("BREVO_NEWSLETTER_LIST_ID must be the list number, e.g. 3.")
      .positive("BREVO_NEWSLETTER_LIST_ID must be the list number, e.g. 3."),
  ),
  /** Who receives the new order and new message e-mails. */
  NOTIFY_EMAIL: z.email("NOTIFY_EMAIL must be an e-mail address.").default("rassmwear@gmail.com"),
  /** Sender of the e-mails (must be a sender or domain validated in Brevo). */
  EMAIL_FROM: z.email("EMAIL_FROM must be an e-mail address.").default("rassmwear@gmail.com"),
  /** Cloudinary (product photos). All three are needed to upload; empty = uploads disabled. */
  CLOUDINARY_CLOUD_NAME: optional(
    z.string().regex(/^[A-Za-z0-9_-]+$/, "CLOUDINARY_CLOUD_NAME looks wrong."),
  ),
  CLOUDINARY_API_KEY: optional(z.string().regex(/^\d+$/, "CLOUDINARY_API_KEY must be digits.")),
  /** Secret: only the API uses it (signed uploads), never the browser. */
  CLOUDINARY_API_SECRET: optional(z.string().min(10, "CLOUDINARY_API_SECRET looks too short.")),
  /** Cloudinary folder of the product photos. */
  CLOUDINARY_FOLDER: z
    .string()
    .regex(/^[a-z0-9_-]+(\/[a-z0-9_-]+)*$/, "CLOUDINARY_FOLDER must look like rassm/products.")
    .default("rassm/products"),
  /**
   * Website route that refreshes its cached pages after a dashboard change (same secret as
   * the frontend REVALIDATE_SECRET). Default: the first FRONTEND_ORIGIN + /api/revalidate.
   */
  REVALIDATE_URL: optional(z.url("REVALIDATE_URL must be a full URL.")),
  REVALIDATE_SECRET: optional(z.string().min(24, "REVALIDATE_SECRET must have 24+ characters.")),
  /** Dashboard URL, for the "open the order" links in e-mails. */
  ADMIN_URL: z
    .url("ADMIN_URL must be a full URL, e.g. https://rassm.dz/admin.")
    .transform((url) => url.replace(/\/+$/, ""))
    .default("http://localhost:3000/admin"),
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
