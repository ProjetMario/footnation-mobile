import { describe, expect, it } from "vitest";
import { detectPostLanguage, translationSource, translationLanguage, translationPair } from "../src/lib/postLanguage";
describe("post translation visibility", () => {
  it.each([
    "À la recherches d’un club de football #amienfc",
    "Tout va bien de mon côté, et toi, quoi de neuf ? #Football #Mercato",
  ])("offers translation for French feed captions in Spanish: %s", (text) => {
    expect(translationSource(text, "es")).toBe("fr");
    expect(translationSource(text, "fr")).toBeNull();
  });
  it("hides French posts in the French app", () => {
    expect(
      translationSource(
        "Salut je cherche un club pour jouer avec mon équipe",
        "fr",
      ),
    ).toBeNull();
  });
  it("detects Portuguese and normalizes target locales", () => {
    const text =
      "Só jogador de futebol jogo em Angola tenho 15 anos jogo campeonatos sub 17 e no campeonato nacional de Angola sair como jogador revelação e segundo melhor marcador do campeonato.";
    expect(translationSource(text, "fr")).toBe("pt");
    expect(translationSource(text, "pt-BR")).toBeNull();
  });
  it("detects English and Spanish", () => {
    expect(
      detectPostLanguage(
        "I am looking for a team to join this season with my friends",
      ),
    ).toBe("en");
    expect(
      detectPostLanguage("Soy jugador de fútbol y busco equipo para jugar hoy"),
    ).toBe("es");
  });
  it("hides ambiguous text, names, emoji and links", () => {
    for (const text of [
      "⚽🔥",
      "PSG Lyon",
      "Super !",
      "https://example.com/the/and/for #football",
    ])
      expect(translationSource(text, "fr")).toBeNull();
  });
  it("detects script-based captions without requiring spaces", () => {
    expect(translationSource("今日はサッカーの試合に勝ちました", "fr")).toBe(
      "ja",
    );
    expect(translationSource("축구경기에서이겼습니다", "fr")).toBe("ko");
    expect(
      translationSource("今日はサッカーの試合に勝ちました", "ja"),
    ).toBeNull();
  });
  it("normalizes language tags for the translation service and never sends und", () => {
    expect(translationLanguage("en-US")).toBe("en");
    expect(translationLanguage("zh-Hans-CN")).toBe("zh");
    expect(translationLanguage("zh-Hant-TW")).toBeNull();
    expect(translationLanguage("und")).toBeNull();
    expect(translationLanguage("sr-Latn")).toBeNull();
    const text = "Salut je cherche un club pour jouer avec mon équipe";
    expect(translationPair(text, "en-US", "und")).toEqual({ destination: "en", source: "fr" });
    expect(translationPair(text, "fr-FR", "fr")).toEqual({ destination: "fr", source: null });
    expect(translationPair(text, "sr-Latn", "fr")).toEqual({ destination: null, source: "fr" });
  });
  it("offers explicit source auto-detection for discussion text of unknown language", () => {
    expect(translationPair("Привет друзья клуба", "fr", null, true)).toEqual({ destination: "fr", source: "auto" });
    expect(translationPair("Привет друзья клуба", "fr")).toEqual({ destination: "fr", source: null });
    expect(translationPair("⚽🔥", "fr", null, true)).toEqual({ destination: "fr", source: null });
    expect(translationPair("你好", "fr", null, true)).toEqual({ destination: "fr", source: "auto" });
    expect(translationPair("Salut je cherche un club pour jouer avec mon équipe", "fr", null, true)).toEqual({ destination: "fr", source: null });
    expect(translationPair("مرحبا بكم في النادي", "fr", null, true)).toEqual({ destination: "fr", source: "auto" });
    expect(translationPair("مرحبا بكم في النادي", "fr", "ar", true)).toEqual({ destination: "fr", source: "ar" });
    expect(translationPair("سلام دوستان باشگاه", "fr", "fa", true)).toEqual({ destination: "fr", source: "auto" });
  });
});
