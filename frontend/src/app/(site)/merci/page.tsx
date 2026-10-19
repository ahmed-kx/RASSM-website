import type { Metadata } from "next";
import { OrderReceived } from "@/components/order/order-confirmation";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Commande reçue",
  description:
    "Votre commande RASSM est bien reçue. Nous vous appellerons très bientôt pour la confirmer.",
  robots: { index: false, follow: false },
};

export default function ThankYouPage() {
  return (
    <Container size="narrow" className="py-12 md:py-20">
      <OrderReceived />
    </Container>
  );
}
