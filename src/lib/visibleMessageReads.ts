export function visibleMessageReads(
  messages: readonly {
    id: string;
    sender_id: string;
    receiver_id: string;
    read_at: string | null;
    is_blocked: boolean | null;
  }[],
  visibleIds: readonly string[],
  viewer: string | undefined,
  peer: string,
  active: boolean,
  completed: ReadonlySet<string>,
): string[] {
  if (!viewer || !active) return [];
  const visible = new Set(visibleIds);
  return [
    ...new Set(
      messages
        .filter(
          (message) =>
            visible.has(message.id) &&
            message.receiver_id === viewer &&
            message.sender_id === peer &&
            !message.read_at &&
            !message.is_blocked &&
            !completed.has(message.id),
        )
        .map((message) => message.id),
    ),
  ];
}
