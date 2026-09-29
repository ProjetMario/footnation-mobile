import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  slots: [] as any[],
  cursor: 0,
  effects: [] as (() => void)[],
  dirty: false,
  value: "2000-05-21",
  minAge: 13,
  onChange: vi.fn(),
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useRef: (initial: unknown) => {
    const slot = state.cursor++;
    return (state.slots[slot] ||= { current: initial });
  },
  useState: (initial: unknown) => {
    const slot = state.cursor++;
    state.slots[slot] ||= { value: initial };
    return [
      state.slots[slot].value,
      (next: unknown) => {
        if (!Object.is(state.slots[slot].value, next)) state.dirty = true;
        state.slots[slot].value = next;
      },
    ];
  },
  useEffect: (effect: () => void, dependencies: unknown[]) => {
    const slot = state.cursor++;
    if (
      !state.slots[slot] ||
      dependencies.some(
        (value, index) =>
          !Object.is(value, state.slots[slot].dependencies[index]),
      )
    ) {
      state.slots[slot] = { dependencies };
      state.effects.push(effect);
    }
  },
}));
vi.mock("react-native", () => ({
  Text: "text",
  TextInput: "input",
  View: "view",
}));
vi.mock("../src/theme", () => ({
  useTheme: () => ({ colors: {}, mode: "light" }),
}));
vi.mock("../src/components/ui", () => ({ useUIStyles: () => ({}) }));
import { BirthdateField } from "../src/components/BirthdateField";

function render(): any {
  let element: any;
  for (let attempt = 0; attempt < 10; attempt++) {
    state.cursor = 0;
    state.dirty = false;
    element = BirthdateField({
      value: state.value,
      onChange: state.onChange,
      minAge: state.minAge,
    });
    const effects = state.effects.splice(0);
    effects.forEach((effect) => effect());
    if (!state.dirty) return element;
  }
  throw new Error("Date field did not stabilize");
}
const inputs = (element: any): any[] => {
  if (Array.isArray(element)) return element.flatMap(inputs);
  if (!element?.props) return [];
  return element.type === "input" ? [element] : inputs(element.props.children);
};
const values = () => inputs(render()).map((input) => input.props.value);
const type = (index: number, value: string) =>
  inputs(render())[index].props.onChangeText(value);

beforeEach(() => {
  state.slots = [];
  state.effects = [];
  state.value = "2000-05-21";
  state.minAge = 13;
  state.onChange.mockReset().mockImplementation((value) => {
    state.value = value;
  });
});

it("keeps day and month while editing the year character by character", () => {
  type(2, "200");
  expect(state.value).toBe("");
  expect(values()).toEqual(["21", "05", "200"]);
  type(2, "2001");
  expect(state.value).toBe("2001-05-21");
  expect(values()).toEqual(["21", "05", "2001"]);
});

it("keeps an invalid intermediate date available to correct without accepting it", () => {
  type(0, "31");
  type(1, "02");
  expect(state.value).toBe("");
  expect(values()).toEqual(["31", "02", "2000"]);
  type(0, "29");
  expect(state.value).toBe("2000-02-29");
});

it("still follows an externally loaded birthdate and an explicit form reset", () => {
  render();
  state.value = "1997-12-01";
  expect(values()).toEqual(["01", "12", "1997"]);
  state.value = "";
  expect(values()).toEqual(["", "", ""]);
});

it("lets the restricted social account declare its real underage date without coercing it", () => {
  const youngYear = String(new Date().getFullYear() - 10);
  type(2, youngYear);
  expect(state.value).toBe("");
  state.minAge = 0;
  type(2, youngYear);
  expect(state.value).toBe(`${youngYear}-05-21`);
});
