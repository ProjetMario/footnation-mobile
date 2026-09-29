import { useEffect, useRef, useState } from "react";
import { Linking, Platform, Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  invitationShareTarget,
  type InvitationChannel,
} from "./invitationShare";

export function useInvitationActions(invitationUrl: string) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = async (action: () => Promise<string>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setFeedback("");
    try {
      const message = await action();
      if (mounted.current) setFeedback(message);
    } catch {
      if (mounted.current)
        setFeedback(
          "Cette option n’est pas disponible. Tu peux copier le lien ou le sélectionner manuellement.",
        );
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const copy = () =>
    run(async () => {
      if (!(await Clipboard.setStringAsync(invitationUrl)))
        throw new Error("Copy failed");
      return "Lien copié ! Partage-le avec ton réseau.";
    });

  const share = (channel: InvitationChannel) =>
    run(async () => {
      const target = invitationShareTarget(channel, invitationUrl, Platform.OS);
      if (target.kind === "url") {
        await Linking.openURL(target.url);
        return "Ton invitation est prête. Choisis à qui l’envoyer.";
      }
      try {
        const result = await Share.share({
          title: "Rejoins-moi sur FootNation",
          message: target.message,
        });
        return result?.action === Share.dismissedAction
          ? ""
          : "Tu peux continuer ou inviter d’autres personnes.";
      } catch (error) {
        // Browser cancellation is a normal outcome, never an invitation sent.
        if (error instanceof Error && error.name === "AbortError") return "";
        if (Platform.OS !== "web" || !mounted.current) throw error;
        if (!(await Clipboard.setStringAsync(target.message))) throw error;
        const app =
          channel === "instagram"
            ? "Instagram"
            : channel === "tiktok"
              ? "TikTok"
              : channel === "sms"
                ? "tes SMS"
                : "l’application de ton choix";
        return `Message et lien copiés. Colle-les dans ${app}.`;
      }
    });
  return { copy, share, busy, feedback };
}
