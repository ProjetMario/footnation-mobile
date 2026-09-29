export function membershipOperation(
  desired: "join" | "leave",
  role: string | null,
  isCreator: boolean,
  privacy: string,
): "join" | "leave" | "none" {
  if (desired === "join" && role) return "none";
  if (desired === "leave" && !role) return "none";
  if (desired === "leave" && (role === "admin" || isCreator))
    throw new Error(
      "Un administrateur doit conserver la gestion de ce groupe.",
    );
  if (desired === "join" && privacy !== "public")
    throw new Error("Ce groupe privé nécessite une invitation.");
  return desired;
}
