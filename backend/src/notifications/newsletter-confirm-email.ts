import { escapeHtml, type Email } from "./brevo";

// Double opt-in: the e-mail a new newsletter subscriber receives (French, to the customer). Only
// after clicking its link is the address added to the Brevo list.

export const NEWSLETTER_CONFIRM_DAYS = 7;

export function buildNewsletterConfirmEmail(link: string): Email {
  const intro =
    "Merci pour votre inscription à la newsletter RASSM. Confirmez votre adresse pour recevoir nos nouveaux drops et nos nouvelles.";
  const ignore =
    "Vous n'êtes pas à l'origine de cette inscription ? Ignorez simplement cet e-mail : vous ne recevrez rien.";
  const validity = `Ce lien est valable ${NEWSLETTER_CONFIRM_DAYS} jours.`;
  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#F5F2EC;font-family:Georgia,'Times New Roman',serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F2EC;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FBF8F3;border:1px solid #D6D2CA">
<tr><td style="background:#111111;padding:20px 24px;color:#FBF8F3;font-size:22px;letter-spacing:4px">RASSM</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 16px;color:#111111;font-size:22px;font-weight:normal">Confirmez votre inscription</h1>
<p style="margin:0 0 20px;color:#403E3C;font-size:15px;line-height:1.6">${escapeHtml(intro)}</p>
<p style="margin:0 0 20px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#111111;color:#FBF8F3;padding:14px 22px;text-decoration:none;font-size:13px;letter-spacing:2px;text-transform:uppercase">Confirmer mon inscription</a></p>
<p style="margin:0 0 8px;color:#74706D;font-size:13px;line-height:1.5">${escapeHtml(validity)}</p>
<p style="margin:0;color:#74706D;font-size:13px;line-height:1.5">${escapeHtml(ignore)}</p>
</td></tr></table></td></tr></table></body></html>`;
  return {
    subject: "Confirmez votre inscription à la newsletter RASSM",
    html,
    text: [
      "Confirmez votre inscription",
      "",
      intro,
      "",
      `Confirmer mon inscription : ${link}`,
      "",
      validity,
      ignore,
    ].join("\n"),
  };
}
