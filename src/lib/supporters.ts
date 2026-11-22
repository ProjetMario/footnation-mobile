import { Linking, Platform, Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import { requireBackend, supabase } from "./supabase";
import { SUPPORTERS_ENABLED } from "./supportersConfig";

export const SUPPORTERS_PAGE_SIZE = 20;
export type SupporterGroup = {
  id: string; name: string; club_name: string; club_id?: string | null; city: string; description: string;
  created_by: string | null; member_count: number; created_at: string;
};
export type SupporterMembership = { group_id: string; user_id: string; joined_at: string };
export type SupporterMessage = {
  id: string; group_id: string; author_id: string | null; content: string; created_at: string;
  author?: { full_name: string | null; username: string | null; avatar_url: string | null } | null;
};
export type SupporterMeetup = {
  id: string; group_id: string; created_by: string | null; title: string;
  kind: "watch_party" | "stadium_trip"; starts_at: string; location: string;
  description: string; capacity: number | null; attendee_count: number;
  status: "scheduled" | "cancelled"; created_at: string;
};
export type CreateSupporterGroup = { name: string; clubName: string; clubId?: string; city: string; description: string };
export type CreateSupporterMeetup = {
  groupId: string; title: string; kind: SupporterMeetup["kind"]; startsAt: string;
  location: string; description: string; capacity: number | null;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const groupColumns = "id,name,club_name,club_id,city,description,created_by,member_count,created_at";
const meetupColumns = "id,group_id,created_by,title,kind,starts_at,location,description,capacity,attendee_count,status,created_at";
function id(value: string) {
  if (typeof value !== "string" || !uuid.test(value)) throw new Error("Lien de communauté invalide.");
  return value.toLowerCase();
}
function ready() {
  if (!SUPPORTERS_ENABLED) throw new Error("L’espace Supporters est temporairement indisponible.");
  requireBackend();
}
function text(value: string, label: string, min: number, max: number) {
  if (typeof value !== "string") throw new Error(`${label} invalide.`);
  const result = value.trim();
  if ([...result].length < min || [...result].length > max) {
    throw new Error(`${label} : entre ${min} et ${max} caractères.`);
  }
  return result;
}
function range(offset: number): [number, number] {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("Page invalide.");
  return [offset, offset + SUPPORTERS_PAGE_SIZE - 1];
}
function search(value?: string) {
  return text(value ?? "", "Recherche", 0, 200).replace(/[\\%_]/g, "\\$&");
}
function fail(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (["PGRST202", "PGRST205", "42P01", "42883"].includes(error.code ?? "")) {
    throw new Error("L’espace Supporters n’est pas encore disponible. Réessayez plus tard.");
  }
  if (error.code === "42501" || error.code === "PGRST301") {
    throw new Error("Connectez-vous avec un compte autorisé pour effectuer cette action.");
  }
  // The database deliberately returns these user-facing constraints. Do not
  // expose arbitrary SQL/network messages or pretend a lost response succeeded.
  if (error.code === "P0001") {
    const message = error.message ?? "";
    if (/capacity|full|complet/i.test(message)) throw new Error("Ce rendez-vous est complet.");
    if (/owner|creator|créateur|organis/i.test(message)) throw new Error("Cette action est réservée à l’organisateur. Le créateur doit rester membre de son groupe.");
    if (/rate|limit|rapid|many|trop de/i.test(message)) throw new Error("Trop de demandes. Patientez un instant avant de réessayer.");
    if (/past|cancel|ended|scheduled|fermées/i.test(message)) throw new Error("Ce rendez-vous n’accepte plus d’inscriptions.");
  }
  throw new Error("L’opération n’a pas pu être confirmée. Actualisez avant de réessayer.");
}
async function mutate<T>(name: string, args: Record<string, unknown>, row = false): Promise<T> {
  ready();
  const { data, error } = await supabase.rpc(name, args);
  fail(error);
  if (row ? !data || !uuid.test(data.id ?? "") : data !== true) {
    throw new Error("L’opération n’a pas pu être confirmée. Actualisez avant de réessayer.");
  }
  return data as T;
}

export async function listSupporterGroups({ club, clubId, city, offset = 0 }: { club?: string; clubId?: string; city?: string; offset?: number } = {}): Promise<SupporterGroup[]> {
  ready();
  const bounds = range(offset);
  const clubTerm = search(club), cityTerm = search(city);
  let query = supabase.from("supporter_groups").select(groupColumns);
  if (clubId) query = query.eq("club_id", id(clubId));
  else if (clubTerm) query = query.ilike("club_name", `%${clubTerm}%`);
  if (cityTerm) query = query.ilike("city", `%${cityTerm}%`);
  const { data, error } = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).range(...bounds);
  fail(error);
  return (data ?? []) as SupporterGroup[];
}
/** Independent discovery only: it never joins groups or changes club permissions. */
export async function listGroupsForMyClubs(clubIds: string[], city?: string): Promise<SupporterGroup[]> {
  ready();
  const ids = [...new Set(clubIds.map(id))].slice(0, 53);
  if (!ids.length) return [];
  const localCity = search(city);
  const read = async (local: boolean) => {
    let query = supabase.from("supporter_groups").select(groupColumns).in("club_id", ids);
    if (local) query = query.ilike("city", localCity);
    const result = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(12);
    fail(result.error);
    return (result.data ?? []) as SupporterGroup[];
  };
  const [local, other] = await Promise.all([localCity ? read(true) : Promise.resolve([]), read(false)]);
  return [...new Map([...local, ...other].map(group => [group.id, group])).values()].slice(0, 12);
}
export async function getSupporterGroup(groupId: string): Promise<SupporterGroup | null> {
  ready();
  const { data, error } = await supabase.from("supporter_groups").select(groupColumns).eq("id", id(groupId)).maybeSingle();
  fail(error);
  return data as SupporterGroup | null;
}
export async function getSupporterMembership(groupId: string, userId: string): Promise<SupporterMembership | null> {
  ready();
  const { data, error } = await supabase.from("supporter_memberships").select("group_id,user_id,joined_at").eq("group_id", id(groupId)).eq("user_id", id(userId)).maybeSingle();
  fail(error);
  return data as SupporterMembership | null;
}
export async function listSupporterMessages(groupId: string, offset = 0): Promise<SupporterMessage[]> {
  ready();
  const { data, error } = await supabase.from("supporter_messages")
    .select("id,group_id,author_id,content,created_at,author:profiles!author_id(full_name,username,avatar_url)")
    .eq("group_id", id(groupId)).order("created_at", { ascending: false }).order("id", { ascending: false }).range(...range(offset));
  fail(error);
  return (data ?? []) as unknown as SupporterMessage[];
}
export async function listSupporterMeetups(groupId: string, offset = 0): Promise<SupporterMeetup[]> {
  ready();
  const { data, error } = await supabase.from("supporter_meetups").select(meetupColumns)
    .eq("group_id", id(groupId)).gte("starts_at", new Date().toISOString())
    .order("starts_at").order("id").range(...range(offset));
  fail(error);
  return (data ?? []) as SupporterMeetup[];
}
export async function listMySupporterAttendances(groupId: string, userId: string, meetupIds: string[]): Promise<{ meetup_id: string; user_id: string }[]> {
  ready();
  const group = id(groupId), user = id(userId), uniqueIds = [...new Set(meetupIds.map(id))];
  const registrations: { meetup_id: string; user_id: string }[] = [];
  // Scope receipts to displayed rendez-vous. A global limit could hide a real
  // reservation for a frequent attendee and make its cancellation inaccessible.
  for (let offset = 0; offset < uniqueIds.length; offset += 100) {
    const page = uniqueIds.slice(offset, offset + 100);
    const { data, error } = await supabase.from("supporter_meetup_attendees")
      .select("meetup_id,user_id,meetup:supporter_meetups!inner(group_id)")
      .eq("user_id", user).eq("meetup.group_id", group).in("meetup_id", page).limit(page.length);
    fail(error);
    registrations.push(...(data ?? []).map(({ meetup_id, user_id }) => ({ meetup_id, user_id })));
  }
  return registrations;
}
export function createSupporterGroup(input: CreateSupporterGroup) {
  return mutate<SupporterGroup>("supporter_create_group", {
    p_name: text(input.name, "Nom du groupe", 3, 100),
    p_club_name: text(input.clubName, "Club", 2, 120),
    p_city: text(input.city, "Ville", 2, 120),
    p_description: text(input.description, "Présentation", 0, 1500),
    ...(input.clubId ? { p_club_id: id(input.clubId) } : {}),
  }, true);
}
export const joinSupporterGroup = (groupId: string) => mutate<boolean>("supporter_join_group", { p_group_id: id(groupId) });
export const leaveSupporterGroup = (groupId: string) => mutate<boolean>("supporter_leave_group", { p_group_id: id(groupId) });
export const postSupporterMessage = (groupId: string, content: string) => mutate<SupporterMessage>("supporter_post_message", { p_group_id: id(groupId), p_content: text(content, "Message", 1, 2000) }, true);
export const deleteSupporterMessage = (messageId: string) => mutate<boolean>("supporter_delete_message", { p_message_id: id(messageId) });
export function createSupporterMeetup(input: CreateSupporterMeetup) {
  const timestamp = new Date(input.startsAt).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= Date.now() || timestamp > Date.now() + 2 * 366 * 86400000) {
    throw new Error("Choisissez une date future dans les deux prochaines années.");
  }
  if (!["watch_party", "stadium_trip"].includes(input.kind)) throw new Error("Type de rendez-vous invalide.");
  if (input.capacity !== null && (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 5000)) {
    throw new Error("Le nombre de places doit être compris entre 1 et 5 000.");
  }
  return mutate<SupporterMeetup>("supporter_create_meetup", {
    p_group_id: id(input.groupId), p_title: text(input.title, "Titre", 3, 160),
    p_kind: input.kind, p_starts_at: new Date(timestamp).toISOString(),
    p_location: text(input.location, "Lieu", 3, 240),
    p_description: text(input.description, "Description", 0, 2000), p_capacity: input.capacity,
  }, true);
}
export const setSupporterAttendance = (meetupId: string, attending: boolean) => {
  if (typeof attending !== "boolean") throw new Error("Participation invalide.");
  return mutate<boolean>("supporter_set_attendance", { p_meetup_id: id(meetupId), p_attending: attending });
};
export const cancelSupporterMeetup = (meetupId: string) => mutate<boolean>("supporter_cancel_meetup", { p_meetup_id: id(meetupId) });

