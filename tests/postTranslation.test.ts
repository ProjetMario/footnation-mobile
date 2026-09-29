import { afterEach, describe, expect, it, vi } from "vitest";
import {
  translatedPostText,
  translatePostText,
  translationRequestError,
  TranslationQuotaError,
} from "../src/lib/postTranslation";

describe("post translation responses", () => {
  it("accepts real translated text without losing its paragraphs", () => {
    expect(
      translatedPostText(
        { translations: [{ text: "Je suis joueur.\nJe cherche un club." }] },
        "Sou jogador.",
      ),
    ).toBe("Je suis joueur.\nJe cherche un club.");
  });
  it.each([
    null,
    {},
    { translations: [] },
    { translations: [{ text: 123 }] },
    { translations: [{ text: " " }] },
    { translations: [{ text: " Sou jogador. " }] },
  ])(
    "does not display missing or unchanged output as a successful translation",
    (response) => {
      expect(() => translatedPostText(response, "Sou jogador.")).toThrow(
        "Traduction indisponible",
      );
    },
  );
  it.each([
    "QUERY LENGTH LIMIT EXCEEDED. MAX ALLOWED QUERY : 500 CHARS",
    "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS",
    "INVALID LANGUAGE PAIR SPECIFIED",
  ])(
    "rejects provider diagnostic text returned in a success envelope",
    (text) => {
      expect(() =>
        translatedPostText({ translations: [{ text }] }, "Sou jogador."),
      ).toThrow();
    },
  );
});

const envelope = (texts: string[]) => ({
  translations: texts.map((text) => ({ text })),
});
const lengthFailure = envelope([
  "QUERY LENGTH LIMIT EXCEEDED. MAX ALLOWED QUERY : 500 BYTES",
]);
afterEach(() => vi.useRealTimers());

