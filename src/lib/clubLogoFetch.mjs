import { isProfessionalClub, projectClubLogos } from "./clubLogoPolicy.mjs";

function fields(select) {
  const result = [];
  let depth = 0, quoted = false, start = 0;
  for (let i = 0; i < select.length; i++) {
    const char = select[i];
    if (char === '"') quoted = !quoted;
    if (quoted) continue;
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) { result.push(select.slice(start, i).trim()); start = i + 1; }
  }
  result.push(select.slice(start).trim());
  return result.filter(Boolean);
}

function badgeField(field) {
  const match = /^(?:(\w+):)?(logo_url|metadata)((?:(?:->|::).*)?)$/.exec(field);
  if (!match) return null;
  const scalar = match[3].includes("->");
  const pathKey = match[3].split(/->>?/).at(-1).replace(/::\w+$/, "").replace(/^"|"$/g, "");
  if (scalar && !["logo", "logo_url"].includes(pathKey)) return null;
  return { key: match[1] || (scalar ? pathKey : match[2]), field: match[2], scalar };
}

// Inspect only explicitly selected fff_clubs relations. A profile named "club"
// is still a profile: its avatar must never be treated as a club badge.
export function clubLogoSelection(select = "*", rootClub = false) {
  // Do not change identity-only, aggregate or count projections.
  rootClub = rootClub && fields(select).some(field => field === "*" || badgeField(field));
  const children = [];
  const aliases = [];
  const selected = fields(select).map(field => {
    const relation = /^([\w:!]+)\((.*)\)$/.exec(field);
    if (!relation) {
      const alias = badgeField(field);
      if (rootClub && alias) aliases.push(alias);
      return field;
    }
    const prefix = relation[1];
    const parts = prefix.split(":");
    const table = parts.at(-1).split("!")[0];
    const key = parts.length > 1 ? parts[0] : table;
    const child = clubLogoSelection(relation[2], table === "fff_clubs");
    if (child.hasClubs) children.push({ key, ...child });
    return `${prefix}(${child.select})`;
  });
  if (rootClub && !selected.includes("*") && !selected.includes("is_pro")) selected.push("is_pro");
  if (rootClub && !selected.includes("*")) selected.push("__fn_professional_status:metadata->>professional_status");
  return { select: selected.join(","), rootClub, children, aliases, hasClubs: rootClub || children.length > 0 };
}

export function projectSelectedClubLogos(value, selection) {
  if (Array.isArray(value)) return value.map(row => projectSelectedClubLogos(row, selection));
  if (!value || typeof value !== "object") return value;
  const identity = selection.rootClub && value.__fn_professional_status === 'verified' ? {...value, professional_status:'verified'} : value;
  let result = selection.rootClub ? projectClubLogos(identity) : value;
  if (selection.rootClub && Object.hasOwn(result, '__fn_professional_status')) {
    if (result === value) result = {...result};
    delete result.__fn_professional_status;
    if (!Object.hasOwn(value, 'professional_status')) delete result.professional_status;
  }
  if (selection.rootClub && isProfessionalClub(identity)) {
    for (const alias of selection.aliases) {
      if (alias.field === "logo_url" || alias.scalar) result[alias.key] = null;
      else result[alias.key] = projectClubLogos({ is_pro: true, metadata: value[alias.key] }).metadata;
    }
  }
  for (const child of selection.children) {
    if (Object.prototype.hasOwnProperty.call(value, child.key)) {
      if (result === value) result = { ...value };
      result[child.key] = projectSelectedClubLogos(value[child.key], child);
    }
  }
  return result;
}

// Narrow read adapter: auth, storage, RPCs and mutations are passed through.
// The same policy applies before React Query receives direct or joined clubs.
export function clubLogoFetch(baseUrl, fetcher = (...args) => globalThis.fetch(...args)) {
  const origin = new URL(baseUrl).origin;
  return async (input, init) => {
    const originalUrl = typeof input === "string" || input instanceof URL ? String(input) : input.url;
    const url = new URL(originalUrl);
    const method = (init?.method || (typeof input === "object" && input.method) || "GET").toUpperCase();
    if (url.origin !== origin || method !== "GET" || !/^\/rest\/v1\/[\w]+$/.test(url.pathname)) return fetcher(input, init);
    const selection = clubLogoSelection(url.searchParams.get("select") || "*", url.pathname.endsWith("/fff_clubs"));
    if (!selection.hasClubs) return fetcher(input, init);
    url.searchParams.set("select", selection.select);
    const request = typeof input === "string" || input instanceof URL ? url.toString() : new Request(url, input);
    const response = await fetcher(request, init);
    if (!response.ok || !response.headers.get("content-type")?.includes("json")) return response;
    const data = await response.json();
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    return new Response(JSON.stringify(projectSelectedClubLogos(data, selection)), {
      status: response.status, statusText: response.statusText, headers,
    });
  };
}
