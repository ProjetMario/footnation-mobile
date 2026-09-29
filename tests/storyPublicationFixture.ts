import { DEFAULT_STORY_FILTERS } from "../src/lib/storyFilters";
import {
  STORY_LIFETIME,
  type StoryPublicationDraft,
} from "../src/lib/storyPublication";
export const storyUserId = "11111111-1111-4111-8111-111111111111";
export const otherStoryUserId = "22222222-2222-4222-8222-222222222222";
export function storyDraft(): StoryPublicationDraft {
  const id = "33333333-3333-4333-8333-333333333333",
    createdAt = 1_800_000_000_000;
  const path = `stories/${storyUserId}-${id}.jpg`;
  return {
    version: 1,
    base64: "/9j/4AAA",
    mime: "image/jpeg",
    path,
    createdAt,
    record: {
      id,
      user_id: storyUserId,
      media_url: `https://example.invalid/${path}`,
      caption: "Un match",
      location: "Paris",
      hashtags: ["football"],
      filters: { ...DEFAULT_STORY_FILTERS },
      expires_at: new Date(createdAt + STORY_LIFETIME).toISOString(),
    },
  };
}
