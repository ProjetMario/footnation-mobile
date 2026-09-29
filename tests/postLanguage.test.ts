import { describe, expect, it } from "vitest";
import { detectPostLanguage, translationSource } from "../src/lib/postLanguage";
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
});
