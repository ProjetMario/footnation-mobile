export type NewsTopic =
  | "top"
  | "mercato"
  | "ligue1"
  | "ucl"
  | "epl"
  | "laliga"
  | "seriea"
  | "bundesliga"
  | "france"
  | "world"
  | "psg"
  | "om"
  | "ol"
  | "lens"
  | "monaco"
  | "feminine"
  | "youth"
  | "injuries"
  | "coaches"
  | "referee";

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  sourceName: string;
  publishedAt: string | null;
  url: string;
  imageUrl?: string | null;
  topic: NewsTopic;
}

export interface NewsListResponse {
  topic: NewsTopic;
  query: string;
  lang: string;
  limit: number;
  page: number;
  totalArticles: number | null;
  items: NewsItem[];
  fromCache?: boolean;
}

export type NewsReactionType = "like" | "fire" | "wow";

export type NewsReactionTotals = Record<NewsReactionType, number>;

export interface NewsReactionsPayload {
  totals: Record<string, NewsReactionTotals>;
  userReactions: Record<string, NewsReactionType>;
}

export interface NewsItemResponse {
  item: NewsItem;
}

export interface NewsCommentProfile {
  id: string;
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
}

export interface NewsComment {
  id: string;
  content: string;
  createdAt: string;
  parentId: string | null;
  userId: string;
  profile?: NewsCommentProfile | null;
}

export interface NewsReactionsResponse {
  totals: Record<string, NewsReactionTotals>;
  userReactions: Record<string, NewsReactionType>;
}

export interface NewsNetworkActivityItem {
  userId: string;
  reaction: string;
  createdAt: string;
  profile?: {
    id: string;
    full_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
  } | null;
}

export interface NewsNetworkActivityResponse {
  items: NewsNetworkActivityItem[];
}
