import { describe, expect, it } from "vitest";
import {
  activeRailStory,
  buildStoryRail,
  isSyntheticProfileName,
  nextRailExpiry,
  type StoryRailProfile,
  type StoryRailSnapshot,
  type StoryRailStory,
} from "../src/lib/storyRail";

const now = Date.parse("2026-09-10T12:00:00Z");
const person = (
  id: string,
  extra: Partial<StoryRailProfile> = {},
): StoryRailProfile => ({
  id,
  full_name: `Membre ${id}`,
  username: null,
  avatar_url: null,
  is_private: false,
  is_suspended: false,
  ...extra,
});
const story = (
  id: string,
  userId: string,
  createdMinutes = 0,
  expiresMinutes = 30,
): StoryRailStory => ({
  id,
  user_id: userId,
  created_at: new Date(now + createdMinutes * 60000).toISOString(),
  expires_at: new Date(now + expiresMinutes * 60000).toISOString(),
});
const snapshot = (
  extra: Partial<StoryRailSnapshot> = {},
): StoryRailSnapshot => ({
  accountId: "me",
  profiles: [],
  stories: [],
  blocks: [],
  ...extra,
});

describe("story profile rail", () => {
  it("makes one bubble per real member and uses the newest active story", () => {
    const data = snapshot({
      profiles: [person("a"), person("a"), person("b")],
      stories: [
        story("older", "a", -10),
        story("newer", "a"),
        story("own", "me"),
      ],
    });
    const entries = buildStoryRail(data, "me", person("me"), now);
    expect(
      entries.map((entry) => [entry.profile.id, entry.story?.id, entry.own]),
    ).toEqual([
      ["me", "own", true],
      ["a", "newer", false],
      ["b", undefined, false],
    ]);
  });

  it("never manufactures a member from a story whose profile was not returned", () => {
    const entries = buildStoryRail(
      snapshot({ stories: [story("hidden", "not-readable")] }),
      "me",
      person("me"),
      now,
    );
    expect(entries.map((entry) => entry.profile.id)).toEqual(["me"]);
  });

  it("removes both incoming and outgoing blocks without hiding unrelated pairs", () => {
    const entries = buildStoryRail(
      snapshot({
        profiles: [person("a"), person("b"), person("c")],
        stories: [story("a-story", "a"), story("b-story", "b")],
        blocks: [
          { blocker_id: "me", blocked_id: "a" },
          { blocker_id: "b", blocked_id: "me" },
          { blocker_id: "someone", blocked_id: "c" },
        ],
      }),
      "me",
      person("me"),
      now,
    );
    expect(entries.map((entry) => entry.profile.id)).toEqual(["me", "c"]);
  });

  it("excludes private and suspended members, including members with active stories", () => {
    const entries = buildStoryRail(
      snapshot({
        profiles: [
          person("private", { is_private: true }),
          person("suspended", { is_suspended: true }),
          person("temporary", {
            is_suspended: true,
            suspended_until: new Date(now + 60000).toISOString(),
          }),
          person("restored", {
            is_suspended: true,
            suspended_until: new Date(now - 1).toISOString(),
          }),
        ],
        stories: [
          story("private-story", "private"),
          story("suspended-story", "suspended"),
        ],
      }),
      "me",
      person("me", { is_private: true }),
      now,
    );
    expect(entries.map((entry) => entry.profile.id)).toEqual([
      "me",
      "restored",
    ]);
  });

  it("turns an expired story into a neutral profile at its exact expiry", () => {
    const data = snapshot({
      profiles: [person("a")],
      stories: [
        story("active", "a", 0, 1),
        { ...story("invalid", "a"), expires_at: "invalid" },
      ],
    });
    expect(buildStoryRail(data, "me", null, now)[0].story?.id).toBe("active");
    expect(buildStoryRail(data, "me", null, now + 60000)[0].story).toBeNull();
    expect(activeRailStory(data.stories[0], now + 60000)).toBe(false);
    expect(nextRailExpiry(data.stories, now)).toBe(now + 60000);
    expect(nextRailExpiry(data.stories, now + 60000)).toBeNull();
  });

  it("keeps a member hidden if duplicate profile reads disagree about privacy", () => {
    expect(
      buildStoryRail(
        snapshot({
          profiles: [person("a"), person("a", { is_private: true })],
          stories: [story("active", "a")],
        }),
        "me",
        null,
        now,
      ),
    ).toEqual([]);
  });

  it("does not carry cached members, stories or another own profile across accounts", () => {
    const data = snapshot({
      profiles: [person("a")],
      stories: [story("active", "a")],
    });
    expect(buildStoryRail(data, "new-account", person("me"), now)).toEqual([]);
    expect(
      buildStoryRail(data, "new-account", person("new-account"), now).map(
        (entry) => entry.profile.id,
      ),
    ).toEqual(["new-account"]);
    expect(buildStoryRail(data, undefined, person("me"), now)).toEqual([]);
  });

  it("keeps real profiles without stories alongside a busy set of story authors", () => {
    const authors = Array.from({ length: 15 }, (_, index) =>
      person(`author-${index}`),
    );
    const members = Array.from({ length: 8 }, (_, index) =>
      person(`member-${index}`),
    );
    const entries = buildStoryRail(
      snapshot({
        profiles: [...authors, ...members],
        stories: authors.map((profile, index) =>
          story(`story-${index}`, profile.id, -index),
        ),
      }),
      "me",
      person("me"),
      now,
    );
    expect(entries.filter((entry) => !entry.own && entry.story)).toHaveLength(
      10,
    );
    expect(entries.filter((entry) => !entry.own && !entry.story)).toHaveLength(
      6,
    );
    expect(new Set(entries.map((entry) => entry.profile.id)).size).toBe(
      entries.length,
    );
  });

  it("prioritizes a filled name and photo over incomplete or technical-name profiles", () => {
    const profiles = [
      person("technical", {
        full_name: "aff4ad2b-aff4ad2b",
        avatar_url: "https://example.com/technical.jpg",
      }),
      person("no-photo", { full_name: "Abdel" }),
      person("username-photo", {
        full_name: null,
        username: "footballfan",
        avatar_url: "https://example.com/fan.jpg",
      }),
      person("complete", {
        full_name: "Zoé Martin",
        avatar_url: "https://example.com/zoe.jpg",
      }),
      person("empty", { full_name: null, username: null }),
    ];
    const entries = buildStoryRail(snapshot({ profiles }), "me", null, now);
    expect(entries.map((entry) => entry.profile.id)).toEqual([
      "complete",
      "no-photo",
      "username-photo",
      "empty",
      "technical",
    ]);
    expect(entries.at(-1)?.profile.full_name).toBe("aff4ad2b-aff4ad2b");
    expect(entries).toHaveLength(profiles.length);
  });

  it("recognizes technical placeholders without treating real names or mononyms as IDs", () => {
    for (const name of [
      "aff4ad2b-aff4ad2b",
      " B237A88A-B237A88A ",
      "fb398c10-fb398c10",
      "4b5d758b-871b-4762-a16d-69d57b1ad33c",
    ])
      expect(isSyntheticProfileName(name)).toBe(true);
    for (const name of [
      "Abdel",
      "Neymar",
      "Élodie Le Roux",
      "Jean-Pierre",
      "FC Metz",
      "Ali7",
      null,
    ])
      expect(isSyntheticProfileName(name)).toBe(false);
  });

  it("keeps an active story ahead of profile-completeness ranking without renaming its author", () => {
    const entries = buildStoryRail(
      snapshot({
        profiles: [
          person("technical", { full_name: "aff4ad2b-aff4ad2b" }),
          person("complete", {
            full_name: "Zoé Martin",
            avatar_url: "https://example.com/zoe.jpg",
          }),
        ],
        stories: [story("active", "technical")],
      }),
      "me",
      null,
      now,
    );
    expect(entries[0].profile.full_name).toBe("aff4ad2b-aff4ad2b");
    expect(entries[0].story?.id).toBe("active");
  });
});
