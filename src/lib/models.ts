export interface Profile {
  account_type?: string | null;
  is_verified?: boolean | null;
  linked_club_id?: string | null;
  club_official_name?: string | null;
  club_year_founded?: string | number | null;
  club_colors?: string | null;
  club_address?: string | null;
  club_phone?: string | null;
  club_email?: string | null;
  club_website?: string | null;
  business_name?: string | null;
  business_description?: string | null;
  business_sector?: string | null;
  business_address?: string | null;
  business_email?: string | null;
  business_phone?: string | null;
  business_website?: string | null;
  institution_name?: string | null;
  institution_description?: string | null;
  institution_type?: string | null;
  institution_level?: string | null;
  institution_address?: string | null;
  institution_email?: string | null;
  institution_phone?: string | null;
  id: string;
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username: string | null;
  avatar_url: string | null;
  bio?: string | null;
  city?: string | null;
  country?: string | null;
  gender?: string | null;
  favorite_pro_club?: string | null;
  favorite_amateur_club?: string | null;
  department?: string | null;
  club?: string | null;
  primary_role?: string | null;
  position?: string | null;
  height?: string | null;
  weight?: string | null;
  birthdate?: string | null;
  nationality?: string | null;
  strong_foot?: string | null;
  weak_foot?: string | null;
  average_playtime?: string | null;
  secondary_roles?: string[] | null;
  secondary_positions?: string[] | null;
  cover_url?: string | null;
  cover_image_url?: string | null;
  experience_history?: unknown[] | null;
  achievements?: unknown[] | null;
  individual_awards?: unknown[] | null;
  certifications?: Record<string, unknown> | unknown[] | null;
  education?: unknown[] | null;
  training_history?: unknown[] | null;
  experience?: unknown[] | string | null;
  technical_skills?: string | null;
  characteristics?: string | null;
  highest_level?: string | null;
  skills?: string[] | null;
  is_admin?: boolean;
  is_suspended?: boolean;
  suspended_until?: string | null;
}
export interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  video_url: string | null;
  created_at: string;
  location: string | null;
  hashtags: string[] | null;
  author: Profile | null;
  post_comments?: { count: number }[];
  post_reactions?: { id: string; user_id: string; reaction_type: string }[];
  repost?: { userId: string; name: string; createdAt: string };
}
export interface Club {
  id: string;
  name: string;
  short_name?: string;
  city?: string;
  department_code?: string;
  department_name?: string | null;
  logo_url?: string;
  type?: "club" | "five_center" | string | null;
  latitude?: number;
  longitude?: number;
}
export interface Opportunity {
  club_id?: string | null;
  id: string;
  user_id: string;
  title: string;
  description: string;
  opportunity_type: string;
  listing_kind?: "offer" | "request" | null;
  location_city: string | null;
  location_department: string | null;
  target_profile_type: string | null;
  created_at: string;
}
export interface Message {
  attachment?: import("./messageAttachment").MessageAttachment | null;
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  is_blocked: boolean | null;
  sender?: Profile;
  receiver?: Profile;
}
export const displayName = (p?: Partial<Profile> | null) => {
  const fullName = p?.full_name?.trim();
  const firstLast = [p?.first_name, p?.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return fullName || firstLast || p?.username || "Membre FootNation";
};
