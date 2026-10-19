"use client";

import { newsletterFormSchema } from "@rassm/shared";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useState } from "react";
import { ArrowRightIcon } from "@/components/ui/icons";
import { subscribeToNewsletter } from "@/lib/data/newsletter";

/**
 * Newsletter sign-up. Validated with the shared Zod schema: first on submit,
 * then on every change once the customer has tried to submit.
 */
export function NewsletterForm() {
  const [subscribed, setSubscribed] = useState(false);

  const form = useForm({
    defaultValues: { email: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: newsletterFormSchema },
    onSubmit: async ({ value, formApi }) => {
      await subscribeToNewsletter(newsletterFormSchema.parse(value));
      setSubscribed(true);
      formApi.reset();
    },
  });

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Field name="email">
        {(field) => {
          const error = field.state.meta.errors[0]?.message;
          return (
            <>
              <label htmlFor="newsletter-email" className="sr-only">
                Votre adresse e-mail
              </label>
              <div className="flex border border-ink/70 transition-colors focus-within:border-ink">
                <input
                  id="newsletter-email"
                  name={field.name}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="Votre e-mail"
                  value={field.state.value}
                  onChange={(event) => {
                    setSubscribed(false);
                    field.handleChange(event.target.value);
                  }}
                  onBlur={field.handleBlur}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "newsletter-email-error" : undefined}
                  className="h-11 min-w-0 flex-1 bg-transparent px-4 text-sm text-ink placeholder:text-stone focus:outline-none"
                />
                <form.Subscribe selector={(state) => state.isSubmitting}>
                  {(isSubmitting) => (
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      aria-label="S'inscrire pour recevoir les nouveautés"
                      className="grid w-12 shrink-0 place-items-center text-ink transition-opacity hover:opacity-70 focus-visible:outline-1 focus-visible:-outline-offset-4 focus-visible:outline-ink disabled:opacity-40"
                    >
                      <ArrowRightIcon width={18} height={18} />
                    </button>
                  )}
                </form.Subscribe>
              </div>
              {error && (
                <p id="newsletter-email-error" className="mt-2 text-xs text-error">
                  {error}
                </p>
              )}
            </>
          );
        }}
      </form.Field>
      <p role="status" className="mt-2 min-h-4 text-xs text-ash">
        {subscribed && "Merci ! Votre inscription à la newsletter est confirmée."}
      </p>
    </form>
  );
}
