import { describe, expect, it } from "vitest";
import {
  autoCutProject,
  creationDuration,
  needsCreationRender,
  newCreationProject,
  sourceClip,
  validateCreationProject,
  type CreationSource,
} from "../src/lib/creationProject";

const image = (id: string): CreationSource => ({
  id,
  type: "image",
  name: `${id}.jpg`,
  mime: "image/jpeg",
  size: 1000,
  width: 1200,
  height: 1600,
  duration: 0,
});
const video = (id: string, duration: number): CreationSource => ({
  ...image(id),
  type: "video",
  name: `${id}.mp4`,
  mime: "video/mp4",
  duration,
});
function project(sources: CreationSource[]) {
  return {
    ...newCreationProject("owner", "project", "short"),
    sources,
    clips: sources.map((source) => sourceClip(source, source.id)),
  };
}
describe("creation edit decisions", () => {
  it("includes every selected media in a short rhythmic montage", () => {
    const input = project(
      Array.from({ length: 10 }, (_, i) => image(String(i))),
    );
    const output = autoCutProject(input, "energy", 15);
    expect(new Set(output.clips.map((clip) => clip.sourceId)).size).toBe(10);
    expect(creationDuration(output)).toBeCloseTo(15);
    expect(validateCreationProject(output)).toBeNull();
    expect(output.revision).toBe(input.revision + 1);
  });
  it("aligns cuts with real supplied music beats", () => {
    const output = autoCutProject(
      project([video("a", 40)]),
      "energy",
      15,
      [2.25, 4.5, 6.5],
    );
    expect(output.clips[0].duration).toBeCloseTo(2.25);
    expect(output.clips[1].duration).toBeCloseTo(2.25);
    expect(creationDuration(output)).toBeCloseTo(15);
  });
  it("finishes when short source videos run out, without reading past an endpoint", () => {
    const input = project([video("a", 1), video("b", 1)]);
    const output = autoCutProject(input, "memories", 60);
    expect(creationDuration(output)).toBeLessThanOrEqual(2);
    expect(output.clips.every((clip) => clip.start + clip.duration <= 1)).toBe(
      true,
    );
    expect(validateCreationProject(output)).toBeNull();
  });
  it("accounts for transition overlaps and invalidates old subtitles", () => {
    const input = {
      ...project([image("a"), image("b")]),
      captionsEnabled: true,
      captions: [{ id: "caption", text: "Avant", start: 0, end: 1 }],
    };
    const output = autoCutProject(input, "memories", 30);
    expect(creationDuration(output)).toBeCloseTo(30);
    expect(output.captionsEnabled).toBe(false);
    expect(output.captions).toEqual([]);
    expect(output.transition).toBe(0.3);
  });
  it("does not require the montage server for unchanged posts or stories", () => {
    const input = { ...project([image("a")]), mode: "story" as const };
    expect(needsCreationRender(input)).toBe(false);
    expect(needsCreationRender({ ...input, mode: "short" })).toBe(true);
    expect(
      needsCreationRender({
        ...input,
        texts: [
          {
            id: "t",
            text: "But !",
            start: 0,
            end: 2,
            x: 0.5,
            y: 0.5,
            size: 32,
            color: "#ffffff",
          },
        ],
      }),
    ).toBe(true);
  });
  it("rejects an invalid manual cut or subtitle outside the montage", () => {
    const input = project([video("a", 10)]);
    expect(
      validateCreationProject({
        ...input,
        clips: [{ ...input.clips[0], start: 9, duration: 5 }],
      }),
    ).toMatch(/extrait/);
    expect(
      validateCreationProject({
        ...input,
        captionsEnabled: true,
        captions: [{ id: "t", text: "Fin", start: 11, end: 12 }],
      }),
    ).toMatch(/timings/);
  });
  it("keeps every Auto Cut template valid with short clips and transition tails", () => {
    for (const length of [0.1, 0.3, 0.5, 1, 3, 14.2, 60]) {
      for (const template of ["energy", "memories", "clean"] as const) {
        for (const seconds of [15, 30, 60] as const) {
          const output = autoCutProject(
            project([video("a", length), image("b")]),
            template,
            seconds,
          );
          expect(
            validateCreationProject(output),
            `${template}/${length}/${seconds}`,
          ).toBeNull();
          expect(creationDuration(output)).toBeLessThanOrEqual(seconds + 0.05);
        }
      }
    }
  });
  it("validates render settings before starting a server job", () => {
    const input = project([video("a", 10)]);
    expect(validateCreationProject({ ...input, coverTime: 11 })).toMatch(
      /couverture/,
    );
    expect(
      validateCreationProject({ ...input, originalVolume: Number.NaN }),
    ).toMatch(/audio/);
    expect(
      validateCreationProject({
        ...input,
        clips: [{ ...input.clips[0], duration: 0.01 }],
      }),
    ).toMatch(/durée|durer/);
  });
});
