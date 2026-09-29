import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { newsTranslationOptions } from "../src/lib/newsTranslation";

const article = {
  id: "news-1",
  title: "Michael Olise dévoile son rappeur préféré",
  description: "Le joueur aime le rap.",
};
const output = (
  title: string,
  description = "Al jugador le gusta el rap.",
) => ({ translations: [{ text: title }, { text: description }] });

describe("news translations follow the chosen language", () => {
  it("translates the title and summary to Spanish with a known French source", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValue(output("Michael Olise revela a su rapero favorito"));
    const client = new QueryClient();
    const result = await client.fetchQuery(
      newsTranslationOptions(article, "es", invoke),
    );
    expect(result).toEqual({
      title: "Michael Olise revela a su rapero favorito",
      description: "Al jugador le gusta el rap.",
    });
    expect(invoke).toHaveBeenCalledWith(
      [article.title, article.description],
      "FR",
      "ES",
      expect.any(AbortSignal),
    );
    expect(article.title).toBe("Michael Olise dévoile son rappeur préféré");
    client.clear();
  });

  it("uses the original without spending quota when switching back to French", async () => {
    const invoke = vi.fn();
    const options = newsTranslationOptions(article, "fr", invoke);
    expect(options.enabled).toBe(false);
    const client = new QueryClient();
    expect(await client.fetchQuery(options)).toEqual({
      title: article.title,
      description: article.description,
    });
    expect(invoke).not.toHaveBeenCalled();
    client.clear();
  });

  it("reuses translations but invalidates the cache after an article edit", async () => {
    const invoke = vi.fn().mockResolvedValue(output("Título"));
    const client = new QueryClient();
    await client.fetchQuery(newsTranslationOptions(article, "es", invoke));
    await client.fetchQuery(newsTranslationOptions(article, "ES", invoke));
    expect(invoke).toHaveBeenCalledTimes(1);
    await client.fetchQuery(
      newsTranslationOptions(
        { ...article, description: "Nouveau résumé." },
        "es",
        invoke,
      ),
    );
    expect(invoke).toHaveBeenCalledTimes(2);
    client.clear();
  });

  it("does not let a late Spanish response replace the newly selected English", async () => {
    let resolveSpanish!: (value: unknown) => void;
    const invoke = vi.fn((_texts, _source, target) =>
      target === "ES"
        ? new Promise((resolve) => {
            resolveSpanish = resolve;
          })
        : Promise.resolve(output("English title", "English summary")),
    );
    const client = new QueryClient();
    const observer = new QueryObserver(
      client,
      newsTranslationOptions(article, "es", invoke),
    );
    const seen: string[] = [];
    const unsubscribe = observer.subscribe((result) => {
      if (result.data) seen.push(result.data.title);
    });
    const english = newsTranslationOptions(article, "en", invoke);
    observer.setOptions(english);
    await client.fetchQuery(english);
    resolveSpanish(output("Título español"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(observer.getCurrentResult().data?.title).toBe("English title");
    expect(seen).not.toContain("Título español");
    unsubscribe();
    client.clear();
  });

  it("preserves empty descriptions and proper names without translating blank fields", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValue({ translations: [{ text: "Michael Olise" }] });
    const client = new QueryClient();
    expect(
      await client.fetchQuery(
        newsTranslationOptions(
          { id: "name", title: "Michael Olise", description: "" },
          "es",
          invoke,
        ),
      ),
    ).toEqual({ title: "Michael Olise", description: "" });
    expect(invoke.mock.calls[0][0]).toEqual(["Michael Olise"]);
    client.clear();
  });

  it.each([
    null,
    { translations: [{ text: "Partial" }] },
    output("", "Valid summary"),
    output(
      "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY",
    ),
  ])(
    "rejects invalid or partial responses instead of showing them as translated",
    async (response) => {
      const client = new QueryClient();
      await expect(
        client.fetchQuery(
          newsTranslationOptions(
            article,
            "es",
            vi.fn().mockResolvedValue(response),
          ),
        ),
      ).rejects.toThrow();
      client.clear();
    },
  );
});
