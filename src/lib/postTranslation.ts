class TranslationLengthError extends Error {}
const unavailable = "Traduction indisponible pour le moment.";

export class TranslationQuotaError extends Error {
  constructor() {
    super("Le service de traduction a atteint sa limite. Réessaie plus tard.");
    this.name = "TranslationQuotaError";
  }
}

// Edge Functions wraps provider errors in an HTTP error. Read only the known
// machine code; never surface a provider response, key, or submitted text.
export async function translationRequestError(
  error: unknown,
): Promise<unknown> {
  const response = (error as { context?: Response } | null)?.context;
  if (response?.status === 429) return new TranslationQuotaError();
  if (response?.status !== 500) return error;
  try {
    const body = await response.clone().json();
    if (
      body?.error === "translation_provider_429" ||
      body?.error === "translation_provider_456"
    )
      return new TranslationQuotaError();
  } catch {
    // A malformed/empty error body remains an ordinary unavailable response.
  }
  return error;
}

export function translatedTexts(data: unknown, expected: number): string[] {
  const result = data as { translations?: { text?: unknown }[] } | null;
  if (
    !Array.isArray(result?.translations) ||
    result.translations.length !== expected
  )
    throw new Error(unavailable);
  return result.translations.map((item) => {
    const text = item?.text;
    if (typeof text !== "string" || !text.trim()) throw new Error(unavailable);
    if (/^QUERY LENGTH LIMIT EXCEEDED\b/i.test(text.trim()))
      throw new TranslationLengthError(unavailable);
    if (/^MYMEMORY WARNING:.*(?:USED ALL|QUOTA)/i.test(text.trim()))
      throw new TranslationQuotaError();
    if (/^(?:MYMEMORY WARNING|INVALID LANGUAGE PAIR)/i.test(text.trim()))
      throw new Error(unavailable);
    return text;
  });
}

export function translatedPostText(data: unknown, original: string): string {
  const [text] = translatedTexts(data, 1);
  if (text.trim() === original.trim()) throw new Error(unavailable);
  return text;
}

type TranslationPart = { text: string; literal: boolean };
// MyMemory's documented limit is 500 UTF-8 bytes, not 500 characters.
// Keep this portable to Hermes without depending on a DOM TextEncoder.
function splitTranslationText(text: string): TranslationPart[] {
  const parts: TranslationPart[] = [];
  for (const paragraph of text.split(/((?:\r\n|\r|\n)+)/)) {
    if (!paragraph) continue;
    if (!/\p{L}/u.test(paragraph)) {
      parts.push({ text: paragraph, literal: true });
      continue;
    }
    let rest = paragraph;
    while (rest) {
      let end = 0,
        bytes = 0;
      for (const character of rest) {
        const code = character.codePointAt(0)!;
        const size =
          code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
        if (bytes + size > 500) break;
        bytes += size;
        end += character.length;
      }
      if (end < rest.length) {
        const prefix = rest.slice(0, end);
        // Prefer a word boundary. Very long tokens are split at a
        // code-point boundary without introducing an extra space.
        const space = prefix.search(/[ \t]+(?=[^ \t]*$)/);
        if (space > 0) end = space;
      }
      const segment = rest.slice(0, end);
      parts.push({ text: segment, literal: !/\p{L}/u.test(segment) });
      rest = rest.slice(end);
      const separator = rest.match(/^\s+/)?.[0];
      if (separator) {
        parts.push({ text: separator, literal: true });
        rest = rest.slice(separator.length);
      }
    }
  }
  return parts;
}

type TranslationRequest = (
  texts: string[],
  signal: AbortSignal,
) => Promise<unknown>;

/** Normal providers/cache get one request. Split only their explicit length rejection. */
export async function translatePostText(
  text: string,
  invoke: TranslationRequest,
  signal?: AbortSignal,
): Promise<string> {
  if (!/\p{L}/u.test(text) || text.length > 10000) throw new Error(unavailable);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  const timer = setTimeout(cancel, 60000);
  const checkActive = () => {
    if (controller.signal.aborted) {
      const error = new Error("La traduction a été interrompue.");
      error.name = "AbortError";
      throw error;
    }
  };
  const request = async (texts: string[]) => {
    checkActive();
    const response = await invoke(texts, controller.signal);
    checkActive();
    return response;
  };
  try {
    try {
      return translatedPostText(await request([text]), text);
    } catch (error) {
      if (!(error instanceof TranslationLengthError)) throw error;
    }
    const parts = splitTranslationText(text);
    const sources = parts.filter((part) => !part.literal);
    if (
      !sources.length ||
      sources.length > 128 ||
      (sources.length === 1 && sources[0].text === text)
    )
      throw new Error(unavailable);
    const translated: string[] = [];
    // The edge accepts up to 50 texts but calls its fallback serially. Small
    // batches stay within its request timeout and avoid concurrent fan-out.
    for (let start = 0; start < sources.length; start += 4) {
      const batch = sources.slice(start, start + 4);
      const values = translatedTexts(
        await request(batch.map((part) => part.text)),
        batch.length,
      );
      // A valid provider can leave names, hashtags or shared words (e.g.
      // "Contact") unchanged. Only reject an entirely unchanged publication;
      // the provider's error/quota messages are already rejected above.
      translated.push(...values);
    }
    let index = 0;
    const result = parts
      .map((part) => (part.literal ? part.text : translated[index++]))
      .join("");
    // Nothing is displayed until every segment passes validation.
    return translatedPostText({ translations: [{ text: result }] }, text);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
