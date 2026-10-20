import { describe, expect, it } from "vitest";
import {
  adminChangePasswordFormSchema,
  adminNewPasswordFormSchema,
  adminPasswordSchema,
  formatLockMessage,
  isCommonPassword,
} from "./admin-security";

const firstError = (value: string) =>
  adminPasswordSchema.safeParse(value).error?.issues[0]?.message;

describe("admin password rules", () => {
  it("needs at least 12 characters", () => {
    expect(firstError("Court-42!")).toBe("Le mot de passe doit contenir au moins 12 caractères.");
    expect(firstError("Bleu-nuit-sur-la-ville-42")).toBeUndefined();
  });

  it("refuses a password containing « rassm », in any case", () => {
    expect(firstError("MonRaSsM-de-2026!")).toBe("Le mot de passe ne doit pas contenir « rassm ».");
  });

  it("refuses common passwords, including with digits, symbols or leetspeak", () => {
    for (const common of [
      "123456789012",
      "azertyuiop123",
      "P@ssw0rd2024!!",
      "motdepasse2026",
      "Admin123456789",
      "qwertyqwertyqwerty",
      "aaaaaaaaaaaaaa",
      "1q2w3e4r5t6y",
      "!!!!????2026....",
    ]) {
      expect(isCommonPassword(common), common).toBe(true);
      expect(firstError(common)).toBe(
        "Ce mot de passe est trop courant : choisissez-en un plus personnel.",
      );
    }
    for (const personal of [
      "Bleu-nuit-sur-la-ville-42",
      "le chat dort sur le piano",
      "Tlemcen#Nuit2026",
    ]) {
      expect(isCommonPassword(personal), personal).toBe(false);
    }
  });

  it("checks the confirmation and a new password different from the current one", () => {
    const mismatch = adminNewPasswordFormSchema.safeParse({
      password: "Bleu-nuit-sur-la-ville-42",
      confirmPassword: "Bleu-nuit-sur-la-ville-43",
    });
    expect(mismatch.error?.issues[0]).toMatchObject({
      path: ["confirmPassword"],
      message: "Les deux mots de passe ne sont pas identiques.",
    });
    const same = adminChangePasswordFormSchema.safeParse({
      currentPassword: "Bleu-nuit-sur-la-ville-42",
      newPassword: "Bleu-nuit-sur-la-ville-42",
      confirmPassword: "Bleu-nuit-sur-la-ville-42",
    });
    expect(same.error?.issues[0]).toMatchObject({
      path: ["newPassword"],
      message: "Le nouveau mot de passe doit être différent de l'actuel.",
    });
  });

  it("writes the lock message in French minutes", () => {
    expect(formatLockMessage(15)).toBe("Trop de tentatives. Réessayez dans 15 minutes.");
    expect(formatLockMessage(0.2)).toBe("Trop de tentatives. Réessayez dans 1 minute.");
    expect(formatLockMessage(29.1)).toBe("Trop de tentatives. Réessayez dans 30 minutes.");
  });
});
