// Conservative local detection: ambiguous captions, names, links and emoji
// don't offer translation. Never infer language from the author's nationality.
const vocabulary: Record<string, string> = {
  fr: "je suis cherche recherche recherches joueur joue équipe avec pour dans une les des mon mes moi nous vous aujourd'hui bonjour salut merci football club ans entraîneur saison match très belle victoire notre votre avoir être tout bien côté toi quoi neuf et du au aux est ma pas mais",
  pt: "sou só jogador futebol jogo tenho anos campeonatos campeonato nacional sair como revelação segundo melhor marcador obrigado olá uma meu minha com para não equipe hoje muito também quero estamos",
  en: "the this that with for and are was have has my your our looking player team years old football today thanks hello great win join playing want from",
  es: "soy jugador fútbol juego tengo años campeonato como mejor gracias hola una mi mis con para equipo hoy muy también quiero estamos busco nuestro",
  it: "sono giocatore calcio squadra gioco anni grazie ciao una mio mia con per oggi molto anche voglio siamo cerco della nella questo",
  de: "ich bin suche spieler fußball mannschaft jahre danke hallo mein meine mit für und heute sehr auch wir sind eine der die das",
  nl: "ik ben zoek speler voetbal team jaar bedankt hallo mijn met voor een het vandaag ook wij zijn deze",
};
const dictionaries = Object.entries(vocabulary).map(
  ([language, words]) => [language, new Set(words.split(" "))] as const,
);

export function detectPostLanguage(text: string): string | null {
  const cleaned = text
    .toLowerCase()
    .replace(/https?:\/\/\S+|[@#][\p{L}\p{N}_]+/gu, " ");
  const words = cleaned.match(/[\p{L}]+(?:['’][\p{L}]+)?/gu) || [];
  const letters = words.join("");
  // Script detection also covers captions written without spaces.
  if (letters.length < 3) return null;
  for (const [language, script] of [
    ["ar", /\p{Script=Arabic}/gu],
    ["el", /\p{Script=Greek}/gu],
    ["he", /\p{Script=Hebrew}/gu],
    ["ko", /\p{Script=Hangul}/gu],
    ["ja", /[\p{Script=Hiragana}\p{Script=Katakana}]/gu],
  ] as const) {
    if ((letters.match(script)?.length || 0) > letters.length * 0.25)
      return language;
  }
  if (words.length < 3) return null;
  const scores = dictionaries
    .map(([language, dictionary]) => ({
      language,
      score: new Set(words.filter((word) => dictionary.has(word))).size,
    }))
    .sort((a, b) => b.score - a.score);
  const [best, runnerUp] = scores;
  return best.score >= 3 && best.score - runnerUp.score >= 2
    ? best.language
    : null;
}

export function translationSource(text: string, target: string): string | null {
  const source = detectPostLanguage(text);
  return source && source !== target.toLowerCase().split(/[-_]/)[0]
    ? source
    : null;
}
