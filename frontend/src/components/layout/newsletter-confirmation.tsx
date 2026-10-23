"use client";

import { INVALID_NEWSLETTER_LINK, newsletterConfirmSchema } from "@rassm/shared";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { confirmNewsletter } from "@/lib/data/newsletter";
import { routes } from "@/lib/routes";

type State =
  { status: "checking" } | { status: "confirmed" } | { status: "error"; message: string };

const NETWORK_ERROR = "Connexion impossible. Vérifiez votre connexion internet et rouvrez le lien.";

/**
 * The page opened from the newsletter confirmation e-mail. The token is in the link's fragment
 * (#jeton=…): never sent to a server log. It is read once, removed from the address bar, then
 * sent to the API, which adds the address to the newsletter.
 */
export function NewsletterConfirmation() {
  const [state, setState] = useState<State>({ status: "checking" });

  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get("jeton");
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    const token = newsletterConfirmSchema.safeParse({ token: value });
    if (!token.success) {
      setState({ status: "error", message: INVALID_NEWSLETTER_LINK });
      return;
    }
    let active = true;
    confirmNewsletter(token.data.token)
      .then(() => active && setState({ status: "confirmed" }))
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          status: "error",
          message: error instanceof ApiError && error.status !== 0 ? error.message : NETWORK_ERROR,
        });
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div role="status" className="mx-auto max-w-xl text-center">
      <h1 className="font-display text-4xl leading-none font-semibold text-ink uppercase md:text-5xl">
        {state.status === "confirmed" ? "C'est confirmé" : "Newsletter"}
      </h1>
      <p className="mt-6 text-base leading-relaxed text-ash">
        {state.status === "checking" && "Confirmation de votre inscription…"}
        {state.status === "confirmed" &&
          "Merci ! Votre inscription à la newsletter est confirmée. Vous recevrez nos prochains drops en avant-première."}
        {state.status === "error" && state.message}
      </p>
      {state.status !== "checking" && (
        <Button href={routes.collection} surface="light" withArrow className="mt-10">
          Découvrir la collection
        </Button>
      )}
    </div>
  );
}
