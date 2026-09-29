import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Repeat2 } from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import {
  parseRepostState,
  repostError,
  setPostRepost,
  setShortRepost,
} from "../lib/postReposts";
import { useTheme } from "../theme";

export function RepostButton({
  postId,
  shortId,
  overlay = false,
}: (
  { postId: string; shortId?: never } | { shortId: string; postId?: never }
) & {
  overlay?: boolean;
}) {
  const uid = useAuth().session?.user.id;
  const kind = shortId ? "short" : "post";
  const contentId = (shortId || postId)!;
  return (
    <RepostControl
      key={`${uid || "guest"}:${kind}:${contentId}`}
      contentId={contentId}
      kind={kind}
      uid={uid}
      overlay={overlay}
    />
  );
}

function RepostControl({
  contentId,
  kind,
  uid,
  overlay,
}: {
  contentId: string;
  kind: "post" | "short";
  uid?: string;
  overlay: boolean;
}) {
  const { colors } = useTheme();
  const cache = useQueryClient();
  const key = [`${kind}-repost`, uid, contentId];
  const locked = useRef(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(timer);
  }, [notice]);
  const state = useQuery({
    queryKey: key,
    enabled: !!uid,
    staleTime: 30_000,
    retry: 1,
    queryFn: async () => {
      const result = await supabase.rpc(
        kind === "short" ? "get_short_repost_state" : "get_post_repost_state",
        {
          [kind === "short" ? "p_short_id" : "p_post_id"]: contentId,
        },
      );
      if (result.error) throw repostError(result.error);
      return parseRepostState(result.data);
    },
  });
  const mutation = useMutation({
    mutationKey: key,
    mutationFn: (desired: boolean) =>
      (kind === "short" ? setShortRepost : setPostRepost)(
        supabase,
        uid!,
        contentId,
        desired,
      ),
    onSuccess: (value) => {
      cache.setQueryData(key, value);
      // Refresh the feed on its next visit, without moving the post being watched.
      void cache.invalidateQueries({
        queryKey: ["shorts-native"],
        refetchType: "none",
      });
      if (kind === "post")
        void cache.invalidateQueries({
          queryKey: ["posts"],
          refetchType: "none",
        });
      setNotice(
        value.reposted
          ? "Republié auprès de votre réseau"
          : "Republication annulée",
      );
    },
    onError: (error) => {
      setNotice(error.message);
      void state.refetch();
    },
    onSettled: () => {
      locked.current = false;
    },
  });
  const selected = state.data?.reposted || false;
  const busy = mutation.isPending || (!!uid && state.isLoading);
  const color = selected
    ? overlay
      ? "#6FE7C3"
      : colors.blue
    : overlay
      ? "#FFFFFF"
      : colors.ink;
  const count = state.data?.count;
  const countLabel = !count
    ? ""
    : new Intl.NumberFormat("fr", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(count);
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${mutation.isError ? "Réessayer la republication" : selected ? "Annuler la republication" : "Republier"}. ${count === undefined ? "Compteur indisponible" : `${count} republication${count === 1 ? "" : "s"}`}.`}
        accessibilityHint={
          kind === "short"
            ? "Partage ce short dans les Reels de vos amis."
            : "Partage cette publication dans le fil de votre réseau."
        }
        accessibilityState={{ selected, disabled: busy, busy }}
        disabled={busy}
        onPress={async (event) => {
          event.stopPropagation();
          if (!uid) {
            router.push({
              pathname: "/login",
              params: {
                next: `/${kind === "short" ? "shorts" : "posts"}/${contentId}`,
              },
            });
            return;
          }
          if (locked.current) return;
          if (!state.data) {
            const loaded = await state.refetch();
            if (loaded.error) setNotice(loaded.error.message);
            return;
          }
          locked.current = true;
          // An uncertain network response retries the same intent, never a toggle.
          mutation.mutate(mutation.isError ? mutation.variables! : !selected);
        }}
        style={({ pressed }) => [
          styles.button,
          { opacity: busy ? 0.55 : pressed ? 0.65 : 1 },
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          <Repeat2 size={overlay ? 32 : 26} color={color} strokeWidth={2} />
        )}
        {!!countLabel && (
          <Text style={[styles.count, { color }, overlay && styles.shadow]}>
            {countLabel}
          </Text>
        )}
      </Pressable>
      {!!notice && (
        <View
          pointerEvents="none"
          style={[styles.notice, !overlay && styles.lightNotice]}
        >
          <Text accessibilityLiveRegion="polite" style={styles.noticeText}>
            {notice}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "relative", zIndex: 10 },
  button: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  count: { fontFamily: "Inter-SemiBold", fontSize: 12, lineHeight: 16 },
  shadow: { textShadowColor: "rgba(0,0,0,0.55)", textShadowRadius: 5 },
  notice: {
    position: "absolute",
    right: 60,
    top: 0,
    width: 205,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(15,23,30,0.96)",
  },
  lightNotice: { left: -85, right: undefined, top: -70 },
  noticeText: {
    fontFamily: "Inter-Medium",
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
  },
});
