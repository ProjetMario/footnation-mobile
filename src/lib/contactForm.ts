import { validEmail } from "./validation";

type ContactForm = {
  firstName: string;
  lastName: string;
  email: string;
  message: string;
};

/** Match the required identity fields of the existing contact-form endpoint. */
export function contactFormPayload(form: ContactForm) {
  const firstName = form.firstName.trim();
  const lastName = form.lastName.trim();
  const email = form.email.trim();
  const message = form.message.trim();
  if (!firstName || !lastName)
    throw new Error("Indiquez votre prénom et votre nom.");
  if (!validEmail(email))
    throw new Error("Indiquez une adresse e-mail valide.");
  if (!message) throw new Error("Écrivez votre message.");
  if (message.length > 5000)
    throw new Error("Votre message doit contenir au maximum 5 000 caractères.");
  return { firstName, lastName, email, profileType: "autre", message };
}
