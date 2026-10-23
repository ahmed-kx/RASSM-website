import type { Metadata } from "next";
import { InfoPage, InfoSection, Prose, proseLink } from "@/components/info/info-page";
import { CONTACT, whatsappLink } from "@/content/contact";
import { routes } from "@/lib/routes";

// Politique de confidentialité. To review with a legal advisor (Law 18-07, ANPDP): see
// docs/TODO.md. Keep it in sync with what the site really collects (docs/SECURITY.md).

const description =
  "Les données que RASSM collecte (commande, contact, newsletter, adresse IP, cookies Meta), pourquoi, combien de temps, et comment les faire supprimer.";

export const metadata: Metadata = {
  title: "Confidentialité",
  description,
  alternates: { canonical: routes.privacy },
  openGraph: { title: "Confidentialité | RASSM", description },
};

/** Bulleted lists inside the prose blocks. */
const LIST = "list-disc space-y-2 pl-5 marker:text-stone";

const DELETE_MESSAGE =
  "Bonjour RASSM, je souhaite accéder à mes données / les faire supprimer. Mon nom : … Le numéro de téléphone utilisé pour commander : …";

export default function PrivacyPage() {
  return (
    <InfoPage
      label="Vos données"
      title="Confidentialité"
      intro={
        <p>
          Ce que nous savons de vous, pourquoi, combien de temps nous le gardons, et comment nous
          demander de le supprimer. Nous ne vendons jamais vos données.
        </p>
      }
    >
      <InfoSection id="collected" title="Ce que nous collectons">
        <Prose>
          <ul className={LIST}>
            <li>
              <strong className="font-medium text-ink">Votre commande</strong> : nom complet, numéro
              de téléphone, wilaya, commune, adresse (livraison à domicile), produit, couleur,
              taille et quantité.
            </li>
            <li>
              <strong className="font-medium text-ink">Le formulaire de contact</strong> : prénom,
              nom, téléphone, e-mail (facultatif) et votre message.
            </li>
            <li>
              <strong className="font-medium text-ink">La newsletter</strong> : votre adresse
              e-mail.
            </li>
            <li>
              <strong className="font-medium text-ink">Des informations techniques</strong> :
              l&apos;adresse IP et le navigateur utilisés au moment d&apos;une commande, d&apos;un
              message ou d&apos;une inscription.
            </li>
            <li>
              <strong className="font-medium text-ink">Des cookies Meta</strong> (Facebook,
              Instagram) : « _fbp », un identifiant de votre navigateur, et « _fbc », qui retient le
              clic sur une de nos publicités. Tous deux durent 90 jours. Votre appareil garde aussi
              le résumé de votre dernière commande, pour l&apos;afficher sur la page de
              remerciement.
            </li>
          </ul>
        </Prose>
      </InfoSection>

      <InfoSection id="why" title="Pourquoi">
        <Prose>
          <ul className={LIST}>
            <li>
              <strong className="font-medium text-ink">Traiter et livrer votre commande</strong> :
              nous vous appelons pour la confirmer, puis notre transporteur Anderson reçoit votre
              nom, votre téléphone, votre wilaya, votre commune, votre adresse et le montant à payer
              à la livraison.
            </li>
            <li>
              <strong className="font-medium text-ink">Vous répondre</strong> quand vous nous
              écrivez.
            </li>
            <li>
              <strong className="font-medium text-ink">Vous envoyer la newsletter</strong>,
              seulement après que vous avez confirmé votre adresse avec le lien reçu par e-mail.
            </li>
            <li>
              <strong className="font-medium text-ink">Protéger la boutique</strong> :
              l&apos;adresse IP et le navigateur nous aident à repérer les fausses commandes et les
              robots.
            </li>
            <li>
              <strong className="font-medium text-ink">Mesurer nos publicités</strong> sur Facebook
              et Instagram (voir ci-dessous).
            </li>
          </ul>
        </Prose>
      </InfoSection>

      <InfoSection id="meta" title="Meta Pixel et API Conversions">
        <Prose>
          <p>
            Le Pixel Meta, sur le site, indique à Meta les pages vues, les produits consultés, le
            début d&apos;une commande et la commande passée (produit et montant). Il ne lit pas les
            champs de vos formulaires.
          </p>
          <p>
            Depuis notre serveur, nous envoyons aussi à Meta la commande passée, puis la commande
            confirmée après notre appel : votre téléphone, votre prénom, votre nom, votre wilaya et
            le pays, <strong className="font-medium text-ink">chiffrés</strong> (une empreinte
            SHA-256 : Meta la compare à ses propres données sans recevoir votre numéro ni votre nom
            en clair), ainsi que l&apos;adresse IP, le navigateur, les cookies « _fbp » et « _fbc »
            et le montant. Meta s&apos;en sert pour savoir quelles publicités amènent des commandes.
            Les commandes envoyées par des robots ne sont pas transmises.
          </p>
          <p>
            Vous pouvez bloquer ces cookies avec les réglages de votre navigateur ou un bloqueur de
            contenu : la commande fonctionne de la même façon.
          </p>
        </Prose>
      </InfoSection>

      <InfoSection id="partners" title="Nos prestataires">
        <Prose>
          <ul className={LIST}>
            <li>
              <strong className="font-medium text-ink">Anderson</strong> : la livraison de votre
              colis.
            </li>
            <li>
              <strong className="font-medium text-ink">Meta</strong> : la mesure de nos publicités
              (voir plus haut).
            </li>
            <li>
              <strong className="font-medium text-ink">Brevo</strong> : l&apos;envoi des e-mails
              (newsletter et e-mail de confirmation, et les e-mails qui nous préviennent d&apos;une
              nouvelle commande ou d&apos;un nouveau message).
            </li>
            <li>
              <strong className="font-medium text-ink">MongoDB Atlas</strong> : l&apos;hébergement
              de notre base de données.
            </li>
          </ul>
        </Prose>
      </InfoSection>

      <InfoSection id="retention" title="Combien de temps">
        <Prose>
          <ul className={LIST}>
            <li>
              <strong className="font-medium text-ink">Commandes</strong> : le temps du suivi, des
              échanges et de notre comptabilité.
            </li>
            <li>
              <strong className="font-medium text-ink">Adresse IP et navigateur</strong> : supprimés
              automatiquement après 12 mois.
            </li>
            <li>
              <strong className="font-medium text-ink">Messages</strong> : le temps de traiter votre
              demande.
            </li>
            <li>
              <strong className="font-medium text-ink">Newsletter</strong> : jusqu&apos;à votre
              désinscription (un lien dans chaque e-mail). Le lien de confirmation n&apos;est
              valable que 7 jours.
            </li>
            <li>
              <strong className="font-medium text-ink">Cookies Meta</strong> : 90 jours.
            </li>
          </ul>
        </Prose>
      </InfoSection>

      <InfoSection id="rights" title="Vos droits">
        <Prose>
          <p>
            Vous pouvez à tout moment savoir quelles données nous avons sur vous, les faire corriger
            ou supprimer, et refuser la newsletter. Écrivez-nous sur{" "}
            <a
              href={whatsappLink(DELETE_MESSAGE)}
              target="_blank"
              rel="noopener noreferrer"
              className={proseLink}
            >
              WhatsApp au {CONTACT.whatsapp.display}
            </a>{" "}
            avec votre nom et le numéro de téléphone utilisé pour commander : nous vous répondons
            rapidement.
          </p>
          <p>
            Ces droits vous sont garantis par la loi n° 18-07 du 10 juin 2018 relative à la
            protection des personnes physiques dans le traitement des données à caractère personnel.
            Vous pouvez aussi vous adresser à l&apos;Autorité nationale de protection des données à
            caractère personnel (ANPDP).
          </p>
          <p className="text-[13px] text-stone">Dernière mise à jour : octobre 2026.</p>
        </Prose>
      </InfoSection>
    </InfoPage>
  );
}
