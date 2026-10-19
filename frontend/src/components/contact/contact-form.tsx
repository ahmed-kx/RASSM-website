"use client";

import {
  CONTACT_SUBJECTS,
  CONTACT_SUBJECT_LABELS,
  contactFormSchema,
  type ContactFormValues,
} from "@rassm/shared";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField, describedBy } from "@/components/ui/form-field";
import { ChevronDownIcon } from "@/components/ui/icons";
import { CONTACT } from "@/content/contact";
import { cn } from "@/lib/cn";
import { sendContactMessage } from "@/lib/data/contact";

const defaultValues: ContactFormValues = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  subject: "",
  message: "",
};

/** Compact, light inputs, as in design/Contact.png. */
const fieldBase =
  "w-full border border-line bg-paper/70 px-4 text-sm text-ink placeholder:text-stone/80 transition-colors focus:border-ink focus:outline-none aria-invalid:border-error";
const fieldInput = cn(fieldBase, "h-10");

type TextField = "firstName" | "lastName" | "phone" | "email";

/** "Envoyez-nous un message": validated with the shared Zod schema (French errors). */
export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const sending = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const form = useForm({
    defaultValues,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: contactFormSchema },
    onSubmit: async ({ value, formApi }) => {
      try {
        await sendContactMessage(contactFormSchema.parse(value));
        setStatus("sent");
        formApi.reset();
      } catch {
        setStatus("error");
      }
    },
    onSubmitInvalid: () => {
      requestAnimationFrame(() => {
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      });
    },
  });

  const submit = async () => {
    if (sending.current) return; // A double click sends one message.
    sending.current = true;
    setStatus("idle");
    try {
      await form.handleSubmit();
    } finally {
      sending.current = false;
    }
  };

  const textField = (
    name: TextField,
    label: string,
    options: {
      type?: string;
      autoComplete?: string;
      inputMode?: "tel" | "email";
      placeholder?: string;
      optional?: boolean;
      className?: string;
    } = {},
  ) => (
    <form.Field name={name}>
      {(field) => {
        const id = `contact-${name}`;
        const error = field.state.meta.errors[0]?.message;
        return (
          <FormField
            id={id}
            label={label}
            error={error}
            labelStyle="plain"
            required={!options.optional}
            optional={options.optional}
            className={options.className}
          >
            <input
              id={id}
              name={name}
              type={options.type ?? "text"}
              inputMode={options.inputMode}
              autoComplete={options.autoComplete}
              placeholder={options.placeholder}
              value={field.state.value ?? ""}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
              {...describedBy(id, error)}
              className={fieldInput}
            />
          </FormField>
        );
      }}
    </form.Field>
  );

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void submit();
      }}
      className="mt-6 grid gap-x-5 gap-y-3.5 sm:grid-cols-2"
    >
      {textField("firstName", "Prénom", {
        autoComplete: "given-name",
        placeholder: "Votre prénom",
      })}
      {textField("lastName", "Nom", { autoComplete: "family-name", placeholder: "Votre nom" })}
      {textField("phone", "Téléphone", {
        type: "tel",
        inputMode: "tel",
        autoComplete: "tel-national",
        placeholder: "0555 12 34 56",
      })}
      {textField("email", "E-mail", {
        type: "email",
        inputMode: "email",
        autoComplete: "email",
        placeholder: "vous@exemple.com",
        optional: true,
      })}

      <form.Field name="subject">
        {(field) => {
          const error = field.state.meta.errors[0]?.message;
          return (
            <FormField
              id="contact-subject"
              label="Sujet"
              error={error}
              labelStyle="plain"
              required
              className="sm:col-span-2"
            >
              <div className="relative">
                <select
                  id="contact-subject"
                  name="subject"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  {...describedBy("contact-subject", error)}
                  className={cn(
                    fieldInput,
                    "appearance-none pr-10",
                    !field.state.value && "text-stone",
                  )}
                >
                  <option value="">Choisissez un sujet</option>
                  {CONTACT_SUBJECTS.map((subject) => (
                    <option key={subject} value={subject} className="text-ink">
                      {CONTACT_SUBJECT_LABELS[subject]}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2" />
              </div>
            </FormField>
          );
        }}
      </form.Field>

      <form.Field name="message">
        {(field) => {
          const error = field.state.meta.errors[0]?.message;
          return (
            <FormField
              id="contact-message"
              label="Message"
              error={error}
              labelStyle="plain"
              required
              className="sm:col-span-2"
            >
              <textarea
                id="contact-message"
                name="message"
                rows={4}
                placeholder="Votre message…"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                {...describedBy("contact-message", error)}
                className={cn(fieldBase, "min-h-24 resize-y py-2.5 leading-relaxed")}
              />
            </FormField>
          );
        }}
      </form.Field>

      <div className="sm:col-span-2">
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button
              type="submit"
              surface="light"
              withArrow={!isSubmitting}
              disabled={isSubmitting}
              className="w-full disabled:opacity-60 sm:w-auto"
            >
              {isSubmitting ? "Envoi en cours…" : "Envoyer le message"}
            </Button>
          )}
        </form.Subscribe>
        <div role="status" className="mt-4 min-h-5 text-sm">
          {status === "sent" && (
            <p className="border-l-2 border-ink pl-3 leading-relaxed">
              Merci, votre message est bien envoyé. Nous vous répondons rapidement, par téléphone ou
              sur WhatsApp.
            </p>
          )}
          {status === "error" && (
            <p className="text-error">
              Votre message n&apos;a pas pu être envoyé. Réessayez, ou écrivez-nous sur WhatsApp au{" "}
              {CONTACT.whatsapp.display}.
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
