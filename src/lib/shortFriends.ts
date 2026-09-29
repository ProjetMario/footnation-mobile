import { supabase } from "./supabase";

export function shortFriendIds(
  uid: string,
  following: { followed_id: string }[],
  connections: { user_id: string; connected_user_id: string; status: string }[],
) {
  return [
    ...new Set([
      ...following.map((row) => row.followed_id),
      ...connections
        .filter(
          (row) =>
            row.status === "accepted" &&
            (row.user_id === uid || row.connected_user_id === uid),
        )
        .map((row) =>
          row.user_id === uid ? row.connected_user_id : row.user_id,
        ),
    ]),
  ].filter((id) => id !== uid);
}

export async function fetchShortFriends(uid: string) {
  const following: { followed_id: string }[] = [];
  const connections: {
    user_id: string;
    connected_user_id: string;
    status: string;
  }[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase
      .from("profile_followers")
      .select("followed_id")
      .eq("follower_id", uid)
      .order("followed_id")
      .range(offset, offset + 499);
    if (error) throw error;
    following.push(...(data || []));
    if ((data?.length || 0) < 500) break;
  }
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase
      .from("connections")
      .select("user_id,connected_user_id,status")
      .eq("status", "accepted")
      .or(`user_id.eq.${uid},connected_user_id.eq.${uid}`)
      .order("id")
      .range(offset, offset + 499);
    if (error) throw error;
    connections.push(...(data || []));
    if ((data?.length || 0) < 500) break;
  }
  return shortFriendIds(uid, following, connections);
}
