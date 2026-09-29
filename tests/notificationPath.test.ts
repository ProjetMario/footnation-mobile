import { expect, it } from "vitest";
import { notificationPath } from "../src/lib/notificationPath";

it("maps legacy club, match and news paths while preserving context", () => {
  expect(notificationPath("/clubs/club-id?tab=news#item")).toBe(
    "/club/club-id?tab=news#item",
  );
  expect(notificationPath("/matchs/match-id")).toBe("/match/match-id");
  expect(notificationPath("/actus/news-id")).toBe("/actu/news-id");
});
it("accepts HTTPS FootNation links with and without www", () => {
  expect(
    notificationPath("https://www.foot-nation.com/clubs/id?from=notification"),
  ).toBe("/club/id?from=notification");
  expect(notificationPath("https://foot-nation.com/posts/id")).toBe(
    "/posts/id",
  );
});
it("preserves current native paths and does not replace query contents", () => {
  expect(notificationPath("/messages?next=/clubs/id")).toBe(
    "/messages?next=/clubs/id",
  );
  expect(notificationPath("/clubs")).toBe("/clubs");
  expect(notificationPath("/posts/id")).toBe("/posts/id");
});
it("rejects external origins, credentials and ambiguous URLs", () => {
  for (const value of [
    "https://evil.example/posts/id",
    "https://foot-nation.com.evil.example/",
    "//evil.example/",
    "/a/..//evil.example/",
    "/%2fevil.example/",
    "/%5cevil.example/",
    "/posts/%0aid",
    "/posts/%zz",
    "https://user@foot-nation.com/",
    "javascript:alert(1)",
    "footnation://posts/id",
    "/\\evil.example",
    "/posts/\nid",
    " https://foot-nation.com/",
    "https://foot-nation.com:444/",
  ]) {
    expect(notificationPath(value), value).toBeNull();
  }
});
it("keeps notifications without a destination on the current screen", () => {
  expect(notificationPath(null)).toBeNull();
  expect(notificationPath(undefined)).toBeNull();
  expect(notificationPath("")).toBeNull();
});

it("opens the exact shared Short rather than the discovery feed", () => {
  const id = "00000000-0000-0000-0000-000000000042";
  expect(notificationPath(`/shorts?shortId=${id}`)).toBe(`/shorts/${id}`);
  expect(
    notificationPath(`https://www.foot-nation.com/shorts?shortId=${id}`),
  ).toBe(`/shorts/${id}`);
  expect(notificationPath("/shorts?shortId=https://evil.test")).toBe(
    "/shorts?shortId=https://evil.test",
  );
});

it("opens the Short referenced by a notification created on the web", () => {
  const id = "00000000-0000-0000-0000-000000000042";
  expect(notificationPath(`/shorts?id=${id}`)).toBe(`/shorts/${id}`);
  expect(notificationPath(`https://www.foot-nation.com/shorts?id=${id}`)).toBe(
    `/shorts/${id}`,
  );
});

it("opens the recipient from web message notifications and matching links", () => {
  const id = "00000000-0000-0000-0000-000000000042";
  for (const parameter of ["user", "to"]) {
    expect(notificationPath(`/messages?${parameter}=${id}`)).toBe(
      `/conversation/${id}`,
    );
    expect(
      notificationPath(`https://foot-nation.com/messages?${parameter}=${id}`),
    ).toBe(`/conversation/${id}`);
  }
  expect(notificationPath("/messages?user=%2Fadmin")).toBe(
    "/messages?user=%2Fadmin",
  );
  expect(notificationPath("/messages?to=https://evil.test")).toBe(
    "/messages?to=https://evil.test",
  );
});
