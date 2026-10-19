import { describe, expect, it } from "vitest";
import { contactFormSchema, type ContactFormValues } from "./forms";

const valid: ContactFormValues = {
  firstName: "Amel",
  lastName: "Kaci",
  phone: "0780 29 49 10",
  email: "",
  subject: "exchange",
  message: "Bonjour, je voudrais échanger la taille de mon hoodie.",
};

function errors(values: Partial<ContactFormValues>): Record<string, string> {
  const result = contactFormSchema.safeParse({ ...valid, ...values });
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
  );
}

describe("contactFormSchema", () => {
  it("accepts a message without e-mail and normalises the phone", () => {
    const result = contactFormSchema.parse(valid);
    expect(result).toMatchObject({ phone: "0780294910", subject: "exchange" });
    expect(result.email).toBeUndefined();
    // A parsed message is valid input again (the data layer re-validates it).
    expect(contactFormSchema.parse(result)).toEqual(result);
  });

  it("accepts a valid optional e-mail", () => {
    expect(contactFormSchema.parse({ ...valid, email: " nom@exemple.com " }).email).toBe(
      "nom@exemple.com",
    );
  });

  it("requires the phone, in the Algerian format", () => {
    expect(errors({ phone: "" })).toEqual({ phone: "Veuillez entrer votre numéro de téléphone." });
    expect(errors({ phone: "0880 29 49 10" }).phone).toMatch(/^Numéro invalide/);
    expect(errors({ phone: "+33 6 12 34 56 78" }).phone).toMatch(/^Numéro invalide/);
  });

  it("rejects an invalid e-mail", () => {
    expect(errors({ email: "pas-un-email" })).toEqual({
      email: "Adresse e-mail invalide (ex. nom@exemple.com), ou laissez le champ vide.",
    });
  });

  it("requires every other field, in French", () => {
    expect(errors({ firstName: "", lastName: "", subject: "", message: "Salut" })).toEqual({
      firstName: "Veuillez entrer votre prénom.",
      lastName: "Veuillez entrer votre nom.",
      subject: "Veuillez choisir un sujet.",
      message: "Votre message est un peu court : écrivez au moins 10 caractères.",
    });
    expect(errors({ subject: "spam" })).toEqual({ subject: "Veuillez choisir un sujet." });
  });
});
