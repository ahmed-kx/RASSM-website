import { z } from "zod";

const emailSchema = z
  .string({ error: "Veuillez entrer votre adresse e-mail." })
  .trim()
  .min(1, "Veuillez entrer votre adresse e-mail.")
  .pipe(z.email("Veuillez entrer une adresse e-mail valide, par ex. nom@exemple.com."));

export const newsletterFormSchema = z.object({
  email: emailSchema,
});
export type NewsletterForm = z.infer<typeof newsletterFormSchema>;

export const contactFormSchema = z.object({
  name: z
    .string({ error: "Veuillez entrer votre nom." })
    .trim()
    .min(2, "Veuillez entrer votre nom.")
    .max(80, "Le nom ne doit pas dépasser 80 caractères."),
  email: emailSchema,
  message: z
    .string({ error: "Veuillez écrire un message." })
    .trim()
    .min(10, "Votre message est un peu court : écrivez au moins 10 caractères.")
    .max(2000, "Le message ne doit pas dépasser 2 000 caractères."),
});
export type ContactForm = z.infer<typeof contactFormSchema>;

export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: "Veuillez entrer votre mot de passe." })
    .min(1, "Veuillez entrer votre mot de passe.")
    .max(200, "Le mot de passe est trop long."),
});
export type AdminLogin = z.infer<typeof adminLoginSchema>;