export function supporterInviteUrl(groupId: string) {
  // Production keeps Expo under /app; the root website has separate routes.
  return `https://www.foot-nation.com/app/supporters/${id(groupId)}`;
}
function invitation(group: Pick<SupporterGroup, "id" | "name" | "city">) {
  return `Rejoins ${group.name} à ${group.city} sur FootNation ⚽\n${supporterInviteUrl(group.id)}`;
}
export async function copySupporterInvite(group: SupporterGroup) {
  const copied = await Clipboard.setStringAsync(supporterInviteUrl(group.id));
  if (!copied) throw new Error("Copie impossible. Utilisez le bouton Partager.");
}
export async function shareSupporterInvite(group: SupporterGroup) {
  const url = supporterInviteUrl(group.id);
  const message = invitation(group);
  if (Platform.OS === "web") {
    if (!globalThis.navigator?.share) {
      await copySupporterInvite(group);
      return "copied";
    }
    try { await navigator.share({ title: group.name, text: `Rejoins ${group.name} à ${group.city} sur FootNation ⚽`, url }); }
    catch (error) { if ((error as { name?: string }).name !== "AbortError") throw new Error("Le partage n’a pas pu s’ouvrir."); }
  } else {
    await Share.share(Platform.OS === "ios" ? { message: message.replace(`\n${url}`, ""), url } : { message });
  }
}
export async function whatsappSupporterInvite(group: SupporterGroup) {
  await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(invitation(group))}`);
}
