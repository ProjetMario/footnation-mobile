import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, RefreshCw } from "lucide-react-native";
import { Button, IconButton, Screen, useUIStyles } from "../components/ui";
import {
  AdminAccess,
  AdminTabs,
  useAdmin,
  useAdminLayout,
} from "../components/admin/AdminUI";
import { AdminRecords } from "../components/admin/AdminRecords";
import {
  AdminOverview,
  AdminPerformance,
  AdminPosthog,
  AdminSports,
} from "../components/admin/AdminMetrics";
import { ContentReportQueue } from "../components/ContentReportQueue";
import { ClubClaimRequests } from "./ClubClaimReview";
import {
  adminSections,
  sectionFrom,
  type AdminSection,
  type Filters,
} from "../lib/admin/contracts";
import { useTheme } from "../theme";
import { SupportEntry } from "../components/SupportEntry";

export default function SiteAdmin() {
  return (
    <Screen title="Administration" scroll={false}>
      <AdminAccess>
        <Dashboard />
      </AdminAccess>
    </Screen>
  );
}
function Dashboard() {
  const params = useLocalSearchParams<{
    section?: string;
    search?: string;
    role?: string;
    department?: string;
    country?: string;
    completion?: string;
    sort?: string;
    direction?: string;
  }>();
  const section = sectionFrom(params.section);
  const s = useUIStyles();
  const { styles } = useAdminLayout();
  const { colors } = useTheme();
  const { uid } = useAdmin();
  const cache = useQueryClient();
  const [toolsOpen, setToolsOpen] = useState(false);
  const filters: Filters = {};
  for (const key of [
    "search",
    "role",
    "department",
    "country",
    "completion",
    "sort",
    "direction",
  ] as const)
    if (typeof params[key] === "string") filters[key] = params[key];
  if (section === "incomplete-profiles" && filters.completion === undefined)
    filters.completion = "incomplete";
  function navigate(next: AdminSection, values: Filters = {}) {
    router.setParams({
      section: next,
      search: values.search || "",
      role: values.role || "",
      department: values.department || "",
      country: values.country || "",
      completion:
        values.completion ??
        (next === "incomplete-profiles" ? "incomplete" : ""),
      sort:
        values.sort ||
        (next === "incomplete-profiles" ? "completion" : "activity"),
      direction: values.direction || "desc",
    });
  }
  const title = adminSections.find(([id]) => id === section)![1];
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={styles.content}
    >
      <View style={[s.between, { flexWrap: "wrap" }]}>
        <View style={[s.row, { flex: 1, minWidth: 0 }]}>
          <View
            style={{
              padding: 12,
              backgroundColor: colors.accentSoft,
              borderRadius: 16,
            }}
          >
            <ShieldCheck size={28} color={colors.deepBlue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Super admin</Text>
            <Text style={s.small}>FootNation · Tableau de bord</Text>
          </View>
        </View>
        <IconButton
          label="Actualiser l’administration"
          onPress={() =>
            void cache.invalidateQueries({ queryKey: ["admin", uid] })
          }
        >
          <RefreshCw size={21} color={colors.ink} />
        </IconButton>
      </View>
      <SupportEntry admin />
      <AdminTabs
        items={adminSections}
        value={section}
        onChange={(next) => navigate(next)}
        label="Rubriques du Super admin"
      />
      <View key={section} style={styles.stack}>
        {section === "overview" && <AdminOverview navigate={navigate} />}
        {section === "performance" && <AdminPerformance />}
        {[
          "users",
          "incomplete-profiles",
          "clubs",
          "premium",
          "publications",
        ].includes(section) && (
          <AdminRecords
            resource={
              section as
                | "users"
                | "incomplete-profiles"
                | "clubs"
                | "premium"
                | "publications"
            }
            title={title}
            filters={filters}
            onFiltersChange={(values) => navigate(section, values)}
          />
        )}
        {section === "sports-sync" && <AdminSports />}
        {section === "claims" && (
          <View style={styles.card}>
            <Text style={s.h2}>Revendications de clubs</Text>
            <ClubClaimRequests />
          </View>
        )}
        {section === "moderation" && <Moderation />}
        {section === "posthog" && <AdminPosthog />}
      </View>
      <View style={styles.card}>
        <Button
          title={
            toolsOpen
              ? "Masquer les outils complémentaires"
              : "Outils complémentaires"
          }
          secondary
          onPress={() => setToolsOpen(!toolsOpen)}
        />
        {toolsOpen && (
          <View style={styles.grid}>
            {[
              ["Croissance & activité", "/admin/growth"],
              ["Retours de la bêta", "/admin/feedback"],
              ["Validation des pages Pro", "/admin-pro-validation"],
              ["Vérifications de profils", "/admin/verifications"],
              ["Signalements de clubs", "/admin-club-reports"],
            ].map(([label, path]) => (
              <View key={path} style={styles.cell}>
                <Button
                  title={label}
                  secondary
                  onPress={() => router.push(path as any)}
                />
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
function Moderation() {
  const [tab, setTab] = useState("messages");
  const { styles } = useAdminLayout();
  const s = useUIStyles();
  return (
    <View style={styles.stack}>
      <AdminTabs
        items={[
          ["messages", "Messages"],
          ["content", "Publications et profils"],
          ["blocks", "Blocages"],
          ["accounts", "Comptes"],
        ]}
        value={tab}
        onChange={setTab}
        label="Rubriques de modération"
      />
      {tab === "messages" && (
        <AdminRecords
          key={tab}
          resource="message-reports"
          title="Signalements de messages"
          filters={{ status: "pending" }}
        />
      )}
      {tab === "content" && <ContentReportQueue />}
      {tab === "blocks" && (
        <AdminRecords
          key={tab}
          resource="blocks"
          title="Blocages utilisateurs"
        />
      )}
      {tab === "accounts" && (
        <>
          <Text style={s.text}>
            Ouvrez une fiche pour gérer une suspension ou une suppression
            définitive. Chaque action demande une confirmation.
          </Text>
          <AdminRecords
            key={tab}
            resource="users"
            title="Gestion des comptes"
          />
        </>
      )}
    </View>
  );
}
