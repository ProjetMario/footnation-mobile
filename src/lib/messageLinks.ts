import { websiteUrl } from "./websiteUrl";
export type MessageTextPart = { text: string; url?: string };
export function messageLinks(content: string): MessageTextPart[] {
  const parts: MessageTextPart[] = [];
  let cursor = 0;
  for (const match of content.matchAll(
    /(?:https?:\/\/|www\.)[^\s<>"'\u0000-\u001f]+/gi,
  )) {
    const start = match.index!;
    let label = match[0].replace(/[.,!?;:]+$/, "");
    for (const [open, close] of [
      ["(", ")"],
      ["[", "]"],
      ["{", "}"],
    ]) {
      while (
        label.endsWith(close) &&
        label.split(close).length > label.split(open).length
      )
        label = label.slice(0, -1);
    }
    let url: string;
    try {
      url = websiteUrl(label);
    } catch {
      continue;
    }
    if (start > cursor) parts.push({ text: content.slice(cursor, start) });
    parts.push({ text: label, url });
    cursor = start + label.length;
  }
  if (cursor < content.length || !parts.length)
    parts.push({ text: content.slice(cursor) });
  return parts;
}
