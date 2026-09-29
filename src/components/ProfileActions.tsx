import { applyClubFollowIntent as applyFollowIntent } from "../lib/clubFollowIntent";
import {
  connectionIntent,
  selectConnection,
  rejectConnectionIntent,
  type ConnectionRow,
} from "../lib/connectionIntent";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Check,
  Clock3,
  MessageCircle,
  MoreHorizontal,
  UserPlus,
  Users,
  X,
} from "lucide-react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { Button, ErrorState, useUIStyles } from "./ui";
import { useTheme } from "../theme";
import { displayName } from "../lib/models";
import { notifyConnectionRequest } from "../lib/notificationEvents";
export function ProfileActions({
  id,
  variant = "default",
}: {
  id: string;
  variant?: "default" | "hero";
}) {
  const { session } = useAuth();
  return (
    <ProfileActionsContent
      key={`${session?.user.id}/${id}`}
      id={id}
      variant={variant}
    />
  );
}
function ProfileActionsContent({
  id,
  variant,
}: {
  id: string;
  variant: "default" | "hero";
}) {
  const [manageOpen, setManageOpen] = useState(false);
  const { colors } = useTheme();
  const s = useUIStyles();

  const { session, profile: authProfile } = useAuth();
  const uid = session?.user.id;
  const cache = useQueryClient();
  const [confirmRemoval, setConfirmRemoval] = useState<ConnectionRow[] | null>(
    null,
  );
  const [confirmRejection, setConfirmRejection] =
    useState<ConnectionRow | null>(null);
  const relationship = useQuery({
    queryKey: ["relationship-v2", uid, id],
    enabled: !!uid && uid !== id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("connections")
        .select("id,user_id,connected_user_id,status")
        .or(
          `and(user_id.eq.${uid},connected_user_id.eq.${id}),and(user_id.eq.${id},connected_user_id.eq.${uid})`,
        );
      if (error) throw error;
      return data || [];
    },
  });
  const current = selectConnection(relationship.data || [], uid || "", id);
  const following = useQuery({
    queryKey: ["following", uid, id],
    enabled: !!uid && uid !== id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile_followers")
        .select("id")
        .eq("follower_id", uid!)
        .eq("followed_id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const connect = useMutation({
    mutationFn: async () => {
      if (!uid) throw new Error("Connexion requise");
      const expected = current;
      const auth = await supabase.auth.getUser();
      if (auth.error) throw auth.error;
      if (auth.data.user?.id !== uid)
        throw new Error("Votre session a changé. Rouvrez le profil.");
      const fresh = await relationship.refetch();
      if (fresh.error) throw fresh.error;
      const freshCurrent = selectConnection(fresh.data || [], uid, id);
      const action = connectionIntent(expected, freshCurrent, uid, id);
      if (action === "done") return;
      const result =
        action === "accept"
          ? await supabase
              .from("connections")
              .update({ status: "accepted" })
              .eq("id", freshCurrent!.id)
              .eq("user_id", id)
              .eq("connected_user_id", uid)
              .eq("status", "pending")
              .select("id")
              .maybeSingle()
          : await supabase
              .from("connections")
              .insert({
                user_id: uid,
                connected_user_id: id,
                status: "pending",
              })
              .select("id")
              .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data)
        throw new Error("Cette invitation a changé. Actualisez la relation.");
      if (action === "create")
        void notifyConnectionRequest({
          senderId: uid,
          receiverId: id,
          senderName: authProfile ? displayName(authProfile) : null,
        });
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["relationship-v2", uid, id] });
      void cache.invalidateQueries({ queryKey: ["connections"] });
      void cache.invalidateQueries({
        queryKey: ["conversation-permission", uid, id],
      });
    },
  });
  const follow = useMutation({
    mutationFn: async (intent: {
      following: boolean;
      expectedId: string | null;
    }) => {
      const auth = await supabase.auth.getUser();
      if (auth.error) throw auth.error;
      if (!uid || auth.data.user?.id !== uid)
        throw new Error("Votre session a changé. Rouvrez le profil.");
      await applyFollowIntent(
        {
          read: async () => {
            const result = await supabase
              .from("profile_followers")
              .select("id")
              .eq("follower_id", uid)
              .eq("followed_id", id)
              .maybeSingle();
            if (result.error) throw result.error;
            return result.data;
          },
          insert: async () => {
            const result = await supabase
              .from("profile_followers")
              .insert({ follower_id: uid, followed_id: id });
            if (result.error) throw result.error;
          },
          remove: async (followId) => {
            const result = await supabase
              .from("profile_followers")
              .delete()
              .eq("id", followId)
              .eq("follower_id", uid)
              .eq("followed_id", id)
              .select("id");
            if (result.error) throw result.error;
            return result.data.length === 1;
          },
        },
        intent.following,
        intent.expectedId,
      );
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["following", uid, id] });
      void cache.invalidateQueries({ queryKey: ["profile-follows", uid] });
      void cache.invalidateQueries({ queryKey: ["profile-overview", uid] });
    },
  });
  const reject = useMutation({
    mutationFn: async (expected: ConnectionRow) => {
      const auth = await supabase.auth.getUser();
      if (auth.error) throw auth.error;
      if (!uid || auth.data.user?.id !== uid)
        throw new Error("Votre session a changé. Rouvrez le profil.");
      await rejectConnectionIntent(
        {
          read: async () => {
            const result = await supabase
              .from("connections")
              .select("id,user_id,connected_user_id,status")
              .eq("id", expected.id)
              .eq("user_id", id)
              .eq("connected_user_id", uid)
              .maybeSingle();
            if (result.error) throw result.error;
            return result.data;
          },
          reject: async () => {
            const result = await supabase
              .from("connections")
              .update({ status: "rejected" })
              .eq("id", expected.id)
              .eq("user_id", id)
              .eq("connected_user_id", uid)
              .eq("status", "pending")
              .select("id")
              .maybeSingle();
            if (result.error) throw result.error;
            return !!result.data;
          },
        },
        expected,
        uid,
        id,
      );
    },
    onSuccess: () => {
      setConfirmRejection(null);
      void cache.invalidateQueries({ queryKey: ["relationship-v2", uid, id] });
      void cache.invalidateQueries({ queryKey: ["connections"] });
      void cache.invalidateQueries({
        queryKey: ["conversation-permission", uid, id],
      });
    },
  });
  const remove = useMutation({
    mutationFn: async (expected: ConnectionRow[]) => {
      const auth = await supabase.auth.getUser();
      if (auth.error) throw auth.error;
      if (!uid || auth.data.user?.id !== uid)
        throw new Error("Votre session a changé. Rouvrez le profil.");
      const result = await supabase.rpc("remove_native_connections", {
        peer_id: id,
        expected_rows: expected,
      });
      if (result.error) {
        if (result.error.code === "40001")
          throw new Error(
            "Cette relation a changé. Annulez et actualisez avant de confirmer son retrait.",
          );
        throw result.error;
      }
    },
    onSuccess: () => {
      setConfirmRemoval(null);
      void cache.invalidateQueries({ queryKey: ["relationship-v2", uid, id] });
      void cache.invalidateQueries({ queryKey: ["connections"] });
      void cache.invalidateQueries({
        queryKey: ["conversation-permission", uid, id],
      });
    },
  });
  if (!uid || uid === id) return null;
  const accepted = current?.status === "accepted",
    rejected = current?.status === "rejected",
    pending = current?.status === "pending",
    incoming = pending && current?.connected_user_id === uid;
  const controls = (
    <View style={{ gap: 10 }}>
      <Button
        title={
          accepted
            ? "Relation établie"
            : incoming
              ? "Accepter l’invitation"
              : pending
                ? "Invitation envoyée"
                : rejected
                  ? "Invitation refusée"
                  : "Se connecter"
        }
        onPress={() => connect.mutate()}
        busy={connect.isPending}
        disabled={
          relationship.isPending ||
          relationship.isError ||
          accepted ||
          rejected ||
          !!confirmRemoval ||
          !!confirmRejection ||
          reject.isPending ||
          remove.isPending ||
          (pending && !incoming)
        }
      />
      {!!relationship.error && (
        <ErrorState
          error={relationship.error}
          retry={() => void relationship.refetch()}
        />
      )}
      {!!following.error && (
        <ErrorState
          error={following.error}
          retry={() => void following.refetch()}
        />
      )}
      {!!confirmRejection && (
        <View style={{ gap: 10 }}>
          <Text style={s.text}>Refuser cette invitation ?</Text>
          <Button
            title={
              reject.isError ? "Réessayer le même refus" : "Confirmer le refus"
            }
            busy={reject.isPending}
            onPress={() => reject.mutate(confirmRejection)}
          />
          <Button
            title="Annuler"
            secondary
            disabled={reject.isPending}
            onPress={() => {
              setConfirmRejection(null);
              reject.reset();
              void relationship.refetch();
            }}
          />
          {!!reject.error && (
            <Text style={{ color: colors.danger }}>{reject.error.message}</Text>
          )}
        </View>
      )}
      {!!((current || confirmRemoval) && !confirmRejection) &&
        (!!confirmRemoval ? (
          <>
            <Text style={s.text}>
              Confirmer le retrait de votre relation et des invitations en cours
              avec ce membre ?
            </Text>
            <Button
              title={remove.isError ? "Réessayer le même retrait" : "Confirmer"}
              busy={remove.isPending}
              onPress={() => remove.mutate(confirmRemoval)}
            />
            <Button
              title="Annuler"
              secondary
              disabled={remove.isPending}
              onPress={() => {
                setConfirmRemoval(null);
                remove.reset();
                void relationship.refetch();
              }}
            />
          </>
        ) : (
          <Button
            title={
              accepted
                ? "Retirer la relation"
                : incoming
                  ? "Refuser l’invitation"
                  : rejected
                    ? "Supprimer l’invitation refusée"
                    : "Annuler l’invitation"
            }
            secondary
            disabled={
              connect.isPending ||
              relationship.isFetching ||
              relationship.isError
            }
            onPress={() => {
              if (incoming && current) setConfirmRejection(current);
              else setConfirmRemoval(relationship.data || null);
            }}
          />
        ))}
      {!!remove.error && (
        <Text style={{ color: colors.danger }}>{remove.error.message}</Text>
      )}
      {follow.isError ? (
        <>
          <Button
            title="Réessayer la même action de suivi"
            busy={follow.isPending}
            onPress={() => {
              if (follow.variables) follow.mutate(follow.variables);
            }}
          />
          <Button
            title="Annuler et actualiser le suivi"
            secondary
            onPress={() => {
              follow.reset();
              void following.refetch();
            }}
          />
        </>
      ) : (
        <Button
          title={following.data ? "Ne plus suivre" : "Suivre"}
          secondary
          onPress={() =>
            follow.mutate({
              following: !following.data,
              expectedId: following.data?.id || null,
            })
          }
          busy={follow.isPending}
          disabled={
            following.isFetching || following.isError || !following.isSuccess
          }
        />
      )}
      <Button
        title="Signaler ou bloquer"
        secondary
        onPress={() => router.push(`/report/${id}`)}
      />
      {!!(connect.isError || follow.isError) && (
        <Text style={{ color: colors.danger }}>
          {connect.error?.message || follow.error?.message}
        </Text>
      )}
    </View>
  );
  if (variant !== "hero") return controls;
  const connectDisabled =
    relationship.isFetching ||
    remove.isPending ||
    reject.isPending ||
    !!confirmRemoval ||
    !!confirmRejection ||
    relationship.isPending ||
    relationship.isError ||
    connect.isPending ||
    accepted ||
    rejected ||
    (pending && !incoming);
  const label = accepted
    ? "Connectés"
    : incoming
      ? "Accepter"
      : pending
        ? "Invitation envoyée"
        : rejected
          ? "Invitation refusée"
          : "Se connecter";
  const ConnectionIcon = accepted
    ? Check
    : pending && !incoming
      ? Clock3
      : Users;
  return (
    <View style={heroStyles.container}>
      <View style={heroStyles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            following.data ? "Gérer le suivi du profil" : "Suivre ce profil"
          }
          accessibilityState={{
            disabled:
              following.isFetching || following.isPending || follow.isPending,
          }}
          disabled={
            following.isFetching || following.isPending || follow.isPending
          }
          onPress={() => {
            if (following.data || following.isError || follow.isError)
              setManageOpen(true);
            else follow.mutate({ following: true, expectedId: null });
          }}
          style={({ pressed }) => [
            heroStyles.action,
            heroStyles.follow,
            following.data && heroStyles.following,
            { opacity: pressed || following.isPending ? 0.7 : 1 },
          ]}
        >
          {follow.isPending || following.isPending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : following.data ? (
            <Check size={18} color="#FFFFFF" />
          ) : (
            <UserPlus size={18} color="#FFFFFF" />
          )}
          <Text style={heroStyles.primaryLabel}>
            {following.data ? "Suivi" : "Suivre"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            incoming ? "Accepter l’invitation de ce profil" : label
          }
          disabled={connectDisabled}
          onPress={() => connect.mutate()}
          style={({ pressed }) => [
            heroStyles.action,
            heroStyles.connect,
            { opacity: pressed || relationship.isPending ? 0.7 : 1 },
          ]}
        >
          {connect.isPending || relationship.isPending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <ConnectionIcon size={18} color="#FFFFFF" />
          )}
          <Text style={heroStyles.primaryLabel}>{label}</Text>
        </Pressable>
      </View>
      <View style={heroStyles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Envoyer un message"
          onPress={() => router.push(`/conversation/${id}`)}
          style={({ pressed }) => [
            heroStyles.message,
            { opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <MessageCircle size={18} color="#101828" />
          <Text style={heroStyles.messageLabel}>Message</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Gérer la relation et le suivi"
          onPress={() => setManageOpen(true)}
          style={heroStyles.more}
        >
          <MoreHorizontal size={22} color="#FFFFFF" />
        </Pressable>
      </View>
      <Text style={heroStyles.hint}>
        {accepted
          ? "Vous faites partie du même réseau."
          : following.data
            ? "Retrouvez ses publications dans votre fil."
            : "Suivez son actualité. Développez votre réseau."}
      </Text>
      {!!(
        connect.error ||
        follow.error ||
        following.error ||
        relationship.error
      ) && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setManageOpen(true)}
        >
          <Text style={heroStyles.error}>
            Action indisponible. Ouvrir les options pour réessayer.
          </Text>
        </Pressable>
      )}
      <Modal
        visible={manageOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setManageOpen(false)}
      >
        <View style={heroStyles.backdrop}>
          <View
            accessibilityViewIsModal
            style={[heroStyles.sheet, { backgroundColor: colors.surface }]}
          >
            <View style={heroStyles.sheetHeading}>
              <Text style={s.h2}>Relation et suivi</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer les options de relation"
                onPress={() => setManageOpen(false)}
                style={heroStyles.close}
              >
                <X size={22} color={colors.ink} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              {controls}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const heroStyles = StyleSheet.create({
  container: { width: "100%", maxWidth: 420, gap: 10, marginTop: 8 },
  row: { flexDirection: "row", gap: 10 },
  action: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  follow: {
    backgroundColor: "#087CFF",
    borderWidth: 1,
    borderColor: "#3A97FF",
  },
  following: {
    backgroundColor: "rgba(8,124,255,0.25)",
    borderColor: "rgba(255,255,255,0.5)",
  },
  connect: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
  },
  primaryLabel: {
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
    lineHeight: 19,
    textAlign: "center",
    flexShrink: 1,
    color: "#FFFFFF",
  },
  message: {
    flex: 1,
    minHeight: 44,
    padding: 10,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  messageLabel: {
    color: "#101828",
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
  },
  more: {
    width: 48,
    minHeight: 44,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    fontFamily: "Inter-Regular",
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
  },
  error: {
    color: "#FFE1E4",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  sheet: {
    width: "100%",
    maxWidth: 500,
    maxHeight: "85%",
    borderRadius: 24,
    overflow: "hidden",
  },
  sheetHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 20,
    paddingRight: 10,
    paddingTop: 10,
  },
  close: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
});
