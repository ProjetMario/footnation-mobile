import React, { useEffect, useRef, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Check, Trash2 } from "lucide-react-native";
import { Button, Field, Screen, useUIStyles } from "../components/ui";
import { useAuth } from "../lib/auth";
import {
  deleteOwnAccount,
  inspectAccountDeletion,
  listAccountDeletionReceipts,
  checkAccountDeletionReceipt,
} from "../lib/accountDeletion";
import type { AccountDeletionReceipt } from "../lib/accountDeletionJournal";
import { useTheme } from "../theme";
import Contact from "./Contact";

function deletedAccountPath(appleRevocationRequired?: boolean) {
  return `/suppression-compte?deleted=1${appleRevocationRequired ? "&appleRevocation=1" : ""}`;
}

function AppleRevocationNotice() {
  const s = useUIStyles();
  const [error, setError] = useState("");
  return (
    <View style={s.card}>
      <Text style={s.h2}>Déconnecter FootNation de votre compte Apple</Text>
      <Text style={s.text}>
        Votre compte FootNation est supprimé. Pour cette ancienne connexion
        Apple, terminez en retirant FootNation dans Réglages → votre nom →
        Connexion et sécurité → Se connecter avec Apple.
      </Text>
      <Button
        title="Voir les instructions Apple"
        secondary
        onPress={() => {
          void Linking.openURL("https://support.apple.com/102571").catch(() =>
            setError(
              "Ouvrez les réglages Apple de votre appareil pour retirer FootNation.",
            ),
          );
        }}
      />
      {!!error && (
        <Text accessibilityRole="alert" style={s.text}>
          {error}
        </Text>
      )}
    </View>
  );
}

export default function AccountDeletion() {
  const s = useUIStyles();
  const { session } = useAuth();
  const { deleted, support, appleRevocation } = useLocalSearchParams<{
    deleted?: string;
    support?: string;
    appleRevocation?: string;
  }>();
  if (deleted === "1" && !session)
    return (
      <Screen title="Compte supprimé">
        <Text accessibilityRole="header" style={s.title}>
          Votre compte a été supprimé
        </Text>
        <Text style={s.text}>
          Vous êtes déconnecté de FootNation sur cet appareil.
        </Text>
        {appleRevocation === "1" && <AppleRevocationNotice />}
        <Button
          title="Revenir à l’accueil"
          onPress={() => router.replace("/")}
        />
      </Screen>
    );
  if (support === "1") return <Contact deletion />;
  return (
    <Screen title="Supprimer mon compte">
      <ReceiptRecovery
        key={`receipt:${session?.user.id || "guest"}`}
        userId={session?.user.id}
      />
      {session ? (
        <DeletionForm key={session.user.id} userId={session.user.id} />
      ) : (
        <>
          <Text style={s.title}>Supprimer mon compte et mes données</Text>
          <Text style={s.text}>
            Connectez-vous au compte concerné pour lancer la suppression. Si
            vous n’y avez plus accès, l’équipe peut vous accompagner.
          </Text>
          <Button
            title="Me connecter"
            onPress={() =>
              router.push({
                pathname: "/login",
                params: { next: "/suppression-compte" },
              })
            }
          />
          <Button
            title="Je n’ai plus accès à mon compte"
            secondary
            onPress={() => router.push("/suppression-compte?support=1")}
          />
        </>
      )}
    </Screen>
  );
}

