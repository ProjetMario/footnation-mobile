import { describe, expect, it } from "vitest";
import { resolveVideoSource } from "../src/lib/videoSource";

const original = "https://media.example.test/original.mov";
const optimized = "https://media.example.test/mobile.mp4";
const generatedPoster = "https://media.example.test/poster.jpg";
const poster = "https://media.example.test/uploaded.jpg";
const ready = {
  video_url: original,
  optimized_video_url: optimized,
  optimized_video_source_url: original,
  optimized_thumbnail_url: generatedPoster,
};

describe("optimized video selection", () => {
  it("prefers a ready current derivative and retains the original for playback recovery", () => {
    expect(resolveVideoSource(ready, poster)).toEqual({
      uri: optimized,
      fallbackUri: original,
      posterUri: generatedPoster,
    });
  });

  it("keeps unconverted publications and local drafts playable", () => {
    for (const video_url of [original, "file:///draft.mp4", "blob:https://example.test/upload"]) {
      expect(resolveVideoSource({ video_url }, poster)).toEqual({
        uri: video_url,
        fallbackUri: undefined,
        posterUri: poster,
      });
    }
  });

  it("discards stale derivatives and posters after source replacement, including a changed query string", () => {
    for (const video_url of [`${original}?v=2`, "https://media.example.test/replacement.mp4", "", null]) {
      expect(resolveVideoSource({ ...ready, video_url }, poster)).toEqual({
        uri: video_url || "",
        fallbackUri: undefined,
        posterUri: poster,
      });
    }
  });

  it("uses the original when optimized metadata is missing or invalid", () => {
    for (const optimized_video_url of [undefined, null, "", " ", "javascript:alert(1)", "/relative.mp4", "https://user:secret@media.example.test/video.mp4"]) {
      expect(resolveVideoSource({ ...ready, optimized_video_url })).toMatchObject({
        uri: original,
        fallbackUri: undefined,
      });
    }
    expect(resolveVideoSource({ ...ready, optimized_thumbnail_url: "/broken.jpg" }, poster).posterUri).toBe(poster);
    expect(resolveVideoSource({ ...ready, optimized_video_source_url: undefined }, poster).uri).toBe(original);
  });

  it("does not retry the same URL when the derivative equals the original", () => {
    expect(resolveVideoSource({ ...ready, optimized_video_url: original }).fallbackUri).toBeUndefined();
  });
});
