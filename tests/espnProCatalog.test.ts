import { describe, expect, it } from "vitest";
import {
  createEspnProfessionalScoreboardRequests,
  ESPN_PROFESSIONAL_COMPETITIONS,
  espnProfessionalCompetition,
} from "../src/lib/espnProCatalog";

describe("ESPN professional coverage registry", () => {
  it("keeps the currently verified competition set explicit", () => {
    expect(ESPN_PROFESSIONAL_COMPETITIONS.map((item) => item.slug)).toEqual([
      "fra.1", "eng.1", "esp.1", "ita.1", "ger.1", "uefa.champions",
    ]);
    expect(espnProfessionalCompetition("fra.1")?.country).toBe("FR");
    expect(espnProfessionalCompetition("unknown")).toBeUndefined();
  });

  it("enumerates one request per competition and day", () => {
    const requests = createEspnProfessionalScoreboardRequests({
      from: "2026-10-01",
      to: "2026-10-02",
      competitions: [{ slug: "fra.1" }, { slug: "eng.1" }],
    });
    expect(requests).toHaveLength(4);
    expect(requests[0].url).toContain("soccer/fra.1/scoreboard?dates=20261001");
    expect(requests.at(-1)?.slug).toBe("eng.1");
  });

  it("rejects unbounded or unknown coverage requests", () => {
    expect(() => createEspnProfessionalScoreboardRequests({ from: "bad", to: "2026-10-02" })).toThrow();
    expect(() => createEspnProfessionalScoreboardRequests({ from: "2026-10-02", to: "2026-10-01" })).toThrow();
    expect(() => createEspnProfessionalScoreboardRequests({ from: "2026-10-01", to: "2026-10-01", competitions: [{ slug: "world.pro" }] })).toThrow();
  });
});
