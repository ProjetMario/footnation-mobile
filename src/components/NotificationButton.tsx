import { useTranslation } from "../lib/i18n";
import React, { useEffect, useState } from "react";
import { AppState, Text, View } from "react-native";
import { router } from "expo-router";
import { Heart } from "lucide-react-native";
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from "react-native-svg";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { useTheme } from "../theme";
import { IconButton } from "./ui";

export function NotificationButton({ compact = false }: { compact?: boolean }) {
  const t = useTranslation();
  const { colors } = useTheme();

  const { session } = useAuth();
  const uid = session?.user.id;
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setActive(state === "active");
    });
    return () => subscription.remove();
  }, []);
  const query = useQuery({
    queryKey: ["notifications", uid, "unread-count"],
    enabled: !!uid && active,
    staleTime: 0,
    refetchInterval: active ? 30000 : false,
    queryFn: async () => {
      if (!uid) return 0;
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", uid)
        .eq("read", false);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const count = uid && !query.isError ? (query.data ?? 0) : 0;
  return (
    <IconButton
      label={
        query.isError
          ? t("notifications.countUnavailable")
          : count > 0
            ? t("notifications.countUnread", { count })
            : t("notifications.title")
      }
      onPress={() => router.push("/notifications")}
    >
      <View>
        {count > 0 ? (
          <GradientHeart />
        ) : (
          <Heart size={24} color={colors.navy} strokeWidth={1.8} />
        )}
        {count > 0 && compact ? (
          <View
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: "#C52738",
              borderWidth: 2,
              borderColor: colors.white,
            }}
          />
        ) : count > 0 ? (
          <View
            style={{
              position: "absolute",
              top: -10,
              right: -12,
              minWidth: 19,
              paddingHorizontal: 4,
              borderRadius: 10,
              backgroundColor: "#C52738",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "white", fontSize: 10, fontWeight: "700" }}>
              {count > 99 ? "99+" : String(count)}
            </Text>
          </View>
        ) : null}
      </View>
    </IconButton>
  );
}

function GradientHeart() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Defs>
        <SvgLinearGradient id="notificationHeart" x1="2" y1="4" x2="22" y2="21">
          <Stop offset="0" stopColor="#0967FF" />
          <Stop offset="0.52" stopColor="#7A2CFF" />
          <Stop offset="1" stopColor="#FF174D" />
        </SvgLinearGradient>
      </Defs>
      <Path
        d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 1 1 12 6a5 5 0 1 1 7.5 6.6Z"
        fill="url(#notificationHeart)"
        stroke="url(#notificationHeart)"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