function DeletionForm({ userId }: { userId: string }) {
  const { colors } = useTheme();
  const s = useUIStyles();
  const { forgetDeletedAccount } = useAuth();
  const pending = useRef(false);
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [cleanupError, setCleanupError] = useState("");
  const inspect = useMutation({
    mutationFn: () => inspectAccountDeletion(userId),
  });
  const remove = useMutation({
    mutationFn: () => deleteOwnAccount(userId, confirmation),
    onSuccess: async (receipt) => {
      try {
        const result = await forgetDeletedAccount(userId);
        if (result === "other") return;
        router.replace(deletedAccountPath(receipt.appleRevocationRequired));
      } catch {
        setCleanupError(
          "Le compte a été supprimé. Rouvrez cet écran pour vérifier le reçu et terminer le nettoyage local de cet appareil. Un autre compte connecté reste conservé.",
        );
      }
    },
    onSettled: () => {
      pending.current = false;
    },
  });
  const busy = inspect.isPending || remove.isPending;
  return (
    <>
      <View style={[s.card, { borderColor: colors.danger }]}>
        <View
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
        >
          <Trash2 size={26} color={colors.danger} />
        </View>
        <Text accessibilityRole="header" style={s.h2}>
          Une action définitive
        </Text>
        <Text style={s.text}>
          Votre profil, vos publications personnelles, vos stories, vos
          connexions et vos messages seront supprimés. Les fichiers dont vous
          êtes propriétaire seront retirés du stockage FootNation. Cette action
          ne peut pas être annulée.
        </Text>
        <Text style={s.small}>
          Les justificatifs de facturation, certaines données de support et de
          sécurité restent soumis à la politique de confidentialité. Aucun
          remboursement automatique n’est déclenché.
        </Text>
        <Button
          title="Lire la politique de confidentialité"
          secondary
          disabled={busy}
          onPress={() => router.push("/politique-confidentialite")}
        />
      </View>
      <Text style={s.text}>
        Vérifiez d’abord les abonnements et les espaces partagés liés à ce
        compte. Les abonnements identifiés seront résiliés et les paiements
        encore ouverts seront fermés avant la suppression.
      </Text>
      <Text style={s.text}>
        Vos groupes et pages partagés restent accessibles à leurs membres.
        Votre lien de propriétaire est retiré et aucun membre n’est promu
        automatiquement. Les autres administrateurs conservent leurs droits ;
        sans autre administrateur, certaines fonctions de gestion ne seront
        plus disponibles. Vos publications personnelles sont supprimées.
      </Text>
      <Button
        title={
          inspect.isSuccess
            ? "Vérifier à nouveau mon compte"
            : "Vérifier mon compte avant suppression"
        }
        secondary
        busy={inspect.isPending}
        disabled={remove.isPending}
        onPress={() => inspect.mutate()}
      />
      {!!inspect.error && (
        <Text
          accessibilityRole="alert"
          style={[s.text, { color: colors.danger }]}
        >
          {inspect.error.message}
        </Text>
      )}
      {!!inspect.data && (
        <View style={s.card}>
          <Text style={s.text}>
            {inspect.data.subscriptionCount} abonnement(s) à résilier ;{" "}
            {inspect.data.checkoutCount} paiement(s) ouvert(s) à fermer.
          </Text>
          <Text style={s.small}>
            {inspect.data.recentlyAuthenticated
              ? "Votre connexion est récente. Le serveur la vérifiera à nouveau au moment de supprimer."
              : "Reconnectez-vous pour confirmer votre identité, puis revenez vérifier ce compte."}
          </Text>
          <Button
            title="Me réauthentifier"
            secondary
            disabled={busy}
            onPress={() =>
              router.push({
                pathname: "/login",
                params: { next: "/suppression-compte" },
              })
            }
          />
          <Field
            label="Saisissez SUPPRIMER pour confirmer"
            value={confirmation}
            onChangeText={setConfirmation}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            editable={!busy}
          />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acknowledged, disabled: busy }}
            accessibilityLabel="Je comprends que cette suppression est définitive et autorise la résiliation des abonnements identifiés."
            disabled={busy}
            onPress={() => setAcknowledged((value) => !value)}
            style={[s.row, { minHeight: 44, paddingVertical: 8, gap: 10 }]}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: acknowledged
                  ? colors.deepBlue
                  : colors.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {!!acknowledged && (
                <Check size={18} color={colors.white} aria-hidden />
              )}
            </View>
            <Text style={[s.text, { flex: 1 }]}>
              Je comprends que la suppression est définitive et autorise la
              résiliation des abonnements identifiés.
            </Text>
          </Pressable>
          <Button
            title="Supprimer définitivement mon compte"
            busy={remove.isPending}
            disabled={
              busy ||
              confirmation !== "SUPPRIMER" ||
              !acknowledged ||
              !inspect.data.recentlyAuthenticated ||
              remove.isSuccess
            }
            onPress={() => {
              if (pending.current) return;
              pending.current = true;
              remove.mutate();
            }}
          />
        </View>
      )}
      {!!remove.error && (
        <Text
          accessibilityRole="alert"
          style={[s.text, { color: colors.danger }]}
        >
          {remove.error.message}
        </Text>
      )}
      {!!cleanupError && (
        <Text accessibilityRole="alert" style={s.text}>
          {cleanupError}
        </Text>
      )}
      <Button
        title="Contacter l’équipe pour cette suppression"
        secondary
        disabled={busy}
        onPress={() => router.push("/suppression-compte?support=1")}
      />
      <Button
        title="Conserver mon compte"
        secondary
        disabled={busy}
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace("/settings")
        }
      />
    </>
  );
}

