import { z } from "zod";
import { idSchema, isoDateSchema } from "./common";
import { emailSchema } from "./forms";

// Admin account security: password rules, password reset and change, sessions.

export const ADMIN_PASSWORD_MIN_LENGTH = 12;

/** Failed logins (per account and per IP) before a lock. */
export const MAX_FAILED_LOGINS = 5;
/** First lock: 15 minutes, then doubled at each new lock (30 min, 1 h…), up to 24 hours. */
export const FIRST_LOCK_MINUTES = 15;
export const MAX_LOCK_MINUTES = 24 * 60;
/** A password reset link is valid 30 minutes and works once. */
export const PASSWORD_RESET_MINUTES = 30;

/** "Si ce compte existe…": the same answer whether the e-mail exists or not. */
export const FORGOT_PASSWORD_MESSAGE =
  "Si ce compte existe, un e-mail a été envoyé. Le lien est valable 30 minutes.";
export const INVALID_RESET_LINK =
  "Ce lien n'est plus valide (déjà utilisé ou expiré). Demandez un nouveau lien.";

/** "Trop de tentatives. Réessayez dans 15 minutes." */
export function formatLockMessage(minutes: number): string {
  const rounded = Math.max(1, Math.ceil(minutes));
  return `Trop de tentatives. Réessayez dans ${rounded} minute${rounded > 1 ? "s" : ""}.`;
}

// Words that make a password easy to guess, once digits, symbols and leetspeak are removed
// ("P@ssw0rd2024!" → "password"). A password made only of digits or of one of these words
// (or a short repetition of one) is refused.
const COMMON_WORDS = [
  "password",
  "passw",
  "pass",
  "motdepasse",
  "mdp",
  "admin",
  "administrateur",
  "administrator",
  "root",
  "user",
  "login",
  "welcome",
  "bienvenue",
  "letmein",
  "iloveyou",
  "jetaime",
  "loveyou",
  "azerty",
  "azertyuiop",
  "qwerty",
  "qwertyuiop",
  "qwertz",
  "asdfgh",
  "asdfghjkl",
  "zxcvbn",
  "abcdef",
  "abcdefgh",
  "abcdefghijkl",
  "abc",
  "aaaaaa",
  "secret",
  "master",
  "dragon",
  "monkey",
  "football",
  "soleil",
  "bonjour",
  "salut",
  "doudou",
  "chouchou",
  "princesse",
  "algerie",
  "algeria",
  "dzair",
  "alger",
  "oran",
  "boutique",
  "shop",
  "store",
  "streetwear",
  "hoodie",
  "changeme",
  "default",
  "test",
  "demo",
  "temp",
  "sunshine",
  "princess",
  "shadow",
  "superman",
  "batman",
  "trustno",
  "starwars",
  "whatever",
  "freedom",
  "hello",
  "computer",
  "internet",
];
const COMMON_PASSWORDS = new Set([
  "123456789012",
  "1234567890123",
  "12345678901234",
  "123123123123",
  "111111111111",
  "000000000000",
  "123456123456",
  "987654321098",
  "qwertyuiop123",
  "azertyuiop123",
  "1q2w3e4r5t6y",
  "q1w2e3r4t5y6",
  "1qaz2wsx3edc",
  "qazwsxedcrfv",
  "zaq12wsxcde3",
  "passwordpassword",
  "motdepasse123",
  "iloveyou1234",
  "abcd12345678",
]);
const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
  "!": "i",
};

/** True for a password found in the common list or built on a common word. */
export function isCommonPassword(password: string): boolean {
  const lower = password.normalize("NFKC").toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return true;
  if (/^(.)\1+$/.test(lower) || /^\d+$/.test(lower)) return true;
  // Letters only, read two ways: digits and symbols dropped ("admin2026" → "admin"), and
  // leetspeak inside the word read as letters once the digits around it are cut
  // ("P@ssw0rd2024!" → "password").
  const plain = lower.replace(/[^a-z]/g, "");
  if (!plain) return true;
  const core = lower.replace(/^[^a-z@$]+|[^a-z]+$/g, "");
  const leet = [...core]
    .map((char) => LEET[char] ?? char)
    .join("")
    .replace(/[^a-z]/g, "");
  return [plain, leet].some((letters) =>
    COMMON_WORDS.some(
      (word) =>
        letters === word ||
        (letters.length % word.length === 0 &&
          letters === word.repeat(letters.length / word.length)),
    ),
  );
}

