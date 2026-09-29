import { strongPassword, validEmail } from "./validation";
export function accountChangePayload(
  kind: "email" | "password",
  email: string,
  password: string,
  repeat: string,
) {
  if (kind === "email") {
    if (!validEmail(email))
      throw new Error("Indiquez une adresse email valide.");
    return { email: email.trim() };
  }
  if (!strongPassword(password) || password !== repeat)
    throw new Error(
      "Utilisez au moins 8 caractères, une majuscule, une minuscule et un chiffre, puis confirmez le même mot de passe.",
    );
  return { password };
}
