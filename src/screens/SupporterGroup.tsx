import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SafeAreaModal as Modal } from "../components/SafeAreaModal";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Copy,
  Flag,
  MapPin,
  MessageCircle,
  Plus,
  Radio,
  RefreshCw,
  Share2,
  ShieldCheck,
  Ticket,
  Trash2,
  Users,
  X,
} from "lucide-react-native";
import {
  Avatar,
  Button,
  Chip,
  Empty,
  ErrorState,
  Field,
  IconButton,
  Screen,
  useUIStyles,
} from "../components/ui";
import { DateField } from "../components/DateField";
import { useAuth } from "../lib/auth";
import {
  cancelSupporterMeetup,
  copySupporterInvite,
  createSupporterMeetup,
  deleteSupporterMessage,
  getSupporterGroup,
  getSupporterMembership,
  joinSupporterGroup,
  leaveSupporterGroup,
  listMySupporterAttendances,
  listSupporterMeetups,
  listSupporterMessages,
  postSupporterMessage,
  setSupporterAttendance,
  shareSupporterInvite,
  whatsappSupporterInvite,
  type SupporterMeetup,
  type SupporterMessage,
} from "../lib/supporters";
import { useTheme, useThemedStyles, type ThemeColors } from "../theme";

const PAGE_SIZE = 20;
type Confirmation =
  { kind: "leave" } | { kind: "message" | "meetup"; id: string };

function dateLabel(value: string) {
  return new Date(value).toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SupporterGroupScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = typeof rawId === "string" ? rawId : "";
  const uid = useAuth().session?.user.id;
  // A new account or group must never inherit another person's draft, pending
  // confirmation, or mutation callbacks. The AuthProvider clears query caches.
  return (
    <SupporterGroupContent key={`${id}:${uid ?? "guest"}`} id={id} uid={uid} />
  );
}

