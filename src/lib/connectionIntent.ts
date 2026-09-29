export type ConnectionRow = {
  id: string;
  user_id: string;
  connected_user_id: string;
  status: string;
};
export async function rejectConnectionIntent(
  repository: {
    read: () => Promise<ConnectionRow | null>;
    reject: () => Promise<boolean>;
  },
  expected: ConnectionRow,
  uid: string,
  peer: string,
): Promise<void> {
  if (
    !uid ||
    uid === peer ||
    expected.user_id !== peer ||
    expected.connected_user_id !== uid ||
    expected.status !== "pending"
  )
    throw new Error("Seul le destinataire peut refuser cette invitation.");
  const completed = (row: ConnectionRow | null) => {
    if (
      !row ||
      row.id !== expected.id ||
      row.user_id !== peer ||
      row.connected_user_id !== uid ||
      !["pending", "rejected"].includes(row.status)
    )
      throw new Error(
        "Cette invitation a changé. Annulez et actualisez le profil.",
      );
    return row.status === "rejected";
  };
  if (completed(await repository.read())) return;
  try {
    if (await repository.reject()) return;
  } catch (error) {
    if (completed(await repository.read())) return;
    throw error;
  }
  if (!completed(await repository.read()))
    throw new Error("Le refus n’a pas été confirmé. Réessayez la même action.");
}
export async function removeConnectionIntent(
  repository: {
    read: () => Promise<ConnectionRow | null>;
    remove: (expected: ConnectionRow) => Promise<boolean>;
  },
  expected: ConnectionRow,
  uid: string,
  peer: string,
): Promise<void> {
  const validate = (current: ConnectionRow | null) => {
    if (
      !uid ||
      uid === peer ||
      !(
        (expected.user_id === uid && expected.connected_user_id === peer) ||
        (expected.user_id === peer && expected.connected_user_id === uid)
      )
    )
      throw new Error("Cette invitation appartient à une autre relation.");
    if (
      current &&
      (current.id !== expected.id ||
        current.user_id !== expected.user_id ||
        current.connected_user_id !== expected.connected_user_id ||
        current.status !== expected.status)
    )
      throw new Error(
        "Cette relation a changé. Annulez et actualisez avant de confirmer son retrait.",
      );
  };
  const current = await repository.read();
  validate(current);
  if (!current) return;
  try {
    if (await repository.remove(expected)) return;
  } catch (error) {
    const after = await repository.read();
    validate(after);
    if (!after) return;
    throw error;
  }
  const after = await repository.read();
  validate(after);
  if (after)
    throw new Error(
      "Le retrait n’a pas été confirmé. Réessayez la même action.",
    );
}
export function connectionIntent(
  expected: ConnectionRow | null,
  current: ConnectionRow | null,
  uid: string,
  peer: string,
): "create" | "accept" | "done" {
  for (const row of [expected, current]) {
    if (
      row &&
      !(
        (row.user_id === uid && row.connected_user_id === peer) ||
        (row.user_id === peer && row.connected_user_id === uid)
      )
    )
      throw new Error("Cette invitation appartient à une autre relation.");
  }
  if (expected) {
    if (
      expected.status !== "pending" ||
      expected.connected_user_id !== uid ||
      current?.id !== expected.id ||
      !["pending", "accepted"].includes(current.status)
    )
      throw new Error(
        "Cette invitation a changé. Actualisez la relation avant de continuer.",
      );
    return current.status === "accepted" ? "done" : "accept";
  }
  if (!current) return "create";
  if (
    current.status === "accepted" ||
    (current.status === "pending" && current.user_id === uid)
  )
    return "done";
  throw new Error(
    "Une invitation existe déjà. Actualisez la relation pour la consulter.",
  );
}

export function selectConnection(
  rows: ConnectionRow[],
  uid: string,
  peer: string,
): ConnectionRow | null {
  const valid = rows.filter(
    (row) =>
      (row.user_id === uid && row.connected_user_id === peer) ||
      (row.user_id === peer && row.connected_user_id === uid),
  );
  const priority = (row: ConnectionRow) =>
    row.status === "accepted"
      ? 0
      : row.status === "pending"
        ? row.connected_user_id === uid
          ? 1
          : 2
        : 3;
  return (
    [...valid].sort(
      (a, b) => priority(a) - priority(b) || a.id.localeCompare(b.id),
    )[0] || null
  );
}