describe("bounded post translation requests", () => {
  it("keeps a capable provider/cache to one request even for a long post", async () => {
    const original = "Sou jogador de futebol. ".repeat(100);
    const invoke = vi
      .fn()
      .mockResolvedValue(
        envelope(["Je suis joueur de football. ".repeat(100)]),
      );
    expect(await translatePostText(original, invoke)).toContain(
      "Je suis joueur",
    );
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0][0]).toEqual([original]);
  });
  it("splits only an explicit byte-limit rejection and preserves paragraph separators", async () => {
    const original =
      "sou jogador ".repeat(70) + "\r\n\r\n" + "sou jogador ".repeat(70);
    const invoke = vi
      .fn()
      .mockResolvedValueOnce(lengthFailure)
      .mockImplementation(async (texts: string[]) =>
        envelope(texts.map((text) => text.replaceAll("jogador", "joueur"))),
      );
    const result = await translatePostText(original, invoke);
    expect(result).toBe(original.replaceAll("jogador", "joueur"));
    for (const [texts] of invoke.mock.calls.slice(1)) {
      expect(texts.length).toBeLessThanOrEqual(4);
      for (const text of texts)
        expect(Buffer.byteLength(text, "utf8")).toBeLessThanOrEqual(500);
    }
  });
  it("uses UTF-8 bytes and never splits an emoji surrogate pair", async () => {
    const original = "😀".repeat(300) + "équipe".repeat(130);
    const invoke = vi
      .fn()
      .mockResolvedValueOnce(lengthFailure)
      .mockImplementation(async (texts: string[]) =>
        envelope(texts.map((text) => `Traduit : ${text}`)),
      );
    await translatePostText(original, invoke);
    for (const [texts] of invoke.mock.calls.slice(1)) {
      for (const text of texts) {
        expect(Buffer.byteLength(text, "utf8")).toBeLessThanOrEqual(500);
        expect(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/.test(text)).toBe(false);
      }
    }
  });
  it("preserves a non-linguistic paragraph without asking the fallback to translate it", async () => {
    const original = "sou jogador ".repeat(70) + "\r\n\r\n⚽️⚽️ 2026 !!!";
    const invoke = vi
      .fn()
      .mockResolvedValueOnce(lengthFailure)
      .mockImplementation(async (texts: string[]) =>
        envelope(texts.map((text) => text.replaceAll("jogador", "joueur"))),
      );
    expect(await translatePostText(original, invoke)).toBe(
      original.replaceAll("jogador", "joueur"),
    );
    for (const [texts] of invoke.mock.calls.slice(1)) {
      expect(texts.every((text: string) => /\p{L}/u.test(text))).toBe(true);
      expect(texts.join("")).not.toContain("⚽");
      expect(texts.join("")).not.toContain("2026");
    }
  });
  it("translates a single linguistic segment when emoji made the original exceed the byte limit", async () => {
    const emoji = "⚽️".repeat(150);
    const invoke = vi
      .fn()
      .mockResolvedValueOnce(lengthFailure)
      .mockResolvedValue(envelope(["Je suis joueur."]));
    expect(await translatePostText(`Sou jogador.\n\n${emoji}`, invoke)).toBe(
      `Je suis joueur.\n\n${emoji}`,
    );
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke.mock.calls[1][0]).toEqual(["Sou jogador."]);
  });
  it("does not request any translation when all segments are literal", async () => {
    const invoke = vi.fn();
    for (const text of ["⚽️".repeat(150), "12345\n\n!!! ? 2026", "\n\n"]) {
      await expect(translatePostText(text, invoke)).rejects.toThrow(
        "Traduction indisponible",
      );
    }
    expect(invoke).not.toHaveBeenCalled();
  });
  it.each([envelope(["INVALID LANGUAGE PAIR SPECIFIED"]), null])(
    "does not multiply requests for quotas, invalid languages or malformed data",
    async (response) => {
      const invoke = vi.fn().mockResolvedValue(response);
      await expect(
        translatePostText("sou jogador ".repeat(70), invoke),
      ).rejects.toThrow("Traduction indisponible");
      expect(invoke).toHaveBeenCalledTimes(1);
    },
  );
  it("does not bypass authentication or a missing server dependency", async () => {
    const unavailable = new Error("HTTP 503 member access unavailable");
    const invoke = vi.fn().mockRejectedValue(unavailable);
    await expect(
      translatePostText("sou jogador ".repeat(70), invoke),
    ).rejects.toBe(unavailable);
    expect(invoke).toHaveBeenCalledTimes(1);
  });
  it("preserves unchanged names and shared labels in a translated publication", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce(lengthFailure)
      .mockImplementation(async (texts: string[]) =>
        envelope(texts.map((text, i) => (i ? text : "Je suis joueur."))),
      );
    const original =
      "sou jogador ".repeat(70) + "\n\nContact: 123456\n\n#Football";
    const result = await translatePostText(original, invoke);
    expect(result).toContain("Je suis joueur.");
    expect(result).toContain("Contact: 123456");
    expect(result).toContain("#Football");
  });
  it("still rejects a fully unchanged publication after splitting", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce(lengthFailure)
      .mockImplementation(async (texts: string[]) => envelope(texts));
    await expect(
      translatePostText("sou jogador ".repeat(70), invoke),
    ).rejects.toThrow("Traduction indisponible");
  });
  it("rejects missing segments and repeated length rejections without recursion", async () => {
    for (const response of [envelope([]), lengthFailure]) {
      const invoke = vi
        .fn()
        .mockResolvedValueOnce(lengthFailure)
        .mockResolvedValue(response);
      await expect(
        translatePostText("sou jogador ".repeat(70), invoke),
      ).rejects.toThrow("Traduction indisponible");
      expect(invoke).toHaveBeenCalledTimes(2);
    }
  });
  it("stops before the next batch when the viewer cancels or leaves", async () => {
    const cancellation = new AbortController();
    const invoke = vi
      .fn()
      .mockResolvedValueOnce(lengthFailure)
      .mockImplementation(async (texts: string[], signal: AbortSignal) => {
        cancellation.abort();
        expect(signal.aborted).toBe(true);
        return envelope(texts.map(() => "Traduction fictive du test."));
      });
    await expect(
      translatePostText(
        "sou jogador ".repeat(700),
        invoke,
        cancellation.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(invoke).toHaveBeenCalledTimes(2);
  });
  it("honours a pre-cancelled request without contacting the backend", async () => {
    const cancellation = new AbortController();
    cancellation.abort();
    const invoke = vi.fn();
    await expect(
      translatePostText("sou jogador", invoke, cancellation.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(invoke).not.toHaveBeenCalled();
  });
  it("cancels an in-flight translation at the overall deadline", async () => {
    vi.useFakeTimers();
    const invoke = vi.fn(
      (_texts: string[], signal: AbortSignal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () =>
            reject(new DOMException("Cancelled", "AbortError")),
          ),
        ),
    );
    const result = translatePostText("sou jogador", invoke);
    const assertion = expect(result).rejects.toMatchObject({
      name: "AbortError",
    });
    await vi.advanceTimersByTimeAsync(60000);
    await assertion;
    expect(invoke).toHaveBeenCalledTimes(1);
  });
  it("rejects empty or over-limit posts before any network request", async () => {
    const invoke = vi.fn();
    for (const text of [" ", "a".repeat(10001)])
      await expect(translatePostText(text, invoke)).rejects.toThrow(
        "Traduction indisponible",
      );
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe("translation quota failures", () => {
  it("recognizes the deployed edge's provider quota response", async () => {
    const error = {
      context: new Response(
        JSON.stringify({ error: "translation_provider_429" }),
        {
          status: 500,
        },
      ),
    };
    expect(await translationRequestError(error)).toBeInstanceOf(
      TranslationQuotaError,
    );
    expect(error.context.bodyUsed).toBe(false);
  });
  it("recognizes HTTP rate limits without displaying the upstream body", async () => {
    const error = {
      context: new Response("private diagnostic", { status: 429 }),
    };
    const result = await translationRequestError(error);
    expect(result).toBeInstanceOf(TranslationQuotaError);
    expect((result as Error).message).not.toContain("private");
  });
  it("preserves authentication and other infrastructure errors", async () => {
    for (const error of [
      new Error("offline"),
      { context: new Response("Unauthorized", { status: 401 }) },
      { context: new Response("Unavailable", { status: 503 }) },
      { context: new Response("not JSON", { status: 500 }) },
      {
        context: new Response('{"error":"translation_provider_network"}', {
          status: 500,
        }),
      },
    ])
      expect(await translationRequestError(error)).toBe(error);
  });
  it("stops after a quota warning returned in a success envelope", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValue(
        envelope([
          "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS",
        ]),
      );
    await expect(
      translatePostText("sou jogador ".repeat(70), invoke),
    ).rejects.toBeInstanceOf(TranslationQuotaError);
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
