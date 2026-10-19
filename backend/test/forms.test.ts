import { describe, expect, it } from "vitest";
import { ContactMessageModel } from "../src/models/contact-message";
import { NewsletterSubscriberModel } from "../src/models/newsletter-subscriber";
import { testApp } from "./helpers";

const message = {
  firstName: "Amina",
  lastName: "Kaci",
  phone: "0770 12 34 56",
  email: "",
  subject: "exchange",
  message: "Bonjour, je voudrais échanger ma taille M contre une L.",
};

describe("POST /api/contact-messages", () => {
  it("saves a valid message (empty e-mail left out)", async () => {
    const { api } = testApp();
    await api.post("/api/contact-messages").send(message).expect(201, { ok: true });
    const saved = await ContactMessageModel.findOne().lean();
    expect(saved).toMatchObject({
      firstName: "Amina",
      phone: "0770123456",
      subject: "exchange",
      read: false,
    });
    expect(saved?.email).toBeUndefined();
  });

  it("returns French errors per field", async () => {
    const { api } = testApp();
    const res = await api
      .post("/api/contact-messages")
      .send({ ...message, phone: "12", subject: "", message: "Court" })
      .expect(400);
    expect(res.body.error.fields).toEqual({
      phone: expect.stringContaining("Numéro invalide"),
      subject: "Veuillez choisir un sujet.",
      message: "Votre message est un peu court : écrivez au moins 10 caractères.",
    });
  });

  it("honeypot filled: answers like a success and saves nothing", async () => {
    const { api } = testApp();
    await api
      .post("/api/contact-messages")
      .send({ ...message, website: "spam" })
      .expect(201, { ok: true });
    expect(await ContactMessageModel.countDocuments()).toBe(0);
  });
});

describe("POST /api/newsletter", () => {
  it("saves an e-mail once, even when signing up twice", async () => {
    const { api } = testApp();
    await api.post("/api/newsletter").send({ email: "Nour@Example.com" }).expect(201);
    await api.post("/api/newsletter").send({ email: "nour@example.com " }).expect(201);
    const subscribers = await NewsletterSubscriberModel.find().lean();
    expect(subscribers.map((subscriber) => subscriber.email)).toEqual(["nour@example.com"]);
  });

  it("refuses an invalid e-mail in French", async () => {
    const { api } = testApp();
    const res = await api.post("/api/newsletter").send({ email: "nour@" }).expect(400);
    expect(res.body.error.fields.email).toBe(
      "Veuillez entrer une adresse e-mail valide, par ex. nom@exemple.com.",
    );
  });
});
