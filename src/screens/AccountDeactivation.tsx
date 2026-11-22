import React, { useRef, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { PauseCircle } from "lucide-react-native";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { useTheme } from "../theme";
import {
  deactivateOwnAccount,
  deactivationDurations,
  type DeactivationDuration,
} from "../lib/accountDeactivation";
import { CompactForm } from "../components/CompactForm";
import { AuthGate } from "../components/AuthGate";
import {
  Button,
  Chip,
  ErrorState,
  Screen,
  useUIStyles,
} from "../components/ui";

export default function AccountDeactivation() {
  const { session, reload } = useAuth();
  const s = useUIStyles();
  const { colors } = useTheme();
  const [duration, setDuration] = useState<DeactivationDuration>(7);
  const [confirm, setConfirm] = useState(false);
  const [until, setUntil] = useState<string | null>(null);
  const pending = useRef(false);
  const action = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("Reconnectez-vous au compte concerné.");
      return deactivateOwnAccount(session.user.id, duration);
    },
    onSuccess: async (date) => {
      setUntil(date);
      await reload();
    },
    onSettled: () => {
      pending.current = false;
    },
  });
  const back = () =>
    router.canGoBack() ? router.back() : router.replace("/settings");
  return (
    <Screen
      title="Désactiver temporairement"
      back={!action.isPending && !until}
    >
      <CompactForm>
        {until ? (
          <View style={s.card}>
            <Text style={s.h2}>Compte désactivé</Text>
            <Text style={s.text}>
              Vous pourrez vous reconnecter à partir du{" "}
              {new Date(until).toLocaleString("fr-FR")}.
            </Text>
            <Button
              title="Revenir à l’accueil"
              onPress={() => router.replace("/")}
            />
          </View>
        ) : (
          <AuthGate>
            <View style={s.card}>
              <PauseCircle size={28} color={colors.deepBlue} aria-hidden />
              <Text style={s.h2}>Faire une pause</Text>
              <Text style={s.text}>
                Votre accès sera suspendu pendant la durée choisie. Votre compte
                et vos données seront conservés.
              </Text>
              <Text style={s.small}>
                Vous pourrez vous reconnecter après cette période. La
                désactivation ne supprime pas vos publications et ne résilie pas
                vos abonnements.
              </Text>
              <Text style={s.label}>Durée de la pause</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {deactivationDurations.map((days) => (
                  <Chip
                    key={days}
                    label={`${days} jours`}
                    selected={duration === days}
                    disabled={action.isPending}
                    onPress={() => {
                      setDuration(days);
                      setConfirm(false);
                      action.reset();
                    }}
                  />
                ))}
              </View>
              {confirm ? (
                <>
                  <Text style={s.text}>
                    Confirmer la désactivation de votre compte pendant{" "}
                    {duration} jours ? Vous ne pourrez pas vous reconnecter
                    avant la fin de cette période.
                  </Text>
                  <Button
                    title={`Confirmer la pause de ${duration} jours`}
                    busy={action.isPending}
                    disabled={action.isPending}
                    onPress={() => {
                      if (pending.current) return;
                      pending.current = true;
                      action.mutate();
                    }}
                  />
                  <Button
                    title="Annuler"
                    secondary
                    disabled={action.isPending}
                    onPress={() => setConfirm(false)}
                  />
                </>
              ) : (
                <Button
                  title="Désactiver temporairement"
                  onPress={() => setConfirm(true)}
                />
              )}
              {!!action.error && <ErrorState error={action.error} />}
              <Button
                title="Conserver mon compte actif"
                secondary
                disabled={action.isPending}
                onPress={back}
              />
            </View>
          </AuthGate>
        )}
      </CompactForm>
    </Screen>
  );
}
