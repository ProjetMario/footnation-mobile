import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@babel/core";
import { describe, expect, it } from "vitest";
import { feedMediaViewability, visibleMediaId } from "../src/lib/mediaFeed";
import { homeHeaderPostVisible } from "../src/lib/homeFeedLayout";

// Exercise the installed native list algorithm, not a duplicate of its maths.
const require = createRequire(import.meta.url);
const helperFile =
  require.resolve("@react-native/virtualized-lists/Lists/ViewabilityHelper");
const module = { exports: {} as any };
runInNewContext(
  transformSync(readFileSync(helperFile, "utf8"), {
    filename: helperFile,
    babelrc: false,
    configFile: false,
    plugins: [
      require.resolve("@babel/plugin-transform-flow-strip-types"),
      require.resolve("@babel/plugin-transform-modules-commonjs"),
    ],
  })!.code!,
  {
    module,
    exports: module.exports,
    setTimeout,
    clearTimeout,
    // Flow uses this imported class only as the type of the metrics port below.
    require: (name: string) =>
      name === "./ListMetricsAggregator" ? class {} : require(name),
  },
);
const ViewabilityHelper = module.exports.default ?? module.exports;
const items = ["first", "second", "third"].map((id) => ({
  id,
  video_url: `${id}.mp4`,
}));
const props = { data: items, getItemCount: (data: unknown[]) => data.length };
const metrics = {
  getCellMetrics: (index: number) => ({
    offset: index * 800,
    length: 800,
    index,
  }),
};

describe("scroll playback using native FlatList viewability", () => {
  it("reproduces the old dead zone at the midpoint", () => {
    const old = new ViewabilityHelper({ itemVisiblePercentThreshold: 70 });
    expect(old.computeViewableItems(props, 400, 800, metrics)).toEqual([]);
  });

  it("keeps one selected video through slow swipes in both directions without delayed callbacks", () => {
    const helper = new ViewabilityHelper(feedMediaViewability);
    let selected: string | null = null;
    const visit = (offset: number) => {
      helper.onUpdate(
        props,
        offset,
        800,
        metrics,
        (index: number, isViewable: boolean) => ({
          item: items[index],
          index,
          key: items[index].id,
          isViewable,
        }),
        ({ viewableItems }: any) => {
          selected = visibleMediaId(viewableItems, selected);
        },
      );
      return selected;
    };
    for (let offset = 0; offset <= 1600; offset += 8)
      expect(visit(offset)).not.toBeNull();
    expect(selected).toBe("third");
    for (let offset = 1600; offset >= 0; offset -= 8)
      expect(visit(offset)).not.toBeNull();
    expect(selected).toBe("first");
    expect(visit(400)).toBe("first");
    expect(visit(800)).toBe("second");
    expect(visit(400)).toBe("second");
    expect(visit(2400)).toBeNull();
    helper.dispose();
  });

  it("does not leave a gap between the header publication and the first normal row", () => {
    const helper = new ViewabilityHelper(feedMediaViewability);
    const rows = {
      getCellMetrics: (index: number) => ({
        offset: 1000 + index * 800,
        length: 800,
        index,
      }),
    };
    for (let offset = 200; offset <= 1000; offset += 4) {
      const header = homeHeaderPostVisible({
        offset,
        viewportHeight: 800,
        contentStart: 200,
        contentEnd: 1000,
      });
      const normal = helper.computeViewableItems(props, offset, 800, rows);
      expect(header || normal.length > 0).toBe(true);
    }
    helper.dispose();
  });
});
