const test = require("node:test");
const assert = require("node:assert/strict");
const { permitted } = require("./network-guard.cjs");

test("fixture media stays local without permitting remote hosts or active data documents", () => {
  for (const url of [
    "data:image/png;base64,aGVsbG8=", "data:video/mp4;base64,aGVsbG8=",
    "blob:http://localhost:8081/fixture-id", "blob:http://127.0.0.1:7082/fixture-id",
  ]) assert.equal(permitted(url), true, url);
  for (const url of [
    "data:text/html;base64,aGVsbG8=", "data:image/svg+xml;base64,aGVsbG8=",
    "blob:https://www.foot-nation.com/fixture-id", "blob:http://localhost:9999/fixture-id",
    "blob:http://user@localhost:8081/fixture-id", "file:///tmp/fixture.png",
    "https://www.foot-nation.com", "http://localhost.evil.test:8081",
  ]) assert.equal(permitted(url), false, url);
});
