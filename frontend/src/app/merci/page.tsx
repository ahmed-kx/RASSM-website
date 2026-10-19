import type { Metadata } from "next";
import { OrderConfirmation } from "@/components/order/order-confirmation";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Merci pour votre commande",
  description: "Votre commande RASSM est enregistrée. Nous vous appellerons pour la confirmer.",
  robots: { index: false, follow: false },
};

export default async function ThankYouPage({ searchParams }: PageProps<"/merci">) {
  const value = (await searchParams).commande;
  const orderNumber = (Array.isArray(value) ? value[0] : value) ?? null;

  return (
    <Container size="narrow" className="py-12 md:py-20">
      <OrderConfirmation orderNumber={orderNumber} />
    </Container>
  );
}
