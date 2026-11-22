import React, { useState } from "react";
import { ProfileCareerEditor } from "./ProfileCareerEditor";
import { ProfileRecommendations } from "./ProfileRecommendations";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import {
  Award,
  ChevronDown,
  Quote,
  Briefcase,
  Edit3,
  GraduationCap,
  Heart,
  Shirt,
  Sparkles,
  Trophy,
  UserRound,
  type LucideIcon,
} from "lucide-react-native";
import type { Profile } from "../lib/models";
import { profileAboutSections, isPlayerProfile } from "../lib/profileAbout";
import {
  formatExperienceYears,
  getBestExperience,
  normalizeAchievements,
  normalizeExperiences,
} from "../lib/profileCareer";
import { useTheme, useThemedStyles, type ThemeColors } from "../theme";
import { ProfileIdentity } from "./ProfileIdentity";
import { OrganizationDetails } from "./OrganizationDetails";
import { ProfileInfoLink, ProfileInfoProvider } from "./ProfileInfo";
import { clubInfoAction, profileInfoActions } from "../lib/profileInfoActions";

const icons: Record<string, LucideIcon> = {
  identity: UserRound,
  football: Shirt,
  skills: Sparkles,
  favorites: Heart,
  education: GraduationCap,
};

export function ProfileAbout({
  profile,
  ownProfile,
}: {
  profile: Profile;
  ownProfile: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const columns = width >= 600;
  const sourceSections = profileAboutSections(profile, ownProfile);
  const sections = [
    { id: "football", title: "Football", sources: ["football", "physical"] },
    {
      id: "identity",
      title: "Informations personnelles",
      sources: ["identity", "location", "presentation"],
    },
    { id: "skills", title: "Points forts", sources: ["skills"] },
    {
      id: "education",
      title: "Formations et diplômes",
      sources: ["education"],
    },
    { id: "favorites", title: "Clubs favoris", sources: ["favorites"] },
  ]
    .map((section) => ({
      ...section,
      fields: sourceSections
        .filter((source) => section.sources.includes(source.id))
        .flatMap((source) =>
          source.fields.map((field) => ({ ...field, sourceId: source.id })),
        )
        .filter((field) => field.value !== null),
    }))
    .filter((section) => section.fields.length > 0);
  const experiences = normalizeExperiences(profile);
  const highest = getBestExperience(experiences, profile.highest_level);
  const achievements = normalizeAchievements(profile.achievements);
  const awards = normalizeAchievements(profile.individual_awards);
  const organization = ["club", "business", "institution"].includes(
    profile.account_type || "",
  );
  const showCareer =
    !organization && (ownProfile || experiences.length > 0 || !!highest?.level);
  const editProfile = () => router.push("/settings");
  const [careerEditor, setCareerEditor] = useState<
    "career" | "achievements" | null
  >(null);
  const editCareer = () => setCareerEditor("career");
  return (
    <ProfileInfoProvider ownProfile={ownProfile ? profile : undefined}>
      {!!careerEditor && (
        <ProfileCareerEditor
          profile={profile}
          mode={careerEditor}
          onClose={() => setCareerEditor(null)}
        />
      )}
      <View style={styles.container}>
        <View style={styles.heading}>
          <View style={styles.headingText}>
            <Text accessibilityRole="header" style={styles.title}>
              En bref
            </Text>
          </View>
          {ownProfile && (
            <EditAction label="Modifier mon profil" onPress={editProfile} />
          )}
        </View>
        <ProfileIdentity profile={profile} />
        {sections.map((section) => (
          <AboutDetails
            key={`${profile.id}-${section.id}`}
            title={section.title}
            icon={icons[section.id] || UserRound}
            defaultOpen={section.id === "football"}
          >
            <View style={styles.fields}>
              {section.fields.map((field) => (
                <ProfileInfoLink
                  info={{
                    ...field,
                    actions: profileInfoActions(
                      profile,
                      field.sourceId,
                      field.label,
                      field.value,
                      ownProfile,
                    ),
                  }}
                  key={field.label}
                  showIndicator={false}
                  style={[
                    styles.field,
                    columns &&
                      !["presentation", "skills", "education"].includes(
                        field.sourceId,
                      ) &&
                      styles.halfField,
                  ]}
                >
                  <Text style={styles.label}>{field.label}</Text>
                  <Text
                    style={[
                      styles.value,
                      field.value === null && styles.missing,
                    ]}
                  >
                    {field.value || "Non renseigné"}
                  </Text>
                </ProfileInfoLink>
              ))}
            </View>
          </AboutDetails>
        ))}
        {organization && (
          <OrganizationDetails profile={profile} ownProfile={ownProfile} />
        )}
        {showCareer && (
          <AboutDetails title="Parcours" icon={Briefcase}>
            <View style={styles.sectionActions}>
              {ownProfile ? (
                <EditAction
                  label="Modifier mon parcours"
                  onPress={editCareer}
                />
              ) : undefined}
            </View>
            {!organization && !!highest?.level && (
              <View style={[styles.card, styles.highlight]}>
                <SectionHeading
                  title="Plus haut niveau atteint"
                  icon={Trophy}
                />
                <ProfileInfoLink
                  info={{
                    label: "Plus haut niveau",
                    value: [
                      highest.level,
                      highest.club,
                      highest.ageCategory,
                      highest.highestYear ||
                        (highest.startYear && formatExperienceYears(highest)),
                    ]
                      .filter(Boolean)
                      .join(" · "),
                    actions: [
                      ...profileInfoActions(
                        profile,
                        "football",
                        "Plus haut niveau",
                        highest.level,
                        ownProfile,
                      ),
                      ...(highest.club
                        ? [clubInfoAction(highest.club, highest.clubId)]
                        : []),
                    ],
                  }}
                >
                  <Text style={styles.level}>{highest.level}</Text>
                  {!!(highest.club || highest.ageCategory) && (
                    <Text style={styles.value}>
                      {[highest.club, highest.ageCategory]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  )}
                  {!!(highest.highestYear || highest.startYear) && (
                    <Text style={styles.subtitle}>
                      {highest.highestYear || formatExperienceYears(highest)}
                    </Text>
                  )}
                </ProfileInfoLink>
              </View>
            )}
            {experiences.length ? (
              experiences.map((experience, index) => (
                <View
                  key={`${experience.club}-${index}`}
                  style={styles.experience}
                >
                  <View style={styles.timeline}>
                    <View style={styles.dot} />
                    {index < experiences.length - 1 && (
                      <View style={styles.line} />
                    )}
                  </View>
                  <ProfileInfoLink
                    style={styles.experienceBody}
                    info={{
                      label: "Parcours et expériences",
                      value: [
                        experience.club,
                        experience.position,
                        experience.level,
                        experience.ageCategory,
                        formatExperienceYears(experience),
                      ]
                        .filter(Boolean)
                        .join(" · "),
                      actions: [
                        ...(experience.club
                          ? [clubInfoAction(experience.club, experience.clubId)]
                          : []),
                        ...(ownProfile
                          ? [
                              {
                                label: "Modifier mon parcours",
                                href: "/experience",
                              },
                            ]
                          : []),
                      ],
                    }}
                  >
                    <Text style={styles.value}>
                      {experience.club || "Club non renseigné"}
                    </Text>
                    {!!(
                      experience.position ||
                      experience.level ||
                      experience.ageCategory
                    ) && (
                      <Text style={styles.subtitle}>
                        {[
                          experience.position,
                          experience.level,
                          experience.ageCategory,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    )}
                    <Text style={styles.period}>
                      {formatExperienceYears(experience)}
                    </Text>
                  </ProfileInfoLink>
                </View>
              ))
            ) : (
              <Text style={styles.subtitle}>
                Aucune expérience renseignée pour le moment.
              </Text>
            )}
          </AboutDetails>
        )}
        {!organization &&
          (achievements.length > 0 ||
            awards.length > 0 ||
            (ownProfile && isPlayerProfile(profile))) && (
            <AboutDetails title="Palmarès" icon={Award}>
              <View style={styles.sectionActions}>
                {ownProfile ? (
                  <EditAction
                    label="Modifier mon palmarès"
                    onPress={() => setCareerEditor("achievements")}
                  />
                ) : undefined}
              </View>
              {achievements.length + awards.length === 0 && (
                <Text style={styles.subtitle}>
                  Aucun palmarès renseigné pour le moment.
                </Text>
              )}
              {[
                { title: "Titres collectifs", items: achievements },
                { title: "Distinctions individuelles", items: awards },
              ]
                .filter((group) => group.items.length)
                .map((group) => (
                  <View key={group.title} style={styles.awards}>
                    <Text style={styles.label}>{group.title}</Text>
                    {group.items.map((item, index) => (
                      <ProfileInfoLink
                        key={`${index}-${item}`}
                        info={{ label: group.title, value: item }}
                      >
                        <View style={styles.award}>
                          <Trophy size={16} color={colors.blue} />
                          <Text style={[styles.value, styles.awardText]}>
                            {item}
                          </Text>
                        </View>
                      </ProfileInfoLink>
                    ))}
                  </View>
                ))}
            </AboutDetails>
          )}
        <AboutDetails
          key={`recommendations-${profile.id}`}
          title="Recommandations"
          icon={Quote}
        >
          <ProfileRecommendations key={profile.id} profile={profile} />
        </AboutDetails>
      </View>
    </ProfileInfoProvider>
  );
}

function EditAction({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.edit}
    >
      <Edit3 size={16} color={colors.blue} />
      <Text style={styles.editLabel}>Modifier</Text>
    </Pressable>
  );
}

function AboutDetails({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  return (
    <View style={styles.details}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={({ pressed }) => [
          styles.disclosure,
          {
            borderColor: focused ? colors.blue : "transparent",
            backgroundColor:
              pressed || hovered ? colors.accentSoft : colors.surface,
          },
        ]}
      >
        <Icon size={18} color={colors.muted} />
        <Text style={styles.sectionTitle}>{title}</Text>
        <ChevronDown
          size={18}
          color={colors.muted}
          style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
        />
      </Pressable>
      {open && <View style={styles.detailsBody}>{children}</View>}
    </View>
  );
}

function SectionHeading({
  title,
  icon: Icon,
  action,
}: {
  title: string;
  icon: LucideIcon;
  action?: React.ReactNode;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.icon}>
        <Icon size={19} color={colors.blue} />
      </View>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {action}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { padding: 14, gap: 10 },
    heading: { flexDirection: "row", alignItems: "center", gap: 12 },
    headingText: { flex: 1, gap: 6 },
    title: { color: colors.muted, fontSize: 14, fontFamily: "Inter-Medium" },
    subtitle: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 21,
      fontFamily: "Inter-Regular",
    },
    card: {
      padding: 16,
      gap: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      shadowColor: colors.blue,
      shadowOpacity: 0.025,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 4 },
    },
    sectionHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
    sectionTitle: {
      flex: 1,
      color: colors.ink,
      fontSize: 15,
      lineHeight: 21,
      fontFamily: "Inter-Bold",
    },
    icon: {
      width: 30,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
      backgroundColor: colors.accentSoft,
    },
    details: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      overflow: "hidden",
      backgroundColor: colors.surface,
    },
    disclosure: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: 56,
      padding: 14,
      borderWidth: 1,
      borderRadius: 15,
    },
    detailsBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 12 },
    sectionActions: { alignItems: "flex-end" },
    fields: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    field: {
      width: "100%",
      gap: 4,
      minWidth: 0,
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      borderRadius: 0,
    },
    halfField: { width: "47%", flexGrow: 1 },
    label: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18,
      fontFamily: "Inter-Medium",
    },
    value: {
      color: colors.ink,
      fontSize: 14,
      lineHeight: 21,
      fontFamily: "Inter-SemiBold",
    },
    missing: { color: colors.muted, fontFamily: "Inter-Regular" },
    edit: {
      minHeight: 44,
      paddingHorizontal: 10,
      flexDirection: "row",
      gap: 7,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
      backgroundColor: colors.surfaceRaised,
    },
    editLabel: {
      color: colors.blue,
      fontSize: 13,
      fontFamily: "Inter-SemiBold",
    },
    highlight: { borderLeftWidth: 2, borderLeftColor: colors.blue },
    level: {
      color: colors.blue,
      fontSize: 18,
      lineHeight: 24,
      fontFamily: "Inter-Bold",
    },
    experience: { flexDirection: "row", gap: 12 },
    timeline: { width: 12, alignItems: "center" },
    dot: {
      width: 10,
      height: 10,
      marginTop: 6,
      borderRadius: 5,
      backgroundColor: colors.blue,
    },
    line: { width: 2, flex: 1, marginTop: 6, backgroundColor: colors.border },
    experienceBody: { flex: 1, gap: 5, paddingBottom: 12 },
    period: {
      color: colors.blue,
      fontSize: 12,
      lineHeight: 18,
      fontFamily: "Inter-Medium",
    },
    awards: { gap: 10 },
    award: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
    awardText: { flex: 1 },
  });
