export function clubUuid(value: unknown): boolean;
export function clubRouteShard(slug: string): string;
export function createClubIdResolver(options?: {baseUrl?: string; fetchImpl?: typeof fetch; timeoutMs?: number; now?: () => number}): (slug: string) => Promise<string | null>;
export function readClubByRoute<T extends {id?: string; slug?: string | null}>(route: string, readers: {resolveId: (slug: string) => Promise<string | null>; readById: (id: string) => Promise<T | null>; readBySlug: (slug: string) => Promise<T | null>}): Promise<T | null>;
