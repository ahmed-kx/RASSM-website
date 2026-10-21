import { ALGIERS_TIME_ZONE, PASSWORD_RESET_MINUTES } from "@rassm/shared";
import { describeError, logger } from "../lib/logger";
import { parseUserAgent } from "../lib/user-agent";
import { renderTeamEmail, sendEmail, type Email, type EmailConfig } from "./brevo";

// E-mails to the admin about their account (Brevo): the password reset link and the security
// alerts (new browser, password changed or reset, account locked). Sent in the background by
// the auth service; a failure is logged, never shown to the person logging in.

/** Where and how it happened. */
export interface SecurityContext {
  at: Date;
  ip: string | null;
  userAgent: string | null;
  location: string | null;
}

export type SecurityAlertKind = "new-device" | "password-changed" | "password-reset" | "locked";

export interface SecurityAlert {
  kind: SecurityAlertKind;
  context: SecurityContext;
  /** For "locked": how long. */
  lockMinutes?: number;
}

export interface SecurityMailer {
  sendPasswordReset(to: string, link: string, context: SecurityContext): Promise<void>;
  sendAlert(to: string, alert: SecurityAlert): Promise<void>;
}

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  timeZone: ALGIERS_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("fr-FR", {
  timeZone: ALGIERS_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

/** The label / value rows of every security e-mail. */
export function contextRows(context: SecurityContext): [string, string][] {
  const device = parseUserAgent(context.userAgent);
  return [
    ["Date", dateFormat.format(context.at)],
    ["Heure", `${timeFormat.format(context.at)} (heure d'Algérie)`],
    ["Appareil", device.os],
    ["Navigateur", device.browser],
    ["Lieu approximatif", context.location ?? "Inconnu"],
    ["Adresse IP", context.ip ?? "Inconnue"],
  ];
}

const ALERTS: Record<SecurityAlertKind, { subject: string; title: string; intro: string }> = {
  "new-device": {
    subject: "Nouvelle connexion à votre compte RASSM",
    title: "Connexion depuis un nouvel appareil",
    intro:
      "Votre compte administrateur vient d'être utilisé depuis un appareil ou un navigateur inconnu.",
  },
  "password-changed": {
    subject: "Votre mot de passe RASSM a été modifié",
    title: "Mot de passe modifié",
    intro:
      "Le mot de passe de votre compte administrateur a été modifié. Les autres sessions ont été déconnectées.",
  },
  "password-reset": {
    subject: "Votre mot de passe RASSM a été réinitialisé",
    title: "Mot de passe réinitialisé",
    intro:
      "Le mot de passe de votre compte administrateur a été réinitialisé avec un lien envoyé par e-mail. Toutes les sessions ont été déconnectées.",
  },
  locked: {
    subject: "Compte RASSM bloqué après plusieurs tentatives",
    title: "Compte bloqué temporairement",
    intro: "Plusieurs mots de passe incorrects ont été saisis sur votre compte administrateur.",
  },
};

const NOT_YOU =
  "Si ce n'est pas vous, changez votre mot de passe tout de suite et déconnectez les autres sessions dans Paramètres > Sécurité.";

export function securityLink(adminUrl: string): string {
  return `${adminUrl}/parametres#securite`;
}

export function buildSecurityAlertEmail(alert: SecurityAlert, adminUrl: string): Email {
  const content = ALERTS[alert.kind];
  const intro =
    alert.kind === "locked"
      ? `${content.intro} Le compte et l'adresse IP utilisée sont bloqués pendant ${alert.lockMinutes ?? 15} minutes. Vous pouvez toujours réinitialiser votre mot de passe depuis la page de connexion.`
      : content.intro;
  const rows = contextRows(alert.context);
  const link = securityLink(adminUrl);
  const footer =
    alert.kind === "password-reset" || alert.kind === "password-changed"
      ? `Ce n'était pas vous ? Réinitialisez votre mot de passe depuis la page de connexion. ${NOT_YOU}`
      : NOT_YOU;
  return {
    subject: content.subject,
    html: renderTeamEmail({
      eyebrow: "Sécurité du compte",
      title: content.title,
      rows,
      body: intro,
      button: { label: "Ouvrir la sécurité", href: link },
      footer,
    }),
    text: [
      content.title,
      "",
      intro,
      "",
      ...rows.map(([label, value]) => `${label} : ${value}`),
      "",
      `Sécurité du compte : ${link}`,
      "",
      footer,
    ].join("\n"),
  };
}

export function buildPasswordResetEmail(link: string, context: SecurityContext): Email {
  const rows = contextRows(context);
  const intro = `Une demande de nouveau mot de passe a été faite pour votre compte administrateur. Le lien est valable ${PASSWORD_RESET_MINUTES} minutes et ne fonctionne qu'une fois.`;
  const footer =
    "Vous n'avez rien demandé ? Ignorez cet e-mail : votre mot de passe ne change pas.";
  return {
    subject: "Réinitialiser votre mot de passe RASSM",
    html: renderTeamEmail({
      eyebrow: "Sécurité du compte",
      title: "Nouveau mot de passe",
      rows,
      body: intro,
      button: { label: "Choisir un nouveau mot de passe", href: link },
      footer,
    }),
    text: [
      "Nouveau mot de passe",
      "",
      intro,
      "",
      `Choisir un nouveau mot de passe : ${link}`,
      "",
      ...rows.map(([label, value]) => `${label} : ${value}`),
      "",
      footer,
    ].join("\n"),
  };
}

/**
 * Brevo sender. Without BREVO_API_KEY nothing is sent; in development the reset link is then
 * written to the API logs so the flow can still be tested locally.
 */
export function createSecurityMailer(
  config: EmailConfig | null,
  { logResetLinks = false }: { logResetLinks?: boolean } = {},
): SecurityMailer {
  return {
    async sendPasswordReset(to, link, context) {
      if (!config) {
        // Development without Brevo only (never in production): the logger would mask the
        // link, so it is printed as is to let the developer open it.
        if (logResetLinks)
          console.warn(`Password reset link (development only, no Brevo): ${link}`);
        else logger.warn("Password reset e-mail not sent: BREVO_API_KEY is not set");
        return;
      }
      try {
        await sendEmail(config, to, buildPasswordResetEmail(link, context));
        logger.info("Password reset e-mail sent");
      } catch (error) {
        logger.error("Password reset e-mail failed", describeError(error));
      }
    },
    async sendAlert(to, alert) {
      if (!config) {
        logger.warn("Security alert not sent: BREVO_API_KEY is not set", { kind: alert.kind });
        return;
      }
      try {
        await sendEmail(config, to, buildSecurityAlertEmail(alert, config.adminUrl));
        logger.info("Security alert sent", { kind: alert.kind });
      } catch (error) {
        logger.error("Security alert failed", { kind: alert.kind, ...describeError(error) });
      }
    },
  };
}
