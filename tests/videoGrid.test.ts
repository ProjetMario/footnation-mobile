import { describe, expect, it } from "vitest";
import { videoGridSource } from "../src/lib/videoGrid";

describe("profile Shorts grid sources", () => {
  it("uses the generated poster and optimized video only when they match the current upload", () => {
    const original = "https://media.example/short.mp4";
    expect(
      videoGridSource({
        video_url: original,
        thumbnail_url: null,
        optimized_video_source_url: original,
        optimized_video_url: "https://media.example/short-fast.mp4",
        optimized_thumbnail_url: "https://media.example/short.jpg",
      }),
    ).toEqual({
      uri: "https://media.example/short-fast.mp4",
      fallbackUri: original,
      posterUri: "https://media.example/short.jpg",
    });
  });

  it("keeps the original video and uploaded poster when derivatives belong to an older upload", () => {
    expect(
      videoGridSource({
        video_url: "https://media.example/current.mp4",
        thumbnail_url: "https://media.example/uploaded.jpg",
        optimized_video_source_url: "https://media.example/old.mp4",
        optimized_video_url: "https://media.example/old-fast.mp4",
        optimized_thumbnail_url: "https://media.example/old.jpg",
      }),
    ).toEqual({
      uri: "https://media.example/current.mp4",
      fallbackUri: undefined,
      posterUri: "https://media.example/uploaded.jpg",
    });
  });
});
