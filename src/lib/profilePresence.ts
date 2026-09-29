import { useQuery } from "@tanstack/react-query";
import { supportRpc, supportUnavailable } from "./support";
import { supabase } from "./supabase";
import { useAuth } from "./auth";

export type ProfileActivity = {
  online: boolean;
  last_seen_at: string | null;
};

const ONLINE_FRESH_MS = 35_000;

type LegacyActivityRow = {
  online?: boolean | null;
  is_online?: boolean | null;
  last_seen_at?: string | null;
};

function normalizeActivity(value: unknown): ProfileActivity {
  const row = Array.isArray(value) ? value[0] : value;
  if (typeof row === "boolean") return { online: row, last_seen_at: null };
  if (row && typeof row === "object") {
    const data = row as LegacyActivityRow;
    return {
      online: Boolean(data.online ?? data.is_online),
      last_seen_at:
        typeof data.last_seen_at === "string" ? data.last_seen_at : null,
    };
  }
  return { online: false, last_seen_at: null };
}

export function useProfileActivity(profileId?: string | null, enabled = true) {
  const uid = useAuth().session?.user.id;
  return useQuery({
    queryKey: ["profile-activity", uid, profileId],
    enabled: !!uid && !!profileId && enabled,
    staleTime: 0,
    refetchInterval: enabled ? 15_000 : false,
    retry: false,
    queryFn: async () => {
      const accountId = uid!;
      try {
        return normalizeActivity(
          await supportRpc<unknown>(accountId, "read_profile_activity", {
            p_profile_id: profileId!,
          }),
        );
      } catch (error) {
        if (!supportUnavailable(error)) throw error;
        return normalizeActivity(
          await supportRpc<boolean>(accountId, "read_profile_presence", {
            p_profile_id: profileId!,
          }),
        );
      }
    },
  });
}

export async function readProfilesActivity(
  uid: string,
  profileIds: string[],
): Promise<Record<string, ProfileActivity>> {
  const uniqueIds = [...new Set(profileIds.filter((id) => id && id !== uid))];
  if (!uniqueIds.length) return {};
  try {
    const { data, error } = await supabase.rpc("read_profiles_activity", {
      p_actor_id: uid,
      p_profile_ids: uniqueIds,
    });
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    return rows.reduce<Record<string, ProfileActivity>>((acc, row) => {
      const record = row as { profile_id?: string };
      if (record.profile_id) acc[record.profile_id] = normalizeActivity(row);
      return acc;
    }, {});
  } catch (error) {
    if (!supportUnavailable(error)) throw error;
    const entries = await Promise.all(
      uniqueIds.map(async (profileId) => {
        const online = await supportRpc<boolean>(uid, "read_profile_presence", {
          p_profile_id: profileId,
        });
        return [profileId, { online, last_seen_at: null }] as const;
      }),
    );
    return Object.fromEntries(entries);
  }
}

export function isActivityOnline(
  activity: ProfileActivity | undefined,
  updatedAt?: number,
) {
  return Boolean(
    activity?.online && (!updatedAt || Date.now() - updatedAt < ONLINE_FRESH_MS),
  );
}

export function lastActivityLabel(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  const time = date.getTime();
  if (!Number.isFinite(time)) return null;
  const diff = Date.now() - time;
  if (diff < 60_000) return "Dernière activité à l’instant";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `Dernière activité il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Dernière activité il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Dernière activité il y a ${days} j`;
  return `Dernière activité le ${date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })}`;
}
