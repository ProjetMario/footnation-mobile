export type CareerExperience = {
  native_experience_id?: string;
  club_id?: string;
  club: string;
  ageCategory: string;
  level: string;
  position: string;
  startYear: string;
  endYear: string;
  [key: string]: unknown;
};
export type ExperienceSnapshot = {
  id: string;
  experience_history: unknown;
  updated_at: string | null;
};
export type ExperienceAttempt = {
  version: 1;
  attemptId: string;
  userId: string;
  mode: "synced" | "profile-only";
  expected: unknown;
  history: unknown[];
};
export const experienceUuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
export function sameExperienceHistory(left: unknown, right: unknown): boolean {
  return (
    JSON.stringify(canonical(left ?? null)) ===
    JSON.stringify(canonical(right ?? null))
  );
}
export function editableExperience(value: unknown): CareerExperience | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    ["club", "ageCategory", "level", "position"].some(
      (key) => typeof row[key] !== "string",
    )
  )
    return null;
  const year = (value: unknown, end = false): string | null =>
    value == null || (end && value === "Présent")
      ? ""
      : typeof value === "string"
        ? value
        : typeof value === "number" &&
            Number.isInteger(value) &&
            value >= 1000 &&
            value <= 9999
          ? String(value)
          : null;
  const startYear = year(row.startYear),
    endYear = year(row.endYear, true);
  if (startYear === null || endYear === null) return null;
  return { ...row, startYear, endYear } as CareerExperience;
}
export function validateExperience(
  entry: CareerExperience,
  projected: boolean,
) {
  if (
    [entry.club, entry.ageCategory, entry.level, entry.position].some(
      (value) =>
        typeof value !== "string" || !value.trim() || value.trim().length > 200,
    )
  )
    throw new Error(
      "Renseignez le club, la catégorie, le niveau et le poste (200 caractères maximum).",
    );
  for (const value of [entry.startYear, entry.endYear])
    if (value && !/^[1-9][0-9]{3}$/.test(value))
      throw new Error(
        "Les années doivent comporter quatre chiffres, sans zéro initial.",
      );
  if (
    entry.startYear &&
    entry.endYear &&
    Number(entry.endYear) < Number(entry.startYear)
  )
    throw new Error("La fin ne peut pas précéder le début.");
  if (entry.club_id && !experienceUuid.test(entry.club_id))
    throw new Error("Resélectionnez un club valide dans l’annuaire.");
  if (projected && entry.club_id && !entry.startYear)
    throw new Error(
      "Indiquez l’année de début pour apparaître sur la fiche de ce club.",
    );
}
export function buildExperienceAttempt(input: {
  snapshot: ExperienceSnapshot;
  mode: ExperienceAttempt["mode"];
  action:
    | { type: "remove"; index: number }
    | {
        type: "save";
        index: number | null;
        entry: CareerExperience;
        clubConfirmed: boolean;
      };
  randomId: () => string;
}): ExperienceAttempt {
  const { snapshot, mode, action, randomId } = input;
  if (!experienceUuid.test(snapshot.id))
    throw new Error("Ce compte n’est plus disponible.");
  if (
    snapshot.experience_history != null &&
    !Array.isArray(snapshot.experience_history)
  )
    throw new Error(
      "Ce parcours ancien doit être vérifié avant modification ; son contenu a été conservé.",
    );
  const history: unknown[] = [
    ...((snapshot.experience_history as unknown[] | null) ?? []),
  ];
  if (
    action.index !== null &&
    (!Number.isInteger(action.index) ||
      action.index < 0 ||
      action.index >= history.length)
  )
    throw new Error(
      "Cette expérience n’est plus disponible. Rechargez le parcours.",
    );
  if (action.type === "remove") history.splice(action.index, 1);
  else {
    const previous =
      action.index === null ? null : editableExperience(history[action.index]);
    const entry = { ...action.entry, club: action.entry.club.trim() };
    // Only a pre-existing native identity may be retained. A legacy selected ID
    // is re-confirmed in the picker before attributing a new club projection.
    delete entry.native_experience_id;
    if (previous?.native_experience_id)
      entry.native_experience_id = previous.native_experience_id;
    else if (mode === "synced" && (!entry.club_id || action.clubConfirmed))
      entry.native_experience_id = randomId();
    if (
      entry.native_experience_id &&
      !experienceUuid.test(entry.native_experience_id)
    )
      throw new Error("L’identifiant de cette expérience doit être vérifié.");
    validateExperience(entry, !!entry.native_experience_id);
    if (action.index === null) history.push(entry);
    else history[action.index] = entry;
  }
  if (history.length > 200)
    throw new Error(
      "Votre parcours contient plus de 200 expériences. Retirez une entrée avant d’en ajouter.",
    );
  const attempt: ExperienceAttempt = JSON.parse(
    JSON.stringify({
      version: 1,
      attemptId: randomId(),
      userId: snapshot.id,
      mode,
      expected: snapshot.experience_history ?? null,
      history,
    }),
  );
  if (!experienceUuid.test(attempt.attemptId))
    throw new Error("Impossible de préparer cet enregistrement.");
  if (JSON.stringify(attempt).length > 96000)
    throw new Error(
      "Ce parcours est trop volumineux pour conserver une reprise sécurisée sur cet appareil.",
    );
  return attempt;
}
export function experienceCapability(error: unknown, data: unknown): boolean {
  if (error) {
    const code = (error as { code?: unknown }).code;
    if (code === "PGRST202" || code === "42883") return false;
    throw error;
  }
  if (typeof data !== "boolean")
    throw new Error(
      "La disponibilité de la synchronisation n’a pas pu être vérifiée.",
    );
  return data;
}
export function experienceSaveError(error: unknown): Error {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "23505")
    return new Error(
      "Une ligne existe déjà pour ce club et cette année. Elle a été conservée ; aucune modification du parcours n’a été enregistrée. Vérifiez les dates ou choisissez de conserver cette expérience sans lien de club.",
    );
  if (code === "40001" || code === "PGRST116")
    return new Error(
      "Votre parcours a changé sur un autre appareil. Rechargez-le avant de modifier ; votre tentative n’a rien écrasé.",
    );
  if (code === "23503")
    return new Error(
      "Le club sélectionné n’est plus disponible. Rechargez le parcours et choisissez une autre fiche.",
    );
  if (code === "42501")
    return new Error(
      "Ce compte n’est plus autorisé à modifier le parcours. Vérifiez votre connexion.",
    );
  if (code === "PGRST202" || code === "42883")
    return new Error(
      "La synchronisation des clubs est indisponible. Cette tentative reste conservée pour réessayer.",
    );
  return error instanceof Error
    ? error
    : new Error(
        "L’enregistrement n’a pas pu être confirmé. Réessayez la même tentative pour vérifier son résultat.",
      );
}
/** Persist before TanStack's offline onMutate guard can reject the network work. */
export async function stageExperienceAttempt(
  attempt: ExperienceAttempt,
  save: (attempt: ExperienceAttempt) => Promise<void>,
  assertIdentity: () => void,
) {
  assertIdentity();
  await save(attempt);
  assertIdentity();
  return attempt;
}
export async function saveExperienceAttempt(
  attempt: ExperienceAttempt,
  repository: {
    assertIdentity: () => void | Promise<void>;
    read: () => Promise<ExperienceSnapshot>;
    sync: (
      expected: unknown,
      history: unknown[],
    ) => Promise<ExperienceSnapshot>;
    update: (
      history: unknown[],
      expectedHistory: unknown,
    ) => Promise<ExperienceSnapshot | null>;
  },
): Promise<ExperienceSnapshot> {
  const ensure = async () => repository.assertIdentity();
  await ensure();
  const current = await repository.read();
  await ensure();
  if (current.id !== attempt.userId)
    throw new Error(
      "Votre session a changé. Retrouvez le compte de ce parcours.",
    );
  if (sameExperienceHistory(current.experience_history, attempt.history))
    return current;
  if (!sameExperienceHistory(current.experience_history, attempt.expected))
    throw experienceSaveError({ code: "40001" });
  await ensure();
  const saved =
    attempt.mode === "synced"
      ? await repository.sync(attempt.expected, attempt.history)
      : await repository.update(attempt.history, current.experience_history);
  await ensure();
  if (!saved) throw experienceSaveError({ code: "40001" });
  if (
    saved.id !== attempt.userId ||
    !sameExperienceHistory(saved.experience_history, attempt.history)
  )
    throw new Error(
      "Le résultat ne correspond pas à cette tentative. Rechargez le parcours pour le vérifier.",
    );
  return saved;
}