function SupporterGroupContent({ id, uid }: { id: string; uid?: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const s = useUIStyles();
  const client = useQueryClient();
  const [tab, setTab] = useState<"agenda" | "discussion">("agenda");
  const [showMeetupForm, setShowMeetupForm] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [shareError, setShareError] = useState<unknown>(null);
  const [shareNotice, setShareNotice] = useState("");
  const group = useQuery({
    queryKey: ["supporters", "group", id],
    queryFn: () => getSupporterGroup(id),
    enabled: !!id,
  });
  const membership = useQuery({
    queryKey: ["supporters", "membership", id, uid],
    queryFn: () => getSupporterMembership(id, uid!),
    enabled: !!id && !!uid,
  });
  const member = !!uid && !!membership.data;
  const creator = !!uid && group.data?.created_by === uid;
  const meetups = useInfiniteQuery({
    queryKey: ["supporters", "meetups", id],
    queryFn: ({ pageParam }) => listSupporterMeetups(id, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined,
    enabled: !!group.data,
  });
  const meetupRows = meetups.data?.pages.flat() ?? [];
  const attendanceMeetupIds = Array.from(
    new Set(
      meetupRows
        .filter((item) => item.status === "scheduled")
        .map((item) => item.id),
    ),
  ).sort();
  const messages = useInfiniteQuery({
    queryKey: ["supporters", "messages", id, uid],
    queryFn: ({ pageParam }) => listSupporterMessages(id, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined,
    enabled: member && tab === "discussion",
  });
  const attendance = useQuery({
    queryKey: [
      "supporters",
      "attendance",
      id,
      uid,
      attendanceMeetupIds.join(","),
    ],
    queryFn: () => listMySupporterAttendances(id, uid!, attendanceMeetupIds),
    enabled: member && attendanceMeetupIds.length > 0,
  });
  const refresh = () => client.invalidateQueries({ queryKey: ["supporters"] });
  const join = useMutation({
    mutationFn: () => joinSupporterGroup(id),
    onSuccess: refresh,
  });
  const leave = useMutation({
    mutationFn: () => leaveSupporterGroup(id),
    onSuccess: async () => {
      client.setQueryData(["supporters", "membership", id, uid], null);
      client.removeQueries({ queryKey: ["supporters", "messages", id, uid] });
      client.removeQueries({ queryKey: ["supporters", "attendance", id, uid] });
      setConfirmation(null);
      await refresh();
    },
  });
  const send = useMutation({
    mutationFn: () => postSupporterMessage(id, message.trim()),
    onSuccess: async () => {
      setMessage("");
      await client.invalidateQueries({
        queryKey: ["supporters", "messages", id, uid],
      });
    },
  });
  const removeMessage = useMutation({
    mutationFn: (messageId: string) => deleteSupporterMessage(messageId),
    onSuccess: async () => {
      setConfirmation(null);
      await client.invalidateQueries({
        queryKey: ["supporters", "messages", id],
      });
    },
  });
  const rsvp = useMutation({
    mutationFn: ({
      meetupId,
      attending,
    }: {
      meetupId: string;
      attending: boolean;
    }) => setSupporterAttendance(meetupId, attending),
    onSuccess: refresh,
  });
  const cancel = useMutation({
    mutationFn: (meetupId: string) => cancelSupporterMeetup(meetupId),
    onSuccess: async () => {
      setConfirmation(null);
      await refresh();
    },
  });
  const login = () =>
    router.push({ pathname: "/login", params: { next: `/supporters/${id}` } });
  async function invite(kind: "share" | "copy" | "whatsapp") {
    if (!group.data) return;
    setShareError(null);
    setShareNotice("");
    try {
      if (kind === "copy") {
        await copySupporterInvite(group.data);
        setShareNotice("Lien d’invitation copié.");
      } else if (kind === "whatsapp") {
        await whatsappSupporterInvite(group.data);
      } else {
        const result = await shareSupporterInvite(group.data);
        if (result === "copied") setShareNotice("Lien d’invitation copié.");
      }
    } catch (error) {
      setShareError(error);
    }
  }
  const confirmationsBusy =
    leave.isPending || removeMessage.isPending || cancel.isPending;
  const confirmationError =
    confirmation?.kind === "leave"
      ? leave.error
      : confirmation?.kind === "message"
        ? removeMessage.error
        : cancel.error;
  const messageRows = messages.data?.pages.flat() ?? [];
  const attendingIds = new Set(attendance.data?.map((item) => item.meetup_id));

  return (
    <Screen
      title="Supporters"
      right={
        <IconButton label="Actualiser le groupe" onPress={() => void refresh()}>
          <RefreshCw size={20} color={colors.ink} />
        </IconButton>
      }
    >
      {group.isPending ? (
        <ActivityIndicator
          accessibilityLabel="Chargement du groupe"
          color={colors.blue}
        />
      ) : group.error ? (
        <ErrorState error={group.error} retry={() => void group.refetch()} />
      ) : !group.data ? (
        <Empty
          title="Groupe introuvable"
          description="Ce lien ne correspond plus à un groupe disponible."
          action={
            <Button
              title="Découvrir les supporters"
              onPress={() => router.replace("/supporters")}
            />
          }
        />
      ) : (
        <>
          <LinearGradient
            colors={["#123C69", "#0B283D", "#104C48"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroTop}>
              <View style={styles.emblem}>
                <Flag size={34} color="#BDEADA" />
              </View>
              <View style={styles.independent}>
                <ShieldCheck size={14} color="#C9E1FF" />
                <Text style={styles.independentText}>
                  Communauté indépendante
                </Text>
              </View>
            </View>
            <Text style={styles.eyebrow}>{group.data.club_name}</Text>
            <Text accessibilityRole="header" style={styles.heroTitle}>
              {group.data.name}
            </Text>
            <View style={styles.wrap}>
              <View style={styles.meta}>
                <MapPin size={17} color="#C9E1FF" />
                <Text style={styles.heroMeta}>{group.data.city}</Text>
              </View>
              <View style={styles.meta}>
                <Users size={17} color="#C9E1FF" />
                <Text style={styles.heroMeta}>
                  {group.data.member_count}{" "}
                  {group.data.member_count === 1 ? "supporter" : "supporters"}
                </Text>
              </View>
            </View>
            {!!group.data.description && (
              <Text style={styles.heroDescription}>
                {group.data.description}
              </Text>
            )}
            <Text style={styles.heroNote}>
              Créé par des supporters. Ce groupe n’est pas présenté comme une
              association officielle du club.
            </Text>
          </LinearGradient>

          <View style={styles.card}>
            {uid && membership.isPending ? (
              <ActivityIndicator
                accessibilityLabel="Vérification de votre adhésion"
                color={colors.blue}
              />
            ) : membership.error ? (
              <ErrorState
                error={membership.error}
                retry={() => void membership.refetch()}
              />
            ) : member ? (
              <View style={styles.memberRow}>
                <View style={styles.meta}>
                  <Check size={18} color={colors.success} />
                  <Text style={styles.memberText}>
                    {creator
                      ? "Vous organisez cette communauté"
                      : "Vous faites partie du groupe"}
                  </Text>
                </View>
                {!creator && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      leave.reset();
                      setConfirmation({ kind: "leave" });
                    }}
                    style={styles.smallAction}
                  >
                    <Text style={s.small}>Quitter</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <>
                <Text style={s.h2}>Le match est encore mieux ensemble.</Text>
                <Text style={s.subtitle}>
                  Rejoignez les discussions et retrouvez les supporters lors des
                  prochains rendez-vous.
                </Text>
                <Button
                  title={
                    uid ? "Rejoindre le groupe" : "Se connecter pour rejoindre"
                  }
                  busy={join.isPending}
                  onPress={uid ? () => join.mutate() : login}
                />
              </>
            )}
            {!!join.error && <ErrorState error={join.error} />}
            <View style={styles.divider} />
            <Text style={s.label}>Inviter d’autres supporters</Text>
            <View style={styles.wrap}>
              <ShareAction
                label="WhatsApp"
                icon={<MessageCircle size={17} color={colors.success} />}
                onPress={() => void invite("whatsapp")}
              />
              <ShareAction
                label="Copier le lien"
                icon={<Copy size={17} color={colors.deepBlue} />}
                onPress={() => void invite("copy")}
              />
              <ShareAction
                label="Partager"
                icon={<Share2 size={17} color={colors.deepBlue} />}
                onPress={() => void invite("share")}
              />
            </View>
            {!!shareNotice && (
              <Text accessibilityLiveRegion="polite" style={styles.success}>
                {shareNotice}
              </Text>
            )}
            {!!shareError && <ErrorState error={shareError} />}
          </View>

          {!!confirmation && (
            <Modal
              transparent
              animationType="fade"
              visible
              onRequestClose={() => {
                if (!confirmationsBusy) setConfirmation(null);
              }}
            >
              <SafeAreaView style={styles.modalOverlay}>
                <ScrollView
                  contentContainerStyle={styles.modalContent}
                  keyboardShouldPersistTaps="handled"
                >
                  <View
                    accessibilityViewIsModal
                    style={[styles.card, styles.confirmation]}
                  >
                    <Text style={s.h2}>
                      {confirmation.kind === "leave"
                        ? "Quitter ce groupe ?"
                        : confirmation.kind === "message"
                          ? "Supprimer ce message ?"
                          : "Annuler ce rendez-vous ?"}
                    </Text>
                    <Text style={s.subtitle}>
                      {confirmation.kind === "leave"
                        ? "Vous n’aurez plus accès aux discussions. Vos participations à venir seront retirées."
                        : confirmation.kind === "message"
                          ? "Le message disparaîtra de la discussion pour tous les membres."
                          : "Le rendez-vous restera visible avec la mention « Annulé ». Aucune nouvelle participation ne sera possible."}
                    </Text>
                    {!!confirmationError && (
                      <ErrorState error={confirmationError} />
                    )}
                    <Button
                      title="Confirmer"
                      busy={confirmationsBusy}
                      onPress={() => {
                        if (confirmation.kind === "leave") leave.mutate();
                        else if (confirmation.kind === "message")
                          removeMessage.mutate(confirmation.id);
                        else cancel.mutate(confirmation.id);
                      }}
                    />
                    <Button
                      title="Revenir"
                      secondary
                      disabled={confirmationsBusy}
                      onPress={() => setConfirmation(null)}
                    />
                  </View>
                </ScrollView>
              </SafeAreaView>
            </Modal>
          )}

          <View style={styles.tabs}>
            <Tab
              active={tab === "agenda"}
              label="Rendez-vous"
              icon={
                <CalendarDays
                  size={19}
                  color={tab === "agenda" ? colors.deepBlue : colors.muted}
                />
              }
              onPress={() => setTab("agenda")}
            />
            <Tab
              active={tab === "discussion"}
              label="Discussions"
              icon={
                <MessageCircle
                  size={19}
                  color={tab === "discussion" ? colors.deepBlue : colors.muted}
                />
              }
              onPress={() => setTab("discussion")}
            />
          </View>

          {tab === "agenda" ? (
            <>
              <View style={styles.sectionHeading}>
                <View style={{ flex: 1 }}>
                  <Text style={s.h2}>Les rendez-vous du groupe</Text>
                  <Text style={s.small}>Au café, en tribune, ensemble.</Text>
                </View>
                {creator && member && (
                  <IconButton
                    label={
                      showMeetupForm
                        ? "Fermer le formulaire"
                        : "Organiser un rendez-vous"
                    }
                    onPress={() => setShowMeetupForm(!showMeetupForm)}
                  >
                    {showMeetupForm ? (
                      <X color={colors.deepBlue} />
                    ) : (
                      <Plus color={colors.deepBlue} />
                    )}
                  </IconButton>
                )}
              </View>
              {creator && member && !showMeetupForm && (
                <Button
                  title="Organiser un rendez-vous"
                  onPress={() => setShowMeetupForm(true)}
                />
              )}
              {creator && member && showMeetupForm && (
                <MeetupForm
                  groupId={id}
                  onCreated={() => {
                    setShowMeetupForm(false);
                    void refresh();
                  }}
                />
              )}
              {meetups.isPending && (
                <ActivityIndicator
                  accessibilityLabel="Chargement des rendez-vous"
                  color={colors.blue}
                />
              )}
              {!!meetups.error && (
                <ErrorState
                  error={meetups.error}
                  retry={() => void meetups.refetch()}
                />
              )}
              {!!attendance.error && (
                <ErrorState
                  error={attendance.error}
                  retry={() => void attendance.refetch()}
                />
              )}
              {!!rsvp.error && <ErrorState error={rsvp.error} />}
              {!meetups.isPending && !meetups.error && !meetupRows.length && (
                <Empty
                  title="Le premier rendez-vous reste à inventer"
                  description={
                    creator
                      ? "Proposez un lieu pour voir le match ensemble, ou un départ commun vers le stade."
                      : "L’organisateur publiera ici les prochains rendez-vous du groupe."
                  }
                />
              )}
              {meetupRows.map((meetup) => (
                <MeetupCard
                  key={meetup.id}
                  meetup={meetup}
                  attending={attendingIds.has(meetup.id)}
                  member={member}
                  creator={creator}
                  attendanceReady={!attendance.isPending && !attendance.error}
                  busy={
                    rsvp.isPending && rsvp.variables?.meetupId === meetup.id
                  }
                  onAttend={() =>
                    rsvp.mutate({
                      meetupId: meetup.id,
                      attending: !attendingIds.has(meetup.id),
                    })
                  }
                  onJoin={() => (uid ? join.mutate() : login())}
                  joinBusy={join.isPending}
                  onCancel={() => {
                    cancel.reset();
                    setConfirmation({ kind: "meetup", id: meetup.id });
                  }}
                />
              ))}
              {meetups.hasNextPage && (
                <Button
                  title="Voir plus de rendez-vous"
                  secondary
                  busy={meetups.isFetchingNextPage}
                  onPress={() => void meetups.fetchNextPage()}
                />
              )}
            </>
          ) : !member ? (
            <Empty
              title="Une discussion entre supporters"
              description="Rejoignez le groupe pour lire les messages, vous présenter et préparer votre prochaine rencontre."
              action={
                !uid || (!membership.error && !membership.isPending) ? (
                  <Button
                    title={uid ? "Rejoindre le groupe" : "Se connecter"}
                    busy={join.isPending}
                    onPress={uid ? () => join.mutate() : login}
                  />
                ) : undefined
              }
            />
          ) : (
            <>
              <View style={styles.card}>
                <Text style={s.h2}>Faites vivre votre groupe</Text>
                <Field
                  label="Votre message"
                  placeholder="Un mot pour les supporters, une idée pour le prochain match…"
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  maxLength={2000}
                  editable={!send.isPending}
                />
                <Text style={s.small}>
                  {message.length}/2 000 · Échanges bienveillants entre
                  supporters.
                </Text>
                {!!send.error && <ErrorState error={send.error} />}
                <Button
                  title="Publier le message"
                  busy={send.isPending}
                  disabled={!message.trim()}
                  onPress={() => send.mutate()}
                />
              </View>
              <Text style={s.small}>
                Les messages les plus récents apparaissent en premier.
              </Text>
              {messages.isPending && (
                <ActivityIndicator
                  accessibilityLabel="Chargement de la discussion"
                  color={colors.blue}
                />
              )}
              {!!messages.error && (
                <ErrorState
                  error={messages.error}
                  retry={() => void messages.refetch()}
                />
              )}
              {!messages.isPending &&
                !messages.error &&
                !messageRows.length && (
                  <Empty
                    title="À vous de lancer la discussion"
                    description="Présentez-vous et dites depuis quand vous suivez le club."
                  />
                )}
              {messageRows.map((item) => (
                <MessageCard
                  key={item.id}
                  message={item}
                  canDelete={item.author_id === uid || creator}
                  onDelete={() => {
                    removeMessage.reset();
                    setConfirmation({ kind: "message", id: item.id });
                  }}
                />
              ))}
              {messages.hasNextPage && (
                <Button
                  title="Charger les messages précédents"
                  secondary
                  busy={messages.isFetchingNextPage}
                  onPress={() => void messages.fetchNextPage()}
                />
              )}
            </>
          )}
          {member && (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/live/create?mode=simple")}
              style={styles.liveCard}
            >
              <Radio size={24} color={colors.deepBlue} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.h2}>Partagez votre passion en live</Text>
                <Text style={s.small}>
                  Ouvrir la création d’un live FootNation depuis votre profil.
                </Text>
              </View>
              <ChevronRight size={20} color={colors.deepBlue} />
            </Pressable>
          )}
        </>
      )}
    </Screen>
  );
}

function ShareAction({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.shareAction}
    >
      {icon}
      <Text style={styles.shareText}>{label}</Text>
    </Pressable>
  );
}

function Tab({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}
    >
      {icon}
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function MessageCard({
  message,
  canDelete,
  onDelete,
}: {
  message: SupporterMessage;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const s = useUIStyles();
  const name =
    message.author?.full_name || message.author?.username || "Supporter";
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeading}>
        <Avatar uri={message.author?.avatar_url} name={name} size={38} />
        <View style={{ flex: 1 }}>
          <Text style={styles.author}>{name}</Text>
          <Text style={s.small}>{dateLabel(message.created_at)}</Text>
        </View>
        {canDelete && (
          <IconButton
            label={`Supprimer le message de ${name}`}
            onPress={onDelete}
          >
            <Trash2 size={17} color={colors.muted} />
          </IconButton>
        )}
      </View>
      <Text selectable style={s.text}>
        {message.content}
      </Text>
    </View>
  );
}

function MeetupCard({
  meetup,
  attending,
  member,
  creator,
  attendanceReady,
  busy,
  onAttend,
  onJoin,
  joinBusy,
  onCancel,
}: {
  meetup: SupporterMeetup;
  attending: boolean;
  member: boolean;
  creator: boolean;
  attendanceReady: boolean;
  busy: boolean;
  onAttend: () => void;
  onJoin: () => void;
  joinBusy: boolean;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const s = useUIStyles();
  const cancelled = meetup.status === "cancelled";
  const past = new Date(meetup.starts_at).getTime() <= Date.now();
  const full =
    meetup.capacity != null && meetup.attendee_count >= meetup.capacity;
  return (
    <View style={[styles.card, cancelled && { opacity: 0.7 }]}>
      <View style={styles.sectionHeading}>
        <View style={styles.meetupIcon}>
          {meetup.kind === "stadium_trip" ? (
            <Ticket size={23} color={colors.deepBlue} />
          ) : (
            <CalendarDays size={23} color={colors.deepBlue} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.kind}>
            {meetup.kind === "stadium_trip"
              ? "AU STADE ENSEMBLE"
              : "VOIR LE MATCH ENSEMBLE"}
          </Text>
          <Text style={s.h2}>{meetup.title}</Text>
        </View>
      </View>
      <View style={styles.meta}>
        <CalendarDays size={17} color={colors.muted} />
        <Text style={styles.detailText}>{dateLabel(meetup.starts_at)}</Text>
      </View>
      <View style={styles.meta}>
        <MapPin size={17} color={colors.muted} />
        <Text selectable style={styles.detailText}>
          {meetup.location}
        </Text>
      </View>
      {!!meetup.description && <Text style={s.text}>{meetup.description}</Text>}
      <View style={styles.meta}>
        <Users size={17} color={colors.muted} />
        <Text style={styles.detailText}>
          {meetup.attendee_count}{" "}
          {meetup.attendee_count === 1 ? "participant" : "participants"}
          {meetup.capacity != null
            ? ` · ${Math.max(0, meetup.capacity - meetup.attendee_count)} place(s) disponible(s)`
            : ""}
        </Text>
      </View>
      {cancelled ? (
        <Text style={styles.cancelled}>Rendez-vous annulé</Text>
      ) : past ? (
        <Text style={s.small}>Rendez-vous passé</Text>
      ) : member ? (
        <Button
          title={
            attending
              ? "Annuler ma participation"
              : full
                ? "Complet"
                : "Je participe"
          }
          secondary={attending}
          disabled={!attendanceReady || (full && !attending)}
          busy={busy}
          onPress={onAttend}
        />
      ) : (
        <Button
          title="Rejoindre le groupe pour participer"
          secondary
          busy={joinBusy}
          onPress={onJoin}
        />
      )}
      {attending && !cancelled && (
        <Text style={styles.success}>Votre participation est enregistrée.</Text>
      )}
      {creator && !cancelled && !past && (
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          style={styles.smallAction}
        >
          <Text style={styles.cancelled}>Annuler le rendez-vous</Text>
        </Pressable>
      )}
    </View>
  );
}

function MeetupForm({
  groupId,
  onCreated,
}: {
  groupId: string;
  onCreated: () => void;
}) {
  const s = useUIStyles();
  const styles = useThemedStyles(createStyles);
  const [kind, setKind] = useState<SupporterMeetup["kind"]>("watch_party");
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("");
  const [validation, setValidation] = useState("");
  const create = useMutation({
    mutationFn: () =>
      createSupporterMeetup({
        groupId,
        title: title.trim(),
        kind,
        startsAt,
        location: location.trim(),
        description: description.trim(),
        capacity: capacity ? Number(capacity) : null,
      }),
    onSuccess: onCreated,
  });
  function submit() {
    if (title.trim().length < 3 || location.trim().length < 3) {
      setValidation(
        "Indiquez un titre et un lieu de rendez-vous d’au moins 3 caractères.",
      );
      return;
    }
    const date = new Date(startsAt).getTime();
    if (!Number.isFinite(date) || date <= Date.now()) {
      setValidation("Choisissez une date et une heure à venir.");
      return;
    }
    const latest = new Date();
    latest.setFullYear(latest.getFullYear() + 2);
    if (date > latest.getTime()) {
      setValidation("Choisissez une date dans les deux prochaines années.");
      return;
    }
    if (
      capacity &&
      (!/^\d+$/.test(capacity) ||
        Number(capacity) < 1 ||
        Number(capacity) > 5000)
    ) {
      setValidation(
        "Le nombre de places doit être compris entre 1 et 5 000, ou laissé vide.",
      );
      return;
    }
    setValidation("");
    create.mutate();
  }
  return (
    <View style={styles.card}>
      <Text style={s.h2}>Organiser un rendez-vous</Text>
      <View style={styles.wrap}>
        <Chip
          label="Voir le match"
          selected={kind === "watch_party"}
          disabled={create.isPending}
          onPress={() => setKind("watch_party")}
        />
        <Chip
          label="Aller au stade"
          selected={kind === "stadium_trip"}
          disabled={create.isPending}
          onPress={() => setKind("stadium_trip")}
        />
      </View>
      <Field
        label="Titre"
        placeholder={
          kind === "watch_party"
            ? "On regarde le match au café ?"
            : "Départ commun pour le stade"
        }
        value={title}
        onChangeText={setTitle}
        maxLength={160}
        editable={!create.isPending}
      />
      <DateField
        label="Date et heure du rendez-vous"
        value={startsAt}
        onChange={setStartsAt}
        disabled={create.isPending}
      />
      <Field
        label={
          kind === "stadium_trip" ? "Lieu de départ" : "Lieu du rendez-vous"
        }
        placeholder="Nom du lieu, adresse et ville"
        value={location}
        onChangeText={setLocation}
        maxLength={240}
        editable={!create.isPending}
      />
      <Field
        label="Informations pratiques (facultatif)"
        placeholder="Comment se retrouver, horaires, détails utiles…"
        value={description}
        onChangeText={setDescription}
        maxLength={2000}
        multiline
        editable={!create.isPending}
      />
      <Field
        label="Nombre de places (facultatif)"
        placeholder="Sans limite si vide"
        keyboardType="number-pad"
        value={capacity}
        onChangeText={setCapacity}
        maxLength={5}
        editable={!create.isPending}
      />
      <Text style={s.small}>
        Le rendez-vous et son lieu seront visibles sur la page du groupe. Seuls
        ses membres peuvent participer.
      </Text>
      {!!validation && (
        <Text accessibilityRole="alert" style={styles.cancelled}>
          {validation}
        </Text>
      )}
      {!!create.error && <ErrorState error={create.error} />}
      <Button
        title="Publier le rendez-vous"
        busy={create.isPending}
        onPress={submit}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    hero: { borderRadius: 26, padding: 24, gap: 17, overflow: "hidden" },
    heroTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 12,
    },
    emblem: {
      width: 64,
      height: 64,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 22,
      backgroundColor: "#FFFFFF15",
      borderWidth: 1,
      borderColor: "#FFFFFF28",
    },
    independent: {
      flexDirection: "row",
      gap: 6,
      alignItems: "center",
      borderRadius: 30,
      padding: 9,
      backgroundColor: "#FFFFFF10",
      flexShrink: 1,
    },
    independentText: {
      color: "#C9E1FF",
      fontSize: 11,
      fontFamily: "Inter-Medium",
      flexShrink: 1,
    },
    eyebrow: {
      color: "#BDEADA",
      fontSize: 13,
      fontFamily: "Inter-Bold",
      letterSpacing: 1.5,
      textTransform: "uppercase",
    },
    heroTitle: {
      color: "#FFFFFF",
      fontSize: 30,
      lineHeight: 36,
      fontFamily: "Inter-Bold",
      letterSpacing: -0.8,
    },
    heroMeta: {
      color: "#DCE9FC",
      fontFamily: "Inter-Medium",
      fontSize: 14,
      flexShrink: 1,
    },
    heroDescription: {
      color: "#FFFFFF",
      fontSize: 15,
      lineHeight: 23,
      fontFamily: "Inter-Regular",
    },
    heroNote: {
      color: "#B6C8E5",
      fontSize: 11,
      lineHeight: 17,
      fontFamily: "Inter-Regular",
    },
    wrap: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 9,
    },
    meta: { flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1 },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 22,
      padding: 20,
      gap: 14,
    },
    divider: { height: 1, backgroundColor: colors.border },
    memberRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 6,
    },
    memberText: {
      color: colors.success,
      fontSize: 14,
      fontFamily: "Inter-SemiBold",
      flexShrink: 1,
    },
    shareAction: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingVertical: 12,
      paddingHorizontal: 12,
      minHeight: 44,
      borderRadius: 13,
      backgroundColor: colors.surfaceRaised,
    },
    shareText: {
      color: colors.ink,
      fontSize: 12,
      fontFamily: "Inter-SemiBold",
    },
    smallAction: {
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: 6,
      alignSelf: "flex-start",
    },
    success: {
      fontSize: 13,
      color: colors.success,
      fontFamily: "Inter-Medium",
      lineHeight: 20,
    },
    cancelled: {
      fontSize: 13,
      color: colors.danger,
      fontFamily: "Inter-Medium",
      lineHeight: 20,
    },
    confirmation: { borderColor: colors.danger },
    modalOverlay: {
      flex: 1,
      backgroundColor: "#00000088",
      justifyContent: "center",
    },
    modalContent: {
      flexGrow: 1,
      justifyContent: "center",
      padding: 24,
      width: "100%",
      maxWidth: 560,
      alignSelf: "center",
    },
    tabs: {
      flexDirection: "row",
      gap: 8,
      backgroundColor: colors.surfaceRaised,
      padding: 5,
      borderRadius: 16,
    },
    tab: {
      flex: 1,
      paddingVertical: 14,
      gap: 7,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      borderRadius: 12,
      flexWrap: "wrap",
    },
    tabActive: { backgroundColor: colors.surface },
    tabText: {
      fontSize: 14,
      fontFamily: "Inter-SemiBold",
      color: colors.muted,
    },
    tabTextActive: { color: colors.deepBlue },
    sectionHeading: { flexDirection: "row", alignItems: "center", gap: 12 },
    author: { fontSize: 14, fontFamily: "Inter-SemiBold", color: colors.ink },
    meetupIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: colors.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    kind: {
      fontSize: 10,
      letterSpacing: 1.1,
      color: colors.deepBlue,
      fontFamily: "Inter-Bold",
      marginBottom: 5,
    },
    detailText: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 14,
      lineHeight: 21,
      flexShrink: 1,
    },
    liveCard: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      gap: 14,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.accentSoft,
    },
  });
