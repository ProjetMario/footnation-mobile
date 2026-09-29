import type { Profile } from "./models";
import { isSuspended } from "./validation";

export type StoryRailProfile = Pick<
  Profile,
  | "id"
  | "full_name"
  | "username"
  | "avatar_url"
  | "is_suspended"
  | "suspended_until"
> & { is_private?: boolean | null };

export type StoryRailStory = {
  id: string;
  user_id: string;
  created_at: string;
  expires_at: string;
};

export type StoryRailSnapshot = {
  accountId: string;
  profiles: StoryRailProfile[];
  stories: StoryRailStory[];
  blocks: { blocker_id: string; blocked_id: string }[];
};

export type StoryRailEntry = {
  profile: StoryRailProfile;
  story: StoryRailStory | null;
  own: boolean;
};

export function activeRailStory(story: StoryRailStory | null, now: number) {
  return (
    !!story?.id && Number.isFinite(now) && Date.parse(story.expires_at) > now
  );
}

/** Recognize UUIDs and the repeated UUID-prefix placeholder used by old accounts. */
export function isSyntheticProfileName(name: string | null | undefined) {
  const value = name?.trim() || "";
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    ) || /^([0-9a-f]{8})-\1$/i.test(value)
  );
}

function profilePriority(profile: StoryRailProfile) {
  const fullName = profile.full_name?.trim();
  if (isSyntheticProfileName(fullName || profile.username)) return -1;
  const hasPhoto = !!profile.avatar_url?.trim();
  if (fullName) return hasPhoto ? 3 : 2;
  return hasPhoto ? 1 : 0;
}

/** Combine only profiles already readable through the authenticated profile query. */
export function buildStoryRail(
  snapshot: StoryRailSnapshot | undefined,
  accountId: string | undefined,
  ownProfile: StoryRailProfile | null,
  now: number,
): StoryRailEntry[] {
  if (!accountId || !Number.isFinite(now)) return [];
  const own =
    ownProfile?.id === accountId && !isSuspended(ownProfile, now)
      ? ownProfile
      : null;
  const entries: StoryRailEntry[] = own
    ? [{ profile: own, story: null, own: true }]
    : [];
  if (!snapshot || snapshot.accountId !== accountId) return entries;
  const blocked = new Set(
    snapshot.blocks.flatMap((block) =>
      block.blocker_id === accountId
        ? [block.blocked_id]
        : block.blocked_id === accountId
          ? [block.blocker_id]
          : [],
    ),
  );
  // If duplicate reads disagree, a private/suspended row always wins.
  for (const profile of snapshot.profiles) {
    if (profile.is_private === true || isSuspended(profile, now))
      blocked.add(profile.id);
  }
  const profiles = new Map<string, StoryRailProfile>();
  for (const profile of snapshot.profiles) {
    if (
      !profile.id ||
      profile.id === accountId ||
      profile.is_private === true ||
      isSuspended(profile, now) ||
      blocked.has(profile.id)
    )
      continue;
    if (!profiles.has(profile.id)) profiles.set(profile.id, profile);
  }
  const active = [...snapshot.stories]
    .filter((story) => activeRailStory(story, now))
    .sort(
      (a, b) =>
        (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0) ||
        a.id.localeCompare(b.id),
    );
  const latest = new Map<string, StoryRailStory>();
  for (const story of active) {
    if (!latest.has(story.user_id)) latest.set(story.user_id, story);
  }
  if (own) entries[0].story = latest.get(accountId) || null;
  const storyEntries: StoryRailEntry[] = [];
  for (const [userId, story] of latest) {
    const profile = profiles.get(userId);
    if (profile) storyEntries.push({ profile, story, own: false });
  }
  // Keep room for real members without stories, even on a busy story day.
  entries.push(...storyEntries.slice(0, 10));
  entries.push(
    ...[...profiles.values()]
      .filter((profile) => !latest.has(profile.id))
      .sort(
        (a, b) =>
          profilePriority(b) - profilePriority(a) ||
          (a.full_name || a.username || "").localeCompare(
            b.full_name || b.username || "",
            "fr",
          ) ||
          a.id.localeCompare(b.id),
      )
      .slice(0, 6)
      .map((profile) => ({ profile, story: null, own: false })),
  );
  return entries;
}

export function nextRailExpiry(
  stories: StoryRailStory[],
  now: number,
): number | null {
  const expiries = stories
    .map((story) => Date.parse(story.expires_at))
    .filter((expiry) => Number.isFinite(expiry) && expiry > now);
  return expiries.length ? Math.min(...expiries) : null;
}
