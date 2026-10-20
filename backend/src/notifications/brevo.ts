// Brevo API (transactional e-mails to the team, newsletter contacts) and the e-mail layout
// shared by the new order and new message e-mails.

export interface EmailConfig {
  brevoApiKey: string;
  /** Recipient, e.g. rassmwear@gmail.com. */
  notifyEmail: string;
  /** Sender, validated in Brevo. */
  from: string;
  /** Dashboard URL (links to the order or the message). */
  adminUrl: string;
}

export interface Email {
  subject: string;
  html: string;
  text: string;
}

const BREVO_API = "https://api.brevo.com/v3";

export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  );

/** "0555123456" → "0555 12 34 56" */
export const formatPhone = (phone: string) =>
  phone.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4");

/** A Brevo API call; throws with the status and the start of the body when it fails. */
export async function brevoRequest(
  apiKey: string,
  path: string,
  init: { method: string; body?: unknown },
): Promise<Response> {
  const response = await fetch(`${BREVO_API}${path}`, {
    method: init.method,
    headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
    ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const body = (await response.text().catch(() => "")).slice(0, 500);
    throw new Error(`Brevo answered ${response.status}: ${body}`);
  }
  return response;
}

/** Sends one e-mail to the team. Throws when Brevo refuses it. */
export async function sendTeamEmail(config: EmailConfig, email: Email): Promise<void> {
  await brevoRequest(config.brevoApiKey, "/smtp/email", {
    method: "POST",
    body: {
      sender: { name: "RASSM", email: config.from },
      to: [{ email: config.notifyEmail }],
      subject: email.subject,
      htmlContent: email.html,
      textContent: email.text,
    },
  });
}

/** The RASSM e-mail: black header, eyebrow, title, red flags, label / value rows, button. */
export function renderTeamEmail(content: {
  eyebrow: string;
  title: string;
  flags?: readonly string[];
  rows: readonly [string, string][];
  /** The last row in bold (e.g. "Total à encaisser"). */
  strongLast?: boolean;
  /** A free text block under the rows (e.g. the message). */
  body?: string;
  button: { label: string; href: string };
  footer: string;
}): string {
  const flagHtml = (content.flags ?? [])
    .map(
      (line) =>
        `<p style="margin:0 0 8px;padding:10px 12px;background:#F6E3DF;color:#9B2C1F;font-size:14px;font-weight:600">${escapeHtml(line)}</p>`,
    )
    .join("");
  const rowsHtml = content.rows
    .map(
      ([label, value], index) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #D6D2CA;color:#74706D;font-size:13px;width:42%">${escapeHtml(label)}</td><td style="padding:8px 0;border-bottom:1px solid #D6D2CA;color:#111111;font-size:14px;${content.strongLast && index === content.rows.length - 1 ? "font-weight:700;font-size:16px" : ""}">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const bodyHtml = content.body
    ? `<p style="margin:18px 0 0;padding:14px 16px;background:#F5F2EC;color:#111111;font-size:15px;line-height:1.55;white-space:pre-wrap">${escapeHtml(content.body)}</p>`
    : "";
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#F5F2EC;font-family:Georgia,'Times New Roman',serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F2EC;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FBF8F3;border:1px solid #D6D2CA">
<tr><td style="background:#111111;padding:20px 24px;color:#FBF8F3;font-size:22px;letter-spacing:4px">RASSM</td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 4px;color:#74706D;font-size:11px;letter-spacing:3px;text-transform:uppercase">${escapeHtml(content.eyebrow)}</p>
<h1 style="margin:0 0 16px;color:#111111;font-size:22px;font-weight:normal">${escapeHtml(content.title)}</h1>
${flagHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
${bodyHtml}
<p style="margin:24px 0 8px"><a href="${escapeHtml(content.button.href)}" style="display:inline-block;background:#111111;color:#FBF8F3;padding:14px 22px;text-decoration:none;font-size:13px;letter-spacing:2px;text-transform:uppercase">${escapeHtml(content.button.label)}</a></p>
<p style="margin:12px 0 0;color:#74706D;font-size:12px">${escapeHtml(content.footer)}</p>
</td></tr></table></td></tr></table></body></html>`;
}
