import { describe, expect, it } from "vitest";
import { linkedConvocationEvent } from "../src/lib/convocationEvent";

describe("linked convocation event", () => {
  it("locks only existing convocations attached to a match or session", () => {
    expect(linkedConvocationEvent("convocations", { id: "c", match_id: "m" })).toBe("match");
    expect(linkedConvocationEvent("convocations", { id: "c", session_id: "s" })).toBe("session");
    expect(linkedConvocationEvent("convocations", { id: "c", match_id: null, session_id: null })).toBeNull();
    expect(linkedConvocationEvent("convocations", {})).toBeNull();
    expect(linkedConvocationEvent("matches", { id: "m", match_id: "other" })).toBeNull();
  });
});
