import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { isActiveAdminProfile } from "../../supabase/functions/_shared/admin-profile";

// Exercise the deployed entrypoint with synthetic Auth/database services. The
// separately pending age gate is outside this approved deployment package.
function fixture(
  options: {
    suspended?: boolean;
    counts?: (number | null)[];
    error?: boolean;
  } = {},
) {
  let handler!: (request: Request) => Promise<Response>;
  let countIndex = 0;
  const counts = options.counts || [12, 2, 5];
  const from = vi.fn((table: string) => {
    const query: any = {};
    for (const method of ["select", "eq", "gte"])
      query[method] = vi.fn(() => query);
    query.single = async () => ({
      data: {
        is_admin: true,
        is_suspended: !!options.suspended,
        suspended_until: null,
      },
      error: null,
    });
    query.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({
        count: counts[countIndex++],
        error: options.error ? { message: "Private database detail" } : null,
      }).then(resolve);
    return query;
  });
  const client = {
    from,
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "synthetic-admin" } },
        error: null,
      })),
    },
  };
  const source = readFileSync(
    new URL(
      "../../supabase/functions/get-mobile-stats/index.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const code = ts.transpileModule(source.replace(/^import .*;\r?\n/gm, ""), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
    },
  }).outputText;
  runInNewContext(code, {
    Request,
    Response,
    Date,
    isActiveAdminProfile,
    memberAgeGate: async () => null,
    createClient: () => client,
    Deno: {
      env: { get: () => "fixture-only" },
      serve: (fn: typeof handler) => {
        handler = fn;
      },
    },
  });
  const post = (body = { platform: "ios" }) =>
    handler(
      new Request("https://fixture.test/get-mobile-stats", {
        method: "POST",
        headers: {
          Authorization: "Bearer fixture-only",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }),
    );
  return { handler, post, from };
}

describe("admin mobile statistics endpoint", () => {
  it("accepts browser preflight headers used by Supabase without reading data", async () => {
    const f = fixture();
    const response = await f.handler(
      new Request("https://fixture.test/get-mobile-stats", {
        method: "OPTIONS",
      }),
    );
    expect(response.status).toBe(204);
    for (const name of [
      "authorization",
      "apikey",
      "x-client-info",
      "content-type",
    ])
      expect(response.headers.get("access-control-allow-headers")).toContain(
        name,
      );
    expect(f.from).not.toHaveBeenCalled();
  });
  it("rejects missing authentication and suspended administrators", async () => {
    const f = fixture();
    expect(
      (
        await f.handler(
          new Request("https://fixture.test/get-mobile-stats", {
            method: "POST",
          }),
        )
      ).status,
    ).toBe(401);
    const suspended = fixture({ suspended: true });
    expect((await suspended.post()).status).toBe(403);
    expect(suspended.from).not.toHaveBeenCalledWith("app_usage");
  });
  it("returns measured counts and disables caching", async () => {
    const response = await fixture().post();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      platform: "ios",
      totalInstalls: 12,
      activeToday: 2,
      activeWeek: 5,
    });
  });
  it("preserves a measured zero", async () => {
    const response = await fixture({ counts: [0, 0, 0] }).post();
    expect(response.status).toBe(200);
    expect((await response.json()).totalInstalls).toBe(0);
  });
  it.each([{ counts: [null, 0, 0] }, { error: true }])(
    "does not report missing measurements as zero: %o",
    async (options) => {
      const response = await fixture(options).post();
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        error: "Mobile statistics unavailable",
      });
    },
  );
  it("rejects unsupported platforms before querying measurements", async () => {
    const f = fixture();
    expect((await f.post({ platform: "unsupported" })).status).toBe(400);
    expect(f.from).not.toHaveBeenCalledWith("app_usage");
  });
});
