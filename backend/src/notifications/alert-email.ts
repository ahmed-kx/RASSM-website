import { renderTeamEmail, type Email } from "./brevo";

// Alerts to the team (NOTIFY_EMAIL): many orders from one IP, or a variant losing more than half
// of its stock within an hour. Possible fake orders: the team checks them by phone before
// cancelling anything.

export type TeamAlert =
  | {
      kind: "ip";
      ip: string;
      /** Orders and units of that IP in the last 24 hours, the new one included. */
      orders: number;
      units: number;
      orderId: string;
      orderNumber: string;
    }
  | {
      kind: "stock";
      productId: string;
      productName: string;
      color: string;
      size: string;
      /** Units ordered in the last hour, and the stock before them and now. */
      lost: number;
      before: number;
      remaining: number;
    };

const articles = (count: number) => `${count} article${count > 1 ? "s" : ""}`;

export function buildAlertEmail(alert: TeamAlert, adminUrl: string): Email {
  if (alert.kind === "ip") {
    const rows: [string, string][] = [
      ["Adresse IP", alert.ip],
      ["Commandes en 24 h", String(alert.orders)],
      ["Articles en 24 h", String(alert.units)],
      ["Dernière commande", alert.orderNumber],
    ];
    const intro =
      "Beaucoup de commandes viennent de la même connexion. Ce peut être un robot, ou plusieurs vrais clients du même opérateur mobile : appelez avant d'annuler.";
    const link = `${adminUrl}/commandes/${alert.orderId}`;
    return {
      subject: `[Alerte] ${alert.orders} commandes depuis la même adresse IP`,
      html: renderTeamEmail({
        eyebrow: "Alerte · commandes",
        title: `${alert.orders} commandes, ${articles(alert.units)} depuis une même IP`,
        flags: [intro],
        rows,
        button: { label: "Voir la commande", href: link },
        footer: "Les commandes sont marquées « Suspecte » dans le tableau de bord.",
      }),
      text: [
        `Alerte : ${alert.orders} commandes depuis la même adresse IP`,
        intro,
        "",
        ...rows.map(([label, value]) => `${label} : ${value}`),
        "",
        `Voir la commande : ${link}`,
      ].join("\n"),
    };
  }
  const percent = Math.round((alert.lost / alert.before) * 100);
  const rows: [string, string][] = [
    ["Produit", alert.productName],
    ["Couleur", alert.color],
    ["Taille", alert.size],
    ["Commandés en 1 heure", articles(alert.lost)],
    ["Stock il y a 1 heure", String(alert.before)],
    ["Stock restant", String(alert.remaining)],
  ];
  const intro = `Cette taille a perdu ${percent} % de son stock en moins d'une heure. Vérifiez les dernières commandes : appelez avant d'annuler.`;
  const link = `${adminUrl}/commandes?statut=pending`;
  return {
    subject: `[Alerte] Stock en forte baisse : ${alert.productName} ${alert.color} ${alert.size}`,
    html: renderTeamEmail({
      eyebrow: "Alerte · stock",
      title: `${alert.productName} · ${alert.color} · ${alert.size}`,
      flags: [intro],
      rows,
      button: { label: "Voir les nouvelles commandes", href: link },
      footer: "Une seule alerte par taille et par heure.",
    }),
    text: [
      `Alerte : stock en forte baisse (${alert.productName}, ${alert.color}, ${alert.size})`,
      intro,
      "",
      ...rows.map(([label, value]) => `${label} : ${value}`),
      "",
      `Voir les nouvelles commandes : ${link}`,
    ].join("\n"),
  };
}
