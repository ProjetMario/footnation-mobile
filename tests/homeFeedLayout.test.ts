import { describe, expect, it } from "vitest";
import {
  captureHomeFeedAnchor,
  restoredHomeFeedOffset,
  homeHeaderPostVisible,
  type HomeFeedLayout,
} from "../src/lib/homeFeedLayout";

function layout(
  ids = ["A", "B", "C"],
  updates: Partial<HomeFeedLayout> = {},
): HomeFeedLayout {
  return {
    scope: "user:all",
    firstPost: ids[0] ? { id: ids[0] } : undefined,
    posts: ids.slice(1).map((id) => ({ id })),
    hasFooter: false,
    introHeight: 640,
    pageHeight: 640,
    paged: true,
    ...updates,
  };
}

function restore(
  previous: HomeFeedLayout,
  next: HomeFeedLayout,
  offset: number,
) {
  return restoredHomeFeedOffset(
    captureHomeFeedAnchor(previous, offset),
    previous,
    next,
  );
}

describe("home feed anchors with a publication in the header", () => {
  it("captures the first publication identity at the top", () => {
    expect(captureHomeFeedAnchor(layout(), 0)).toEqual({
      kind: "post",
      index: -1,
      id: "A",
      offset: 0,
    });
    expect(captureHomeFeedAnchor(layout([]), 0).kind).toBe("intro");
  });

  it("follows a visible publication promoted from a row into the header", () => {
    expect(restore(layout(), layout(["B", "C"]), 640)).toBe(0);
    expect(restore(layout(), layout(["B", "A", "C"]), 640)).toBe(0);
  });

  it("follows the old first publication when a refetch inserts another ahead", () => {
    expect(restore(layout(), layout(["new", "A", "B", "C"]), 0)).toBe(640);
  });

  it("does not cancel scroll momentum when ids keep their positions", () => {
    for (const offset of [0, 190, 644, 920, 1280]) {
      expect(restore(layout(), layout(), offset)).toBeNull();
    }
  });

  it("retains the drag position when a row shifts after an insertion", () => {
    expect(restore(layout(), layout(["new", "A", "B", "C"]), 690)).toBe(1330);
  });

  it("uses a neighbouring page after deletion, including an empty feed", () => {
    expect(restore(layout(), layout(["A", "C"]), 640)).toBeNull();
    expect(restore(layout(), layout([]), 1280)).toBe(0);
  });

  it("moves from the previous footer to the first newly loaded publication", () => {
    expect(
      restore(
        layout(["A", "B"], { hasFooter: true }),
        layout(["A", "B", "C", "D"], { hasFooter: true }),
        1280,
      ),
    ).toBe(1280);
    expect(
      restore(
        layout(["A"], { hasFooter: true }),
        layout(["A", "B", "C"], { hasFooter: true }),
        640,
      ),
    ).toBe(640);
  });

  it("keeps post and footer anchors when a paginated viewport resizes", () => {
    expect(
      restore(
        layout(),
        layout(undefined, { introHeight: 720, pageHeight: 720 }),
        1280,
      ),
    ).toBe(1440);
    expect(
      restore(
        layout(undefined, { hasFooter: true }),
        layout(undefined, {
          hasFooter: true,
          introHeight: 720,
          pageHeight: 720,
        }),
        1920,
      ),
    ).toBe(2160);
  });

  it("returns to the start across presentation modes instead of guessing natural row heights", () => {
    const natural = layout(undefined, {
      paged: false,
      introHeight: 1200,
      pageHeight: 320,
    });
    expect(restore(natural, layout(), 2500)).toBe(0);
    expect(restore(layout(), natural, 1280)).toBe(0);
    expect(restore(natural, natural, 2500)).toBeNull();
  });

  it("resets a different account or feed scope", () => {
    expect(
      restore(layout(), layout(undefined, { scope: "user:network" }), 1280),
    ).toBe(0);
  });
});

describe("first publication visibility outside FlatList rows", () => {
  it("keeps a tall natural publication playable when its middle fills the viewport", () => {
    expect(
      homeHeaderPostVisible({
        offset: 800,
        viewportHeight: 320,
        contentStart: 194,
        contentEnd: 1500,
      }),
    ).toBe(true);
  });

  it("accepts fully visible short cards and excludes offscreen cards", () => {
    expect(
      homeHeaderPostVisible({
        offset: 0,
        viewportHeight: 640,
        contentStart: 210,
        contentEnd: 570,
      }),
    ).toBe(true);
    expect(
      homeHeaderPostVisible({
        offset: 640,
        viewportHeight: 640,
        contentStart: 210,
        contentEnd: 640,
      }),
    ).toBe(false);
    expect(
      homeHeaderPostVisible({
        offset: 0,
        viewportHeight: 640,
        contentStart: 210,
        contentEnd: 0,
      }),
    ).toBe(false);
  });
});
