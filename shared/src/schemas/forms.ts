import { z } from "zod";
import { algerianPhoneSchema } from "./customer";

export const emailSchema = z
  .string({ error: "Veuillez entrer votre adresse e-mail." })
  .trim()
  .min(1, "Veuillez entrer votre adresse e-mail.")
  .pipe(z.email("Veuillez entrer une adresse e-mail valide, par ex. nom@exemple.com."));

export const newsletterFormSchema = z.object({
  email: emailSchema,
});
export type NewsletterForm = z.infer<typeof newsletterFormSchema>;

export const CONTACT_SUBJECTS = ["order", "exchange", "collaboration", "other"] as const;
export const contactSubjectSchema = z.enum(CONTACT_SUBJECTS, {
  error: "Veuillez choisir un sujet.",
});
export type ContactSubject = z.infer<typeof contactSubjectSchema>;

/** French labels of the subject select. */
export const CONTACT_SUBJECT_LABELS: Record<ContactSubject, string> = {
  order: "Commande",
  exchange: "Échange",
  collaboration: "Collaboration",
  other: "Autre",
};

const optionalEmailMessage =
  "Adresse e-mail invalide (ex. nom@exemple.com), ou laissez le champ vide.";

/**
 * Contact page message. The phone is required (we answer by phone or WhatsApp); the
 * e-mail is optional. The subject starts empty in the form ("" = not chosen yet).
 */
export const contactFormSchema = z.object({
  firstName: z
    .string({ error: "Veuillez entrer votre prénom." })
    .trim()
    .min(2, "Veuillez entrer votre prénom.")
    .max(60, "Le prénom ne doit pas dépasser 60 caractères."),
  lastName: z
    .string({ error: "Veuillez entrer votre nom." })
    .trim()
    .min(2, "Veuillez entrer votre nom.")
    .max(60, "Le nom ne doit pas dépasser 60 caractères."),
  phone: algerianPhoneSchema,
  /** Optional: an empty field becomes `undefined` (and `undefined` is accepted, so a parsed message parses again). */
  email: z
    .string({ error: optionalEmailMessage })
    .trim()
    .max(254, optionalEmailMessage)
    .refine((value) => value === "" || z.email().safeParse(value).success, optionalEmailMessage)
    .transform((value) => value || undefined)
    .optional(),
  subject: z
    .string({ error: "Veuillez choisir un sujet." })
    .min(1, "Veuillez choisir un sujet.")
    .pipe(contactSubjectSchema),
  message: z
    .string({ error: "Veuillez écrire un message." })
    .trim()
    .min(10, "Votre message est un peu court : écrivez au moins 10 caractères.")
    .max(2000, "Le message ne doit pas dépasser 2 000 caractères."),
});
/** Values the form holds before validation. */
export type ContactFormValues = z.input<typeof contactFormSchema>;
/** Validated message (phone normalised, empty e-mail removed). */
export type ContactForm = z.output<typeof contactFormSchema>;

export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: "Veuillez entrer votre mot de passe." })
    .min(1, "Veuillez entrer votre mot de passe.")
    .max(200, "Le mot de passe est trop long."),
  /** "Se souvenir de moi": 30 days on this device instead of 12 hours. */
  remember: z.boolean().optional(),
});
export type AdminLogin = z.infer<typeof adminLoginSchema>;
/** The login form: the checkbox always has a value. */
export const adminLoginFormSchema = adminLoginSchema.extend({ remember: z.boolean() });
