export function scheduleStoryView(options: {
  uid: string;
  owner: string;
  expiresAt: string;
  isCurrent: () => boolean;
  authenticate: () => Promise<string | undefined>;
  record: () => Promise<void>;
  onSuccess: () => void;
  onError: (error: unknown) => void;
}): () => void {
  let cancelled = false;
  const eligible = () =>
    !cancelled &&
    !!options.uid &&
    options.uid !== options.owner &&
    Number.isFinite(Date.parse(options.expiresAt)) &&
    Date.parse(options.expiresAt) > Date.now() &&
    options.isCurrent();
  if (!eligible())
    return () => {
      cancelled = true;
    };
  const timer = setTimeout(() => {
    void (async () => {
      if (!eligible()) return;
      const uid = await options.authenticate();
      if (!eligible()) return;
      if (uid !== options.uid) throw new Error("Votre session a changé.");
      await options.record();
      if (eligible()) options.onSuccess();
    })().catch((error) => {
      if (eligible()) options.onError(error);
    });
  }, 1000);
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
