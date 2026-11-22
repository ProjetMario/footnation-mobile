import { isActiveLiveStream, type ClubLiveStream } from "./clubLive";

export function liveLinkId(value: unknown): string | null {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value.toLowerCase()
    : null;
}

type LiveLinkReader = {
  stream: (id: string) => Promise<ClubLiveStream | null>;
  clubStreams: (id: string) => Promise<ClubLiveStream[]>;
};

/** Both reads use the current Supabase session/RLS, never fabricated media. */
export async function resolveLiveLink(
  id: unknown,
  explicitStream: unknown,
  reader: LiveLinkReader,
): Promise<ClubLiveStream | null> {
  const explicit = explicitStream !== undefined;
  const selected = liveLinkId(explicit ? explicitStream : id);
  if (!selected) return null;
  const stream = await reader.stream(selected);
  if (stream) return stream;
  // An explicit old ?stream= identifies one broadcast. Never silently play
  // another broadcast when that ID is unavailable or no longer visible.
  if (explicit) return null;
  const streams = await reader.clubStreams(selected);
  return (
    streams.find(
      (row) => row.club_id === selected && isActiveLiveStream(row),
    ) || null
  );
}

/** A URL is a preference only; managed-club rows are loaded from the backend. */
export function managedLiveClubId(
  requested: unknown,
  managed: ReadonlyArray<{ club_id: string }> | undefined,
) {
  const id = liveLinkId(requested);
  return id && managed?.some((row) => row.club_id === id) ? id : null;
}
