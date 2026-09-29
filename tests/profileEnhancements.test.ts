import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  from: vi.fn(),
  upload: vi.fn(),
  search: vi.fn(),
}));
vi.mock("../src/lib/supabase", () => ({ supabase: mock }));
vi.mock("../src/lib/media", () => ({ uploadPhoto: mock.upload }));
vi.mock("../src/lib/globalSearch", () => ({ searchFootNation: mock.search }));
import type { Profile } from "../src/lib/models";
import { saveProfileCover, uploadProfileCover } from "../src/lib/profileCover";
import {
  highestLevelPayload,
  updateAchievementList,
  saveHighestLevel,
  achievementDraft,
} from "../src/lib/profileCareerEdit";
import {
  recommendationPayload,
  moderateProfileRecommendation,
  loadProfileRecommendations,
  type ProfileRecommendation,
} from "../src/lib/profileRecommendations";
import { mergeClubMembers } from "../src/lib/clubExperienceMembers";
import {
  exploreAffinity,
  searchWithPriorities,
  type ExploreContext,
} from "../src/lib/exploreRanking";
const me = {
  id: "me",
  full_name: "Alex",
  city: "Voglans",
  department: "73 - Savoie",
  cover_image_url: "https://example.com/old.jpg",
} as Profile;
function request(data: unknown = me, error: unknown = null) {
  const q: any = {
    then: (resolve: any) => Promise.resolve({ data, error }).then(resolve),
  };
  for (const method of [
    "update",
    "delete",
    "select",
    "eq",
    "is",
    "or",
    "not",
    "order",
    "range",
    "maybeSingle",
  ])
    q[method] = vi.fn(() => q);
  return q;
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.getUser.mockResolvedValue({
    data: { user: { id: "me" } },
    error: null,
  });
});
it("updates only the cover and compares the old URL", async () => {
  const q = request(me);
  mock.from.mockReturnValue(q);
  await saveProfileCover(me, "https://example.com/new.jpg");
  expect(q.update).toHaveBeenCalledWith({
    cover_image_url: "https://example.com/new.jpg",
  });
  expect(q.eq).toHaveBeenCalledWith("cover_image_url", me.cover_image_url);
});
it("refuses a cover upload after an account switch", async () => {
  mock.auth.getUser.mockResolvedValue({ data: { user: { id: "someone" } } });
  await expect(uploadProfileCover(me, {} as any)).rejects.toThrow("session");
  expect(mock.upload).not.toHaveBeenCalled();
});
it("recovers a confirmed cover after a lost response without another update", async () => {
  const write = request(null, new Error("offline"));
  const read = request({
    ...me,
    cover_image_url: "https://example.com/new.jpg",
  });
  mock.from.mockReturnValueOnce(write).mockReturnValueOnce(read);
  expect(
    (await saveProfileCover(me, "https://example.com/new.jpg")).cover_image_url,
  ).toContain("new.jpg");
  expect(read.update).not.toHaveBeenCalled();
});
it("does not overwrite someone’s newer cover", async () => {
  mock.from
    .mockReturnValueOnce(request(null))
    .mockReturnValueOnce(
      request({ ...me, cover_image_url: "https://example.com/other.jpg" }),
    );
  await expect(
    saveProfileCover(me, "https://example.com/new.jpg"),
  ).rejects.toThrow("entre-temps");
});
const highest = {
  level: "Ligue 1",
  club: "Club exemple",
  category: "U18",
  year: "2024",
};
it("records highest-level context while preserving unrelated and opaque experience data", () => {
  const old = [
    { club: "Autre", is_highest_level: true, custom: "retain" },
    "old-format",
  ];
  const result = highestLevelPayload(
    { ...me, experience_history: old },
    highest,
  );
  expect(result.experience_history[0]).toEqual({
    ...(old[0] as object),
    is_highest_level: false,
  });
  expect(result.experience_history[1]).toBe("old-format");
  expect(result.experience_history[2]).toMatchObject({
    club: "Club exemple",
    ageCategory: "U18",
    highest_year: "2024",
    is_highest_level: true,
  });
  expect(result.experience_history[2]).not.toHaveProperty(
    "native_experience_id",
  );
});
it("requires club, category and a valid year for highest level", () => {
  for (const change of [
    { club: "" },
    { category: "" },
    { year: "9999" },
    { level: "invented" },
  ])
    expect(() => highestLevelPayload(me, { ...highest, ...change })).toThrow();
});
it("a concurrent career edit is not overwritten", async () => {
  const q = request(null);
  mock.from.mockReturnValue(q);
  await expect(
    saveHighestLevel({ ...me, experience_history: [] }, highest),
  ).rejects.toThrow("changé");
  expect(q.eq).toHaveBeenCalledWith("experience_history", "[]");
});
it("editing a distinction preserves other entries and reads the shared web format", () => {
  const result = updateAchievementList(
    ["Champion", { name: "Meilleur joueur", year: "2020", unknown: 1 }],
    0,
    {
      title: "Champion régional",
      year: "2024",
      club: "Club exemple",
      ageCategory: "Séniors",
    },
  );
  expect(result[1]).toEqual({
    name: "Meilleur joueur",
    year: "2020",
    unknown: 1,
  });
  expect(achievementDraft(result[0])).toMatchObject({
    title: "Champion régional",
    year: "2024",
  });
});
it("keeps recommendations pending and rejects self-recommendations", () => {
  expect(
    recommendationPayload("me", "other", "  Bon coéquipier  ", "Entraîneur"),
  ).toMatchObject({
    is_approved: false,
    author_id: "me",
    content: "Bon coéquipier",
  });
  expect(() => recommendationPayload("me", "me", "Texte", "")).toThrow();
  expect(() =>
    recommendationPayload("me", "other", "x".repeat(2001), ""),
  ).toThrow();
});
it("a visitor only requests approved recommendations or their own pending text", async () => {
  const blocks = request([]),
    rows = request([]);
  mock.from.mockReturnValueOnce(blocks).mockReturnValueOnce(rows);
  await loadProfileRecommendations("other", "me");
  expect(rows.or).toHaveBeenCalledWith("is_approved.eq.true,author_id.eq.me");
});
it("only the recipient can approve a recommendation", async () => {
  const row = {
    id: "rec",
    profile_id: "other",
    author_id: "me",
  } as ProfileRecommendation;
  await expect(
    moderateProfileRecommendation("me", row, "approve"),
  ).rejects.toThrow("autorisée");
  expect(mock.from).not.toHaveBeenCalled();
});
it("groups current and former club members once, preferring a current stint", () => {
  const result = mergeClubMembers(
    "club",
    "Club exemple",
    [
      {
        ...me,
        experience_history: [
          { club_id: "club", startYear: "2020", endYear: "2022" },
          { club_id: "club", startYear: "2025", endYear: "" },
        ],
      },
      {
        ...me,
        id: "former",
        experience_history: [
          { club: "Club exemple", startYear: "2021", endYear: "2024" },
        ],
      },
    ],
    [],
  );
  expect(result.map((row) => [row.profile.id, row.current])).toEqual([
    ["me", true],
    ["former", false],
  ]);
  expect(result[0].experiences).toHaveLength(2);
});
it("does not attribute a similarly named club with a different ID", () => {
  expect(
    mergeClubMembers(
      "club",
      "Club exemple",
      [
        {
          ...me,
          experience_history: [{ club_id: "other", club: "Club exemple" }],
        },
      ],
      [],
    ),
  ).toEqual([]);
});
it("does not resurrect a legacy projection when history now belongs elsewhere", () => {
  expect(
    mergeClubMembers(
      "club",
      "Club exemple",
      [],
      [
        {
          profile: {
            ...me,
            experience_history: [{ club_id: "other", club: "Autre" }],
          },
          start_year: 2020,
          end_year: null,
          age_category: null,
          position: null,
          is_current: true,
        },
      ],
    ),
  ).toEqual([]);
});
const context: ExploreContext = {
  profile: me,
  clubs: [{ id: "linked", name: "Mon club" }],
  following: [],
  blocked: [],
  location: { latitude: 45.63, longitude: 5.89 },
};
it("ranks linked clubs and proximity above an unrelated alphabetical entry", () => {
  const linked = exploreAffinity(
    { id: "linked", name: "Z club" },
    "clubs",
    context,
  );
  const near = exploreAffinity(
    { id: "near", latitude: 45.631, longitude: 5.89 },
    "clubs",
    context,
  );
  const far = exploreAffinity(
    { id: "far", name: "1 premier" },
    "clubs",
    context,
  );
  expect(linked.score).toBeGreaterThan(near.score);
  expect(near.score).toBeGreaterThan(far.score);
  expect(near.reason).toContain("km de vous");
});
it("uses profile location without GPS and shared interests for players", () => {
  expect(
    exploreAffinity({ id: "local", city: "VOGLANS" }, "clubs", {
      ...context,
      location: null,
    }).score,
  ).toBeGreaterThan(0);
  expect(
    exploreAffinity({ id: "player", club: "Mon club" }, "profiles", context)
      .reason,
  ).toBe("Un club en commun");
});
it("paginates priority results then the remaining directory without skipping entries", async () => {
  const priority = Array.from({ length: 5 }, (_, i) => ({
    id: `clubs:p${i}`,
    kind: "clubs" as const,
    title: "Club",
    subtitle: "",
    image: null,
    link: "/club/x",
  }));
  mock.search.mockImplementation((_uid, _term, _kind, offset) =>
    Promise.resolve({
      rows: Array.from({ length: 20 }, (_, i) => ({
        id: `clubs:r${offset + i}`,
      })),
      hasMore: true,
    }),
  );
  const first = await searchWithPriorities("me", "", "clubs", 0, priority);
  const second = await searchWithPriorities("me", "", "clubs", 20, priority);
  expect(first.rows.at(-1)?.id).toBe("clubs:r14");
  expect(second.rows[0].id).toBe("clubs:r15");
  expect(mock.search.mock.calls[0][6]).toEqual(["p0", "p1", "p2", "p3", "p4"]);
});