/** Password rules for an admin account (reset, change, create-admin script). */
export const adminPasswordSchema = z
  .string({ error: "Veuillez entrer un mot de passe." })
  .min(
    ADMIN_PASSWORD_MIN_LENGTH,
    `Le mot de passe doit contenir au moins ${ADMIN_PASSWORD_MIN_LENGTH} caractères.`,
  )
  .max(200, "Le mot de passe est trop long.")
  .refine((value) => !/rassm/i.test(value), {
    message: "Le mot de passe ne doit pas contenir « rassm ».",
  })
  .refine((value) => !isCommonPassword(value), {
    message: "Ce mot de passe est trop courant : choisissez-en un plus personnel.",
  });

const currentPasswordSchema = z
  .string({ error: "Veuillez entrer votre mot de passe actuel." })
  .min(1, "Veuillez entrer votre mot de passe actuel.")
  .max(200, "Le mot de passe est trop long.");

const confirmSchema = z.string({ error: "Veuillez confirmer le mot de passe." });
const SAME_PASSWORDS = "Les deux mots de passe ne sont pas identiques.";

/** POST /auth/password/forgot */
export const adminForgotPasswordSchema = z.object({ email: emailSchema });
export type AdminForgotPassword = z.infer<typeof adminForgotPasswordSchema>;

/** The random token of a reset link (base64url). */
export const passwordResetTokenSchema = z
  .string({ error: INVALID_RESET_LINK })
  .regex(/^[A-Za-z0-9_-]{32,100}$/, INVALID_RESET_LINK);

/** POST /auth/password/reset */
export const adminResetPasswordSchema = z.object({
  token: passwordResetTokenSchema,
  password: adminPasswordSchema,
});
export type AdminResetPassword = z.infer<typeof adminResetPasswordSchema>;

/** The new password form (reset link): the password typed twice. */
export const adminNewPasswordFormSchema = z
  .object({ password: adminPasswordSchema, confirmPassword: confirmSchema })
  .refine((value) => value.password === value.confirmPassword, {
    message: SAME_PASSWORDS,
    path: ["confirmPassword"],
  });

/** POST /security/password (Paramètres > Sécurité). */
export const adminChangePasswordSchema = z
  .object({ currentPassword: currentPasswordSchema, newPassword: adminPasswordSchema })
  .refine((value) => value.newPassword !== value.currentPassword, {
    message: "Le nouveau mot de passe doit être différent de l'actuel.",
    path: ["newPassword"],
  });
export type AdminChangePassword = z.infer<typeof adminChangePasswordSchema>;

export const adminChangePasswordFormSchema = z
  .object({
    currentPassword: currentPasswordSchema,
    newPassword: adminPasswordSchema,
    confirmPassword: confirmSchema,
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    message: "Le nouveau mot de passe doit être différent de l'actuel.",
    path: ["newPassword"],
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: SAME_PASSWORDS,
    path: ["confirmPassword"],
  });

export const DEVICE_TYPES = ["desktop", "mobile", "tablet", "unknown"] as const;

/** An open session (Paramètres > Sécurité). */
export const adminSessionInfoSchema = z.object({
  id: idSchema,
  /** The session of this browser. */
  current: z.boolean(),
  /** "Chrome 141" */
  browser: z.string(),
  /** "Windows" */
  os: z.string(),
  deviceType: z.enum(DEVICE_TYPES),
  /** "Alger, Algérie" when the host gives it (proxy headers), else null. */
  location: z.string().nullable(),
  ip: z.string().nullable(),
  /** "Se souvenir de moi" (30 days) or a 12-hour session. */
  remember: z.boolean(),
  createdAt: isoDateSchema,
  lastActivityAt: isoDateSchema,
  /** When it ends at the latest (the 2-hour inactivity limit can end it earlier). */
  expiresAt: isoDateSchema,
});
export type AdminSessionInfo = z.infer<typeof adminSessionInfoSchema>;

export const adminSessionListSchema = z.object({ sessions: z.array(adminSessionInfoSchema) });