function ReceiptRecovery({ userId }: { userId?: string }) {
  const s = useUIStyles();
  const { colors } = useTheme();
  const { forgetDeletedAccount } = useAuth();
  const [receipts, setReceipts] = useState<AccountDeletionReceipt[]>([]);
  const [message, setMessage] = useState("");
  const [appleRevocation, setAppleRevocation] = useState(false);
  useEffect(() => {
    let active = true;
    void listAccountDeletionReceipts(userId)
      .then((values) => {
        if (active) setReceipts(values);
      })
      .catch(() => {
        if (active)
          setMessage(
            "Le suivi local n’a pas pu être lu. Contactez l’équipe si vous avez déjà lancé une suppression.",
          );
      });
    return () => {
      active = false;
    };
  }, [userId]);
  const check = useMutation({
    mutationFn: async (receipt: AccountDeletionReceipt) => {
      if (!(await checkAccountDeletionReceipt(receipt))) {
        setMessage(
          "Aucune suppression terminée n’a été confirmée pour cette tentative. Reconnectez-vous au compte concerné pour continuer, ou contactez l’équipe.",
        );
        return;
      }
      const result = await forgetDeletedAccount(receipt.userId);
      const confirmed = (
        await listAccountDeletionReceipts(receipt.userId)
      ).find((value) => value.operationId === receipt.operationId);
      setAppleRevocation(confirmed?.appleRevocationRequired === true);
      if (result === "other") {
        setMessage(
          "La suppression commencée précédemment est confirmée. Votre compte actuellement connecté est conservé.",
        );
        return;
      }
      router.replace(deletedAccountPath(confirmed?.appleRevocationRequired));
    },
  });
  if (!receipts.length && !message) return null;
  return (
    <View style={s.card}>
      <Text style={s.h2}>Une suppression a été commencée sur cet appareil</Text>
      <Text style={s.small}>
        Vous pouvez en vérifier le résultat pendant 24 heures. Cette
        vérification ne relance jamais une suppression.
      </Text>
      {receipts.map((receipt, index) => (
        <Button
          key={receipt.operationId}
          title={
            receipts.length > 1
              ? `Vérifier la tentative ${index + 1}`
              : "Vérifier le résultat de ma suppression"
          }
          secondary
          busy={
            check.isPending &&
            check.variables?.operationId === receipt.operationId
          }
          disabled={check.isPending}
          onPress={() => check.mutate(receipt)}
        />
      ))}
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={s.text}>
          {message}
        </Text>
      )}
      {appleRevocation && <AppleRevocationNotice />}
      {!!check.error && (
        <Text
          accessibilityRole="alert"
          style={[s.text, { color: colors.danger }]}
        >
          {check.error.message}
        </Text>
      )}
    </View>
  );
}
