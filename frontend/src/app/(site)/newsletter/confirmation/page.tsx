import type { Metadata } from "next";
import { NewsletterConfirmation } from "@/components/layout/newsletter-confirmation";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Confirmation de la newsletter",
  description: "Confirmez votre inscription à la newsletter RASSM.",
  robots: { index: false, follow: false },
};

export default function NewsletterConfirmationPage() {
  return (
    <Container size="narrow" className="py-20 md:py-28">
      <NewsletterConfirmation />
    </Container>
  );
}
