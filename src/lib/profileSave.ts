type Row = Record<string, unknown>;
export function profileSnapshotRequest(payload: Row, baseline: Row) {
  const values = Object.fromEntries(
    Object.entries(payload).filter(([key]) => key !== "id"),
  );
  return {
    p_values: values,
    p_expected: Object.fromEntries(
      Object.keys(values).map((key) => [key, baseline[key] ?? null]),
    ),
  };
}
export async function saveProfileSnapshot(
  repository: {
    read: () => Promise<Row | null>;
    insert: (payload: Row) => Promise<Row>;
    update: (payload: Row, baseline: Row) => Promise<Row | null>;
  },
  payload: Row,
  baseline: Row | null,
): Promise<Row> {
  const current = await repository.read();
  if (
    current &&
    Object.entries(payload).every(
      ([key, value]) => JSON.stringify(current[key]) === JSON.stringify(value),
    )
  )
    return current;
  if (!baseline) {
    if (current)
      throw new Error(
        "Votre profil existe déjà avec d’autres informations. Rechargez le formulaire.",
      );
    return repository.insert(payload);
  }
  const saved = await repository.update(payload, baseline);
  if (!saved)
    throw new Error(
      "Votre profil a changé ou n’est plus accessible. Rechargez le formulaire avant de réessayer.",
    );
  return saved;
}
