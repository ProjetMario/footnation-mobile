import { createClient } from "@supabase/supabase-js";
// Schema-only probes: return zero rows; never insert or update application data.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Public Supabase configuration is required.");
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const checks = [
  ["news_cache", "id,title,description,source_name,published_at,url,image_url"],
  ["news_comments", "id,news_id,user_id,content,parent_id,created_at"],
  ["news_reactions", "id,news_id,user_id,reaction"],
  ["club_followers", "id,club_id,profile_id,club_name"],
  [
    "profiles",
    "id,education,certifications,training_history,referral_code,referred_by,cover_image_url",
  ],
  [
    "user_preferences",
    "user_id,email_notifications,push_notifications,profile_visibility",
  ],
  ["user_blocks", "id,blocker_id,blocked_id,created_at"],
  ["posts", "id,content,location,hashtags"],
  ["post_comments", "id,post_id,user_id,content"],
  ["events", "id,organizer_id,title,status,current_participants"],
  ["event_participants", "id,participant_id,status,payment_status"],
  ["groups", "id,created_by,privacy"],
  ["group_memberships", "id,group_id,user_id,role"],
  ["pro_pages", "id,owner_id,verification_status"],
  ["pro_page_posts", "id,page_id,content"],
  ["pro_page_teams", "id,page_id,name"],
  ["pro_page_matches", "id,page_id,status"],
  ["pro_page_media", "id,page_id,url"],
  ["pro_page_team_players", "id,team_id,name"],
  ["swipes", "id,target_id,direction"],
  ["swipes", "target_type"],
  ["matching_matches", "id,user1_id,user2_id,status"],
  ["matching_matches", "user1_type,user2_type"],
  ["verification_requests", "id,profile_id,status,requested_at"],
  [
    "club_claim_requests",
    "id,user_id,club_id,status,id_card_front_url,id_card_back_url",
  ],
  ["live_streams", "id,video_url,expires_at"],
  ["video_highlights", "id,stream_id,timestamp_seconds"],
  ["match_predictions", "id,match_id,user_id,prediction"],
  ["user_prediction_stats", "user_id,total_points"],
  ["profile_views", "id,profile_id,viewer_id"],
  ["call_sessions", "id,caller_id,callee_id,status"],
];
let failed = 0;
for (const [table, columns] of checks) {
  const { error } = await db.from(table).select(columns).limit(0);
  const protectedEndpoint =
    error?.code === "42501" &&
    ["verification_requests", "call_sessions"].includes(table);
  if (error && !protectedEndpoint) failed++;
  console.log(
    JSON.stringify({
      table,
      columns,
      ok: !error,
      ...(protectedEndpoint ? { expectedAnonymousDenial: true } : {}),
      ...(error ? { code: error.code, message: error.message } : {}),
    }),
  );
}
process.exitCode = failed ? 1 : 0;
