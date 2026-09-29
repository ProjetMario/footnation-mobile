import { expect, it } from "vitest";
import { incomingPath } from "../src/lib/incomingPath";
it("maps both installed schemes and legacy destinations", () => {
  expect(incomingPath("footnation://clubs/club-id?tab=news#item")).toBe(
    "/club/club-id?tab=news#item",
  );
  expect(incomingPath("com.footnation.app://matchs/match-id")).toBe(
    "/match/match-id",
  );
  expect(incomingPath("footnation:///posts/post-id")).toBe("/posts/post-id");
  expect(incomingPath("footnation://")).toBe("/");
});
it("preserves OAuth and recovery parameters without decoding their values", () => {
  expect(
    incomingPath(
      "com.footnation.app://auth/callback?code=test%2Bcode&recovery=1",
    ),
  ).toBe("/auth/callback?code=test%2Bcode&recovery=1");
  expect(incomingPath("/auth/callback?error_description=Access%20denied")).toBe(
    "/auth/callback?error_description=Access%20denied",
  );
});
it("normalizes trusted web links and relative paths", () => {
  expect(incomingPath("https://www.foot-nation.com/actus/id")).toBe("/actu/id");
  expect(incomingPath("/clubs/id")).toBe("/club/id");
});
it("opens the exact content from legacy web links delivered by the OS", () => {
  const id = "00000000-0000-0000-0000-000000000042";
  expect(incomingPath(`footnation://shorts?id=${id}`)).toBe(`/shorts/${id}`);
  expect(incomingPath(`com.footnation.app://messages?user=${id}`)).toBe(
    `/conversation/${id}`,
  );
});
it("rejects malformed, ambiguous and untrusted destinations", () => {
  for (const path of [
    "",
    "https://evil.example/posts/id",
    "//evil.example",
    "footnation://user@posts/id",
    "footnation://posts:99/id",
    "footnation:///%2fevil.example",
    "footnation://posts/%zz",
    "footnation://posts/\nid",
    "javascript:alert(1)",
  ])
    expect(incomingPath(path), path).toBe("/link-unavailable");
});
it("preserves Expo transports only in a development build", () => {
  for (const path of [
    "exp://192.168.1.2:8081/--/posts/id",
    "exps://example.test/--/",
    "exp+footnation-native://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081",
  ]) {
    expect(incomingPath(path, true)).toBe(path);
    expect(incomingPath(path, false)).toBe("/link-unavailable");
  }
});
