// pnpm create-admin: creates a dashboard admin (or resets its password). The e-mail and the
// password are asked in the terminal (the password is not displayed) and never stored in code.
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { ADMIN_PASSWORD_MIN_LENGTH, adminPasswordSchema } from "@rassm/shared";
import { z } from "zod";
import { connectDatabase, disconnectDatabase } from "./db";
import { loadEnv } from "./env";
import { hashPassword } from "./lib/password";
import { AdminModel } from "./models/admin";
import { AdminPasswordResetModel } from "./models/admin-password-reset";
import { AdminSessionModel } from "./models/admin-session";
import { accountKey, clearThrottle } from "./services/login-throttle";

/** Output that can be muted while the password is typed. */
let muted = false;
const output = new Writable({
  write(chunk, _encoding, callback) {
    if (!muted) process.stdout.write(chunk);
    callback();
  },
});
const rl = createInterface({ input: process.stdin, output, terminal: process.stdin.isTTY });

// Answers in order (works with a terminal and with piped input).
const lines: string[] = [];
const waiting: ((line: string) => void)[] = [];
rl.on("line", (line) => {
  const next = waiting.shift();
  if (next) next(line);
  else lines.push(line);
});

function ask(question: string, { hidden = false } = {}): Promise<string> {
  process.stdout.write(question);
  muted = hidden;
  return new Promise((resolve) => {
    const done = (line: string) => {
      muted = false;
      if (hidden) process.stdout.write("\n");
      resolve(line.trim());
    };
    const queued = lines.shift();
    if (queued !== undefined) done(queued);
    else waiting.push(done);
  });
}

const env = loadEnv();

try {
  const email = z.email().safeParse((await ask("Admin e-mail: ")).toLowerCase());
  if (!email.success) throw new Error("Invalid e-mail address.");

  const password = await ask(
    `Password (${ADMIN_PASSWORD_MIN_LENGTH} characters minimum, not a common password, without "rassm"): `,
    { hidden: true },
  );
  const valid = adminPasswordSchema.safeParse(password);
  if (!valid.success) throw new Error(valid.error.issues[0]?.message ?? "Invalid password.");
  if ((await ask("Repeat the password: ", { hidden: true })) !== password) {
    throw new Error("The two passwords are different.");
  }

  await connectDatabase(env.MONGODB_URI, env.MONGODB_DB_NAME, {
    dnsFallbackServers: env.DNS_FALLBACK_SERVERS,
  });
  const existing = await AdminModel.findOne({ email: email.data });
  if (existing) {
    const answer = await ask(`An admin ${email.data} already exists. Reset its password? (y/N) `);
    if (!/^(y|yes|o|oui)$/i.test(answer)) throw new Error("Cancelled: nothing changed.");
    existing.passwordHash = await hashPassword(password);
    existing.passwordChangedAt = new Date();
    await existing.save();
    // Log out every open session, cancel the reset links and lift a login lock.
    await AdminSessionModel.deleteMany({ adminId: existing._id });
    await AdminPasswordResetModel.deleteMany({ adminId: existing._id });
    await clearThrottle([accountKey(email.data)]);
    console.warn(`Password reset for ${email.data}.`);
  } else {
    await AdminModel.create({ email: email.data, passwordHash: await hashPassword(password) });
    console.warn(`Admin ${email.data} created. Log in at /admin/connexion.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  rl.close();
  await disconnectDatabase().catch(() => undefined);
}
