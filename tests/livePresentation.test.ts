import { expect, it } from "vitest";
import {
  liveFailureMessage,
  liveNeedsProfile,
} from "../src/lib/livePresentation";
import { authGateReturnPath, authReturnPath } from "../src/lib/authReturn";
it("recovers only a missing broadcaster profile, not a missing club or a forbidden account", () => {
  const missing = {
    code: "23503",
    message: 'violates constraint "live_streams_broadcaster_id_fkey"',
  };
  expect(liveNeedsProfile(missing)).toBe(true);
  expect(liveNeedsProfile({ code: "PROFILE_REQUIRED" })).toBe(true);
  expect(
    liveNeedsProfile({
      code: "42501",
      message: "Complétez votre profil pour lancer un live.",
    }),
  ).toBe(true);
  expect(
    liveNeedsProfile({ code: "23503", message: "live_streams_club_id_fkey" }),
  ).toBe(false);
  expect(liveNeedsProfile({ code: "42501", message: "forbidden" })).toBe(false);
  expect(liveFailureMessage(missing)).toContain("Complétez votre profil");
  expect(liveFailureMessage(missing)).not.toContain("fkey");
});
it("does not expose unexpected SQL, identifiers, URLs or credentials in a live error", () => {
  for (const error of [
    new Error("select secret from private"),
    { message: "https://private.test?token=secret" },
    undefined,
  ])
    expect(liveFailureMessage(error)).toBe(
      "Le live n’a pas pu démarrer. Vérifiez votre connexion puis réessayez.",
    );
  expect(
    liveFailureMessage(
      new Error(
        "Le relais vidéo du live est indisponible. Réessayez dans un instant.",
      ),
    ),
  ).toContain("relais vidéo");
});
it("returns to live preparation after signup without automatically opening the camera or publishing", () => {
  for (const mode of ["simple", "match"]) {
    const path = `/live/create?mode=${mode}`;
    expect(authReturnPath(path)).toBe(path);
    expect(
      authGateReturnPath("/live/create", { mode, publish: "1", camera: "1" }),
    ).toBe(path);
    expect(authReturnPath(`${path}&publish=1`)).toBeNull();
    expect(authReturnPath(`${path}&camera=1`)).toBeNull();
  }
  expect(authGateReturnPath("/live/create", { mode: ["simple"] })).toBe(
    "/live",
  );
  expect(authReturnPath("/live/create?mode=bad")).toBeNull();
  const path = "/live/watch/10000000-0000-4000-8000-000000000001";
  expect(authReturnPath(path)).toBe(path);
  expect(authReturnPath(`${path}?send=1`)).toBeNull();
});
