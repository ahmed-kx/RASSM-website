// How customers reach RASSM. One place for the WhatsApp number and the social links,
// reused by the contact page, the footer and any other page.

/** WhatsApp and phone: the same Algerian mobile number. */
const PHONE_DISPLAY = "0780 29 49 10";
const PHONE_INTERNATIONAL = "213780294910";

export const CONTACT = {
  whatsapp: {
    display: PHONE_DISPLAY,
    href: `https://wa.me/${PHONE_INTERNATIONAL}`,
  },
  phone: {
    display: PHONE_DISPLAY,
    href: `tel:+${PHONE_INTERNATIONAL}`,
  },
  instagram: {
    handle: "@rassm.wear",
    href: "https://www.instagram.com/rassm.wear/",
  },
  tiktok: {
    handle: "@rassm.wear",
    href: "https://www.tiktok.com/@rassm.wear",
  },
} as const;
