import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import {
  Banner,
  Button,
  Empty,
  MenuRow,
  Screen,
  SearchField,
  useUIStyles,
} from "../components/ui";
import { useTheme } from "../theme";
import { SupportEntry } from "../components/SupportEntry";
const questions = [
  {
    id: "support",
    question: "Comment suivre ma demande d’aide ?",
    answer:
      "Créez une demande pour discuter avec le centre d’aide FootNation. En cours : la conversation est ouverte. Résolu : une réponse a été apportée. Terminé : le ticket est clôturé. Vous pouvez rouvrir une demande si besoin. Les réponses apparaissent dans votre messagerie d’aide.",
    label: "Mes demandes d’aide",
    path: "/support",
  },
  {
    id: "profile",
    question: "Comment modifier mon profil ?",
    answer:
      "Ouvrez Mon espace, puis Paramètres pour modifier les informations de votre profil, votre photo et vos compétences. Votre parcours et vos formations disposent aussi de leurs rubriques dans Mon espace.",
    label: "Modifier mon profil",
    path: "/settings",
  },
  {
    id: "premium",
    question: "Comment devenir Premium OPEN ?",
    answer:
      "L’application ne propose actuellement pas de souscription Premium. L’inscription et la création de votre profil sont gratuites. Pour une question concernant un ancien abonnement Premium OPEN, utilisez le formulaire de contact.",
    label: "Contacter l’équipe",
    path: "/contact",
  },
  {
    id: "club",
    question: "Comment contacter un club ?",
    answer:
      "Recherchez un club dans l’annuaire, puis ouvrez sa fiche pour consulter les coordonnées disponibles et son site internet. Pour contacter un membre par message, ouvrez son profil : l’envoi dépend de votre relation et des règles de messagerie.",
    label: "Rechercher un club",
    path: "/clubs",
  },
  {
    id: "story",
    question: "Comment créer une Story ?",
    answer:
      "Ouvrez Stories dans Mon espace, puis créez une story. Choisissez une photo et ajoutez une légende, un lieu ou des hashtags avant de publier. Une story est visible pendant 24 heures.",
    label: "Créer une story",
    path: "/stories/create",
  },
  {
    id: "deletion",
    question: "Comment supprimer mon compte ?",
    answer:
      "Ouvrez Supprimer mon compte dans Mon espace ou dans Compte et confidentialité. Vérifiez votre compte, reconnectez-vous si nécessaire puis confirmez la suppression définitive. Si le service ne peut pas traiter votre compte automatiquement, un accès à l’équipe reste proposé. Une demande à l’équipe ne supprime pas immédiatement le compte.",
    label: "Demander la suppression",
    path: "/suppression-compte",
  },
];
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export default function Help() {
  const { colors } = useTheme();
  const s = useUIStyles();

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [support, setSupport] = useState(false);
  const term = normalize(search.trim());
  const rows = questions.filter((item) =>
    normalize(`${item.question} ${item.answer}`).includes(term),
  );
  return (
    <Screen title="Centre d’aide">
      <Banner
        eyebrow="FOOTNATION À VOS CÔTÉS"
        title="Comment pouvons-nous vous aider ?"
        description="Trouvez une réponse ou contactez notre équipe."
      />
      <SupportEntry />
      <SearchField
        value={search}
        onChangeText={setSearch}
        placeholder="Rechercher dans l’aide"
      />
      <Text style={s.h2}>Questions fréquentes</Text>
      {!rows.length && (
        <Empty
          title="Aucune réponse trouvée"
          description="Essayez un autre mot ou utilisez le formulaire de contact."
        />
      )}
      {rows.map((item) => (
        <View key={item.id} style={s.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open === item.id }}
            onPress={() =>
              setOpen((current) => (current === item.id ? null : item.id))
            }
            style={[s.row, { justifyContent: "space-between", minHeight: 44 }]}
          >
            <Text style={[s.h2, { flex: 1 }]}>{item.question}</Text>
            <Text style={{ color: colors.blue, fontSize: 24 }}>
              {open === item.id ? "−" : "+"}
            </Text>
          </Pressable>
          {open === item.id && (
            <>
              <Text style={s.text}>{item.answer}</Text>
              <Button
                secondary
                title={item.label}
                onPress={() => router.push(item.path)}
              />
            </>
          )}
        </View>
      ))}
      <Button
        title={
          support
            ? "Masquer les moyens de contact"
            : "Je n’ai pas trouvé ma réponse"
        }
        secondary
        onPress={() => setSupport((v) => !v)}
      />
      {!!support && (
        <View style={s.card}>
          <MenuRow
            title="Nous contacter"
            subtitle="Formulaire de contact avec l’équipe FootNation"
            onPress={() => router.push("/contact")}
          />
          <MenuRow
            title="Messagerie du centre d’aide"
            subtitle="Créer et suivre mes demandes privées"
            onPress={() => router.push("/support")}
          />
          <Text style={s.small}>
            Les réponses ci-dessus constituent le guide d’utilisation de cette
            version. Pour obtenir de l’aide sur un autre sujet, contactez
            l’équipe.
          </Text>
        </View>
      )}
      <View style={s.card}>
        <MenuRow
          title="Améliorer FootNation"
          subtitle="Signaler un problème ou proposer une idée à l’équipe"
          onPress={() => router.push("/feedback")}
        />
        <MenuRow
          title="Confidentialité et sécurité"
          subtitle="Gérer mes préférences et mes blocages"
          onPress={() => router.push("/account-settings")}
        />
        <MenuRow
          title="Communauté"
          subtitle="Retrouver mes relations"
          onPress={() => router.push("/connections")}
        />
        <MenuRow
          title="Sécurité des mineurs"
          subtitle="Consulter les informations de protection"
          onPress={() => router.push("/documents/securite-des-mineurs")}
        />
      </View>
    </Screen>
  );
}
