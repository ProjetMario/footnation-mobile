import { supabase } from "./supabase";

export type NotificationContentKind = "post" | "story" | "short";

type NotificationRow = {
  receiver_id: string;
  sender_id?: string | null;
  type: string;
  content: string;
  link?: string | null;
  metadata?: Record<string, unknown> | null;
};

const oneDayAgoIso = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

function compactIds(ids: Array<string | null | undefined>, except?: string) {
  return Array.from(
    new Set(ids.filter((id): id is string => !!id && id !== except)),
  );
}

async function safeInsert(rows: NotificationRow | NotificationRow[]) {
  const payload = Array.isArray(rows) ? rows : [rows];
  if (!payload.length) return 0;
  const result = await supabase.from("notifications").insert(payload);
  if (result.error) {
    console.warn("Notification non envoyée", result.error.message);
    return 0;
  }
  return payload.length;
}

export async function notifyProfileView(input: {
  profileId: string;
  viewerId: string;
  viewerName?: string | null;
}) {
  if (input.profileId === input.viewerId) return 0;
  const existing = await supabase
    .from("notifications")
    .select("id")
    .eq("receiver_id", input.profileId)
    .eq("sender_id", input.viewerId)
    .eq("type", "profile_view")
    .gte("created_at", oneDayAgoIso())
    .limit(1)
    .maybeSingle();
  if (!existing.error && existing.data) return 0;
  const name = input.viewerName?.trim() || "Un membre";
  return safeInsert({
    receiver_id: input.profileId,
    sender_id: input.viewerId,
    type: "profile_view",
    content: `${name} a consulté votre profil.`,
    link: `/profile/${input.viewerId}`,
    metadata: { profileId: input.profileId, viewerId: input.viewerId },
  });
}

export async function notifyConnectionRequest(input: {
  senderId: string;
  receiverId: string;
  senderName?: string | null;
}) {
  if (input.senderId === input.receiverId) return 0;
  const name = input.senderName?.trim() || "Un membre";
  return safeInsert({
    receiver_id: input.receiverId,
    sender_id: input.senderId,
    type: "connection_request",
    content: `${name} souhaite se connecter avec vous.`,
    link: `/profile/${input.senderId}`,
    metadata: { senderId: input.senderId },
  });
}

export async function readProfileNetworkRecipientIds(profileId: string) {
  const [followers, connections] = await Promise.all([
    supabase
      .from("profile_followers")
      .select("follower_id")
      .eq("followed_id", profileId),
    supabase
      .from("connections")
      .select("user_id,connected_user_id")
      .eq("status", "accepted")
      .or(`user_id.eq.${profileId},connected_user_id.eq.${profileId}`),
  ]);
  const followerIds = followers.error
    ? []
    : (followers.data || []).map((row) => row.follower_id as string | null);
  const connectionIds = connections.error
    ? []
    : (connections.data || []).map((row) =>
        row.user_id === profileId ? row.connected_user_id : row.user_id,
      );
  return compactIds([...followerIds, ...connectionIds], profileId);
}

function contentLink(kind: NotificationContentKind, id: string) {
  if (kind === "post") return `/posts/${id}`;
  if (kind === "short") return `/shorts/${id}`;
  return `/stories/${id}`;
}

function contentLabel(kind: NotificationContentKind) {
  if (kind === "post") return "publication";
  if (kind === "short") return "short";
  return "story";
}

export async function notifyPublicationPublished(input: {
  authorId: string;
  contentId: string;
  kind: NotificationContentKind;
}) {
  const label = contentLabel(input.kind);
  return safeInsert({
    receiver_id: input.authorId,
    sender_id: input.authorId,
    type: "publication_published",
    content: `Votre ${label} est publiée.`,
    link: contentLink(input.kind, input.contentId),
    metadata: { contentId: input.contentId, kind: input.kind },
  });
}

export async function notifyNetworkNewContent(input: {
  authorId: string;
  authorName?: string | null;
  contentId: string;
  kind: NotificationContentKind;
}) {
  const recipients = await readProfileNetworkRecipientIds(input.authorId);
  const name = input.authorName?.trim() || "Un membre de votre réseau";
  const label = contentLabel(input.kind);
  return safeInsert(
    recipients.map((receiverId) => ({
      receiver_id: receiverId,
      sender_id: input.authorId,
      type: `new_${input.kind}`,
      content: `${name} a publié ${label === "story" ? "une" : "un"} ${label}.`,
      link: contentLink(input.kind, input.contentId),
      metadata: { contentId: input.contentId, kind: input.kind },
    })),
  );
}

export async function notifyStoryExpired(input: {
  ownerId: string;
  storyId: string;
}) {
  const existing = await supabase
    .from("notifications")
    .select("id")
    .eq("receiver_id", input.ownerId)
    .eq("type", "story_expired")
    .contains("metadata", { storyId: input.storyId })
    .limit(1)
    .maybeSingle();
  if (!existing.error && existing.data) return 0;
  return safeInsert({
    receiver_id: input.ownerId,
    sender_id: input.ownerId,
    type: "story_expired",
    content: "Votre story a expiré après 24 h.",
    link: `/stories/${input.storyId}`,
    metadata: { storyId: input.storyId },
  });
}

export async function notifyClubChange(input: {
  profileId: string;
  profileName?: string | null;
  previousClub?: string | null;
  nextClub?: string | null;
}) {
  const previousClub = input.previousClub?.trim() || "";
  const nextClub = input.nextClub?.trim() || "";
  if (!nextClub || previousClub === nextClub) return 0;
  const recipients = await readProfileNetworkRecipientIds(input.profileId);
  const name = input.profileName?.trim() || "Un membre de votre réseau";
  return safeInsert(
    recipients.map((receiverId) => ({
      receiver_id: receiverId,
      sender_id: input.profileId,
      type: "club_changed",
      content: `${name} a changé de club : ${nextClub}.`,
      link: `/profile/${input.profileId}`,
      metadata: {
        profileId: input.profileId,
        previousClub: previousClub || null,
        nextClub,
      },
    })),
  );
}
