import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  MapPin,
  Send,
  Sparkles,
  Target,
} from "lucide-react-native";
import { useTheme } from "../theme";
import { Button, ErrorState, Field, useUIStyles } from "./ui";
import { ChoiceField } from "./ChoiceField";
import { CareerZoneField } from "./CareerZoneField";
import { benefits, choices } from "../lib/careerOptions";
import {
  careerRoles,
  goalFields,
  goalLevels,
  selectObjective,
  internationalCountries,
  type GoalValues,
} from "../lib/careerGoals";
import { careerGoalProgress, type GoalStep } from "../lib/careerGoalProgress";

const gradient = ["#0866FF", "#7135F5", "#EB1671"] as const;
const steps = ["Mon ambition", "Mes préférences", "Ma demande"];
const distanceOptions = ["10", "25", "50", "100", "200", "500"];
const titles = [
  "Votre prochain défi commence ici.",
  "La bonne opportunité, au bon endroit.",
  "Donnez envie de vous rencontrer.",
];
const hints = [
  "Choisissez votre objectif. Quelques détails aideront la communauté à vous trouver.",
  "Dites où et quand vous souhaitez vous lancer. Vous pourrez ajuster ces choix plus tard.",
  "Voici ce que la communauté découvrira dans les opportunités.",
];

function OptionGroup({
  label,
  value,
  options,
  onChange,
  cards = false,
  multiple = false,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  cards?: boolean;
  multiple?: boolean;
}) {
  const { colors } = useTheme();
  const s = useUIStyles();
  return (
    <View style={styles.fieldGroup}>
      <Text style={s.label}>{label}</Text>
      <View style={styles.options}>
        {options.map((option) => {
          const selected = multiple
            ? value.split(", ").includes(option)
            : value === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              {...(Platform.OS === "web" ? { "aria-pressed": selected } : {})}
              onPress={() => {
                if (multiple) {
                  const previous = value.split(", ").filter(Boolean);
                  onChange(
                    (selected
                      ? previous.filter((v) => v !== option)
                      : [...previous, option]
                    ).join(", "),
                  );
                } else onChange(selected && !cards ? "" : option);
              }}
              style={({ pressed }) => [
                styles.option,
                cards && styles.optionCard,
                {
                  borderColor: selected ? colors.blue : colors.border,
                  backgroundColor: selected
                    ? colors.accentSoft
                    : colors.surface,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.optionCheck,
                  {
                    backgroundColor: selected
                      ? colors.deepBlue
                      : colors.surfaceRaised,
                  },
                ]}
              >
                {selected ? (
                  <Check size={15} color="#fff" />
                ) : cards ? (
                  <Target size={17} color={colors.muted} />
                ) : (
                  <View
                    style={[styles.dot, { backgroundColor: colors.border }]}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.optionText,
                  { color: selected ? colors.deepBlue : colors.ink },
                ]}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function projectExample(role: string) {
  const def = careerRoles[role];
  if (def.player)
    return "Ex. : Milieu de terrain motivé, je recherche un projet ambitieux et suis disponible pour des essais.";
  if (role === "Entraîneur" || role === "Éducateur")
    return "Ex. : J’aimerais accompagner un collectif dans sa progression et partager mon expérience sur le terrain.";
  if (role === "Agent")
    return "Ex. : Je souhaite accompagner des joueurs dans leur parcours et développer des liens avec les clubs.";
  if (role === "Parent")
    return "Ex. : Nous recherchons un club avec un encadrement bienveillant et des entraînements le mercredi.";
  if (["Club", "Entreprise / Marque", "Institution"].includes(role))
    return "Ex. : Nous souhaitons construire des partenariats durables autour d’un projet football local.";
  return "Ex. : Je souhaite m’investir dans un projet football près de chez moi et rencontrer une équipe motivée.";
}

export function CareerGoalWizard({
  role,
  value,
  onChange,
  published,
  status,
  busy,
  error,
  success,
  onPublish,
  onWithdraw,
  onView,
}: {
  role: string;
  value: GoalValues;
  onChange: (value: GoalValues) => void;
  published: boolean;
  status: string;
  busy: boolean;
  error: Error | null;
  success: string;
  onPublish: () => void;
  onWithdraw?: () => void;
  onView?: () => void;
}) {
  const { colors } = useTheme();
  const s = useUIStyles();
  const scroll = useRef<ScrollView>(null);
  const [step, setStep] = useState<GoalStep>(0);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  useEffect(() => {
    if (error || success) scroll.current?.scrollToEnd({ animated: true });
  }, [error, success]);
  const def = careerRoles[role];
  const progress = careerGoalProgress(role, value);
  const set = (key: keyof GoalValues, next: string) =>
    onChange({ ...value, [key]: next });
  const setMobility = (next: string) =>
    onChange({
      ...value,
      mobility: next,
      mobilityRadiusKm: next === "À distance" ? value.mobilityRadiusKm : "",
      internationalCountries:
        next === "À l’international" ? value.internationalCountries : "",
    });
  const go = (next: GoalStep) => {
    Keyboard.dismiss();
    setStep(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const choose = (key: keyof GoalValues, label: string, options: string[]) => (
    <ChoiceField
      label={`${label} (facultatif)`}
      value={value[key]}
      options={choices(options)}
      optionalLabel="Pas de préférence"
      onChange={(next) => set(key, next)}
    />
  );
  const summary = progress.fields.filter(
    (field) =>
      field.key !== "objective" &&
      field.key !== "mobilityRadiusKm" &&
      value[field.key],
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        ref={scroll}
        style={styles.flex}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "web" ? "none" : "on-drag"}
        contentContainerStyle={styles.content}
      >
        <View style={styles.stepper}>
          {steps.map((label, index) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityLabel={`Étape ${index + 1} : ${label}`}
              accessibilityState={{ selected: step === index, disabled: busy }}
              disabled={busy}
              onPress={() => go(index as GoalStep)}
              style={styles.step}
            >
              <View
                style={[
                  styles.stepNumber,
                  {
                    backgroundColor:
                      index === step ? colors.deepBlue : colors.surfaceRaised,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.stepNumberText,
                    { color: index === step ? "#fff" : colors.muted },
                  ]}
                >
                  {index + 1}
                </Text>
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  { color: index === step ? colors.deepBlue : colors.muted },
                ]}
              >
                {label}
              </Text>
              <View
                style={[
                  styles.stepLine,
                  {
                    backgroundColor:
                      index === step ? colors.blue : colors.border,
                  },
                ]}
              />
            </Pressable>
          ))}
        </View>

        <View style={styles.heading}>
          <Text style={[styles.eyebrow, { color: colors.deepBlue }]}>
            {role} · ÉTAPE {step + 1}/3
          </Text>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.ink }]}
          >
            {titles[step]}
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            {hints[step]}
          </Text>
        </View>
        <View
          style={[
            styles.progressCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.progressLabel}>
            <Sparkles size={18} color={colors.deepBlue} />
            <Text style={[styles.progressText, { color: colors.ink }]}>
              {progress.completed === progress.total
                ? "Votre recherche est bien précisée !"
                : "Chaque détail facilite les bonnes rencontres"}
            </Text>
            <Text style={[styles.progressCount, { color: colors.deepBlue }]}>
              {progress.completed}/{progress.total}
            </Text>
          </View>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Renseignements complétés"
            accessibilityValue={{
              min: 0,
              max: progress.total,
              now: progress.completed,
            }}
            style={[
              styles.progressTrack,
              { backgroundColor: colors.surfaceRaised },
            ]}
          >
            <LinearGradient
              colors={gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                height: 6,
                borderRadius: 6,
                width: `${(progress.completed / progress.total) * 100}%`,
              }}
            />
          </View>
        </View>

        <View
          style={[
            styles.panel,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {step === 0 && (
            <>
              <OptionGroup
                label="Quel est votre objectif ?"
                value={value.objective}
                options={def.objectives}
                cards
                onChange={(next) => onChange(selectObjective(value, next))}
              />
              <Text style={[s.small, { color: colors.muted }]}>
                Seul l’objectif est obligatoire. Précisez la suite à votre
                rythme.
              </Text>
              {def.sport && (
                <>
                  {!def.genericLevels && (
                    <OptionGroup
                      label="Dans quel cadre ? (facultatif)"
                      value={value.environment}
                      options={["Professionnel", "Amateur"]}
                      onChange={(next) =>
                        onChange({ ...value, environment: next, level: "" })
                      }
                    />
                  )}
                  {choose(
                    "level",
                    "Niveau souhaité",
                    goalLevels(role, value.environment),
                  )}
                </>
              )}
              {!!goalFields(role).positions.length &&
                choose(
                  "position",
                  def.player ? "Mon poste" : "Fonction / domaine",
                  goalFields(role).positions,
                )}
              {!!goalFields(role).categories.length &&
                choose(
                  "category",
                  def.player ? "Catégorie recherchée" : "Catégorie encadrée",
                  goalFields(role).categories,
                )}
            </>
          )}
          {step === 1 && (
            <>
              <View style={styles.progressLabel}>
                <MapPin size={21} color={colors.blue} />
                <Text style={[s.h2, { flex: 1 }]}>
                  Votre terrain de recherche
                </Text>
              </View>
              <CareerZoneField value={value} onChange={onChange} />
              <OptionGroup
                label="Jusqu’où souhaitez-vous aller ? (facultatif)"
                value={value.mobility}
                options={[
                  "Près de chez moi",
                  "Dans ma région",
                  "Partout en France",
                  "À l’international",
                  "À distance",
                ]}
                onChange={setMobility}
              />
              {value.mobility === "À l’international" && (
                <View style={styles.internationalBox}>
                  <TextInput
                    accessibilityLabel="Rechercher un pays"
                    value={countrySearch}
                    onChangeText={setCountrySearch}
                    placeholder="Rechercher un pays"
                    placeholderTextColor={colors.muted}
                    style={[
                      styles.countrySearch,
                      {
                        color: colors.ink,
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}
                  />
                  <OptionGroup
                    label="Pays souhaités (facultatif)"
                    value={value.internationalCountries}
                    options={internationalCountries.filter((country) =>
                      country
                        .toLocaleLowerCase()
                        .includes(countrySearch.toLocaleLowerCase()),
                    )}
                    multiple
                    onChange={(next) => set("internationalCountries", next)}
                  />
                  <Text style={s.small}>
                    Sélectionnez un ou plusieurs pays pour recevoir des
                    opportunités internationales plus pertinentes.
                  </Text>
                </View>
              )}
              {value.mobility === "À distance" && (
                <View style={styles.distanceBox}>
                  <OptionGroup
                    label="Kilométrage maximum accepté (facultatif)"
                    value={value.mobilityRadiusKm}
                    options={distanceOptions}
                    onChange={(next) => set("mobilityRadiusKm", next)}
                  />
                  <Field
                    label="Autre distance en km"
                    value={value.mobilityRadiusKm}
                    placeholder="Ex. : 75"
                    keyboardType="number-pad"
                    onChangeText={(next) =>
                      set("mobilityRadiusKm", next.replace(/[^0-9]/g, ""))
                    }
                  />
                  <Text style={s.small}>
                    {role === "Entreprise / Marque"
                      ? "Cette zone aide les clubs et partenaires à vous proposer des collaborations adaptées à votre marque."
                      : "Cette distance sera visible dans votre demande pour aider les clubs, recruteurs et organisations à proposer des opportunités adaptées."}
                  </Text>
                </View>
              )}
              <OptionGroup
                label="Quand êtes-vous disponible ? (facultatif)"
                value={value.availability}
                options={[
                  "Dès maintenant",
                  "La saison prochaine",
                  "Les week-ends",
                  "Ponctuellement",
                  "À discuter",
                ]}
                onChange={(next) => set("availability", next)}
              />
              {def.paid && (
                <View style={[styles.extras, { borderColor: colors.border }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: extrasOpen }}
                    onPress={() => setExtrasOpen(!extrasOpen)}
                    style={styles.disclosure}
                  >
                    <View style={styles.flex}>
                      <Text style={[styles.optionText, { color: colors.ink }]}>
                        Rémunération et avantages
                      </Text>
                      <Text style={s.small}>
                        Facultatif ·{" "}
                        {value.salary || value.benefits
                          ? "Préférences renseignées"
                          : "Précisez ce qui compte pour vous"}
                      </Text>
                    </View>
                    <ChevronDown
                      size={20}
                      color={colors.muted}
                      style={{
                        transform: [{ rotate: extrasOpen ? "180deg" : "0deg" }],
                      }}
                    />
                  </Pressable>
                  {extrasOpen && (
                    <View style={styles.fieldGroup}>
                      <Field
                        label="Rémunération souhaitée (€/mois, facultatif)"
                        value={value.salary}
                        placeholder="Ex. : 1 500"
                        keyboardType="decimal-pad"
                        onChangeText={(next) =>
                          set("salary", next.replace(",", "."))
                        }
                      />
                      <OptionGroup
                        label="Avantages souhaités (facultatif)"
                        value={value.benefits}
                        options={Object.values(benefits)}
                        multiple
                        onChange={(next) => set("benefits", next)}
                      />
                    </View>
                  )}
                </View>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <LinearGradient
                colors={gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.previewHero}
              >
                <Text style={styles.previewEyebrow}>
                  APERÇU · VOTRE DEMANDE PUBLIQUE
                </Text>
                <Text style={styles.previewTitle}>
                  {value.objective || "Votre prochain objectif"}
                </Text>
                <Text style={styles.previewRole}>{role}</Text>
              </LinearGradient>
              <View style={styles.summary}>
                {summary.map(({ key, label }) => (
                  <View
                    key={key}
                    style={[
                      styles.summaryItem,
                      { backgroundColor: colors.surfaceRaised },
                    ]}
                  >
                    <Text style={s.small}>{label}</Text>
                    <Text style={[styles.optionText, { color: colors.ink }]}>
                      {key === "zone"
                        ? [value.zoneCity || value.zone, value.zoneDepartment]
                            .filter(Boolean)
                            .join(" · ")
                        : key === "mobility"
                          ? [
                              value.mobility,
                              value.mobilityRadiusKm &&
                                `${value.mobilityRadiusKm} km`,
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : value[key]}
                    </Text>
                  </View>
                ))}
              </View>
              {def.paid && !!value.salary && (
                <Text style={s.text}>
                  Rémunération souhaitée : {value.salary} €/mois
                </Text>
              )}
              {def.paid && !!value.benefits && (
                <Text style={s.text}>
                  Avantages souhaités : {value.benefits}
                </Text>
              )}
              <Field
                label="Un mot sur votre projet (facultatif)"
                value={value.description}
                multiline
                maxLength={3000}
                placeholder={projectExample(role)}
                onChangeText={(next) => set("description", next)}
              />
              <Text style={[s.small, { textAlign: "right" }]}>
                {value.description.length}/3 000
              </Text>
              {role === "Parent" && (
                <Text style={s.small}>
                  Ne publiez pas le nom, la date de naissance ou les coordonnées
                  de votre enfant.
                </Text>
              )}
              {!!progress.missing.length && (
                <View
                  style={[
                    styles.missing,
                    { backgroundColor: colors.accentSoft },
                  ]}
                >
                  <Text style={[styles.optionText, { color: colors.ink }]}>
                    Un peu plus de détails ?
                  </Text>
                  <Text style={s.small}>
                    Ces informations peuvent aider la communauté à vous proposer
                    un projet adapté.
                  </Text>
                  {progress.missing.map(({ key, label, step: target }) => (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityLabel={`Compléter : ${label}`}
                      onPress={() => go(target)}
                      style={styles.missingLink}
                    >
                      <Text style={{ color: colors.deepBlue, flex: 1 }}>
                        {label}
                        {key === "objective"
                          ? " · obligatoire"
                          : " · facultatif"}
                      </Text>
                      <ChevronRight size={18} color={colors.deepBlue} />
                    </Pressable>
                  ))}
                </View>
              )}
              <Text style={s.small}>
                Votre demande sera visible dans les opportunités après
                publication.
              </Text>
              {!!value.description.trim() && (
                <View style={[styles.extras, { borderColor: colors.border }]}>
                  <Text style={s.label}>Votre message dans l’annonce</Text>
                  <Text style={s.text}>{value.description.trim()}</Text>
                </View>
              )}
            </>
          )}
        </View>

        {!!error && <ErrorState error={error} />}
        {!!success && (
          <View
            accessibilityRole="alert"
            style={[styles.success, { backgroundColor: colors.accentSoft }]}
          >
            <Check size={24} color={colors.success} />
            <Text style={[s.text, styles.flex]}>{success}</Text>
          </View>
        )}
        {!!success && !!onView && (
          <Button title="Voir ma demande" onPress={onView} />
        )}
        {published && (
          <View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: manageOpen }}
              onPress={() => setManageOpen(!manageOpen)}
              style={styles.disclosure}
            >
              <Text style={[s.small, styles.flex]}>
                Gérer ma demande · {status}
              </Text>
              <ChevronDown size={18} color={colors.muted} />
            </Pressable>
            {manageOpen && (
              <View style={styles.fieldGroup}>
                {!!onView && (
                  <Button title="Voir ma demande" secondary onPress={onView} />
                )}
                {!!onWithdraw && (
                  <Button
                    title="Retirer ma demande"
                    secondary
                    disabled={busy}
                    onPress={onWithdraw}
                  />
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <View style={styles.footerInner}>
          {step > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retour à l’étape précédente"
              disabled={busy}
              onPress={() => go((step - 1) as GoalStep)}
              style={styles.back}
            >
              <ArrowLeft size={19} color={colors.ink} />
              <Text style={[styles.optionText, { color: colors.ink }]}>
                Retour
              </Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              step < 2
                ? "Continuer"
                : error
                  ? "Réessayer la publication"
                  : published
                    ? "Mettre à jour ma demande"
                    : "Publier ma demande"
            }
            accessibilityState={{
              disabled: busy || (step === 2 && !value.objective),
              busy,
            }}
            disabled={busy || (step === 2 && !value.objective)}
            onPress={() => {
              if (step < 2) go((step + 1) as GoalStep);
              else {
                Keyboard.dismiss();
                onPublish();
                scroll.current?.scrollToEnd({ animated: true });
              }
            }}
            style={({ pressed }) => [
              styles.primary,
              {
                opacity:
                  busy || (step === 2 && !value.objective)
                    ? 0.5
                    : pressed
                      ? 0.8
                      : 1,
              },
            ]}
          >
            <LinearGradient
              colors={gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryInner}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.primaryText}>
                    {step < 2
                      ? "Continuer"
                      : error
                        ? "Réessayer la publication"
                        : published
                          ? "Mettre à jour ma demande"
                          : "Publier ma demande"}
                  </Text>
                  {step < 2 ? (
                    <ArrowRight size={20} color="#fff" />
                  ) : (
                    <Send size={19} color="#fff" />
                  )}
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    padding: 20,
    gap: 24,
    paddingBottom: 32,
  },
  stepper: { flexDirection: "row", gap: 10 },
  step: { flex: 1, alignItems: "center", gap: 8, minHeight: 70 },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: { fontSize: 14, fontWeight: "700" },
  stepLabel: { fontSize: 12, fontWeight: "600", textAlign: "center" },
  stepLine: { width: "100%", height: 3, borderRadius: 3, marginTop: "auto" },
  heading: { gap: 10 },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  title: { fontSize: 29, fontWeight: "800", letterSpacing: -0.8 },
  subtitle: { fontSize: 15, lineHeight: 23 },
  progressCard: { padding: 16, gap: 12, borderWidth: 1, borderRadius: 18 },
  progressLabel: { flexDirection: "row", alignItems: "center", gap: 9 },
  progressText: { fontSize: 12, lineHeight: 18, flex: 1, fontWeight: "600" },
  progressCount: { fontSize: 13, fontWeight: "800" },
  progressTrack: { height: 6, borderRadius: 6, overflow: "hidden" },
  panel: { borderWidth: 1, borderRadius: 24, padding: 20, gap: 24 },
  fieldGroup: { gap: 14 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  option: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 12,
    minHeight: 48,
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  optionCard: { flexGrow: 1, flexBasis: 230, minHeight: 72 },
  optionCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  optionText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    flexShrink: 1,
  },
  extras: { borderTopWidth: 1, paddingTop: 14, gap: 16 },
  distanceBox: { gap: 14, marginTop: -4 },
  internationalBox: { gap: 12, marginTop: -4 },
  countrySearch: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  disclosure: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  previewHero: { borderRadius: 20, padding: 22, gap: 12 },
  previewEyebrow: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  previewTitle: { color: "#fff", fontSize: 27, fontWeight: "800" },
  previewRole: { color: "#fff", fontSize: 14, fontWeight: "600" },
  summary: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryItem: {
    flexBasis: 200,
    flexGrow: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  missing: { padding: 16, borderRadius: 18, gap: 10 },
  missingLink: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  success: {
    padding: 18,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  footer: { borderTopWidth: 1, padding: 12 },
  footerInner: {
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 52,
    paddingHorizontal: 6,
  },
  primary: { flex: 1, borderRadius: 16, overflow: "hidden" },
  primaryInner: {
    minHeight: 54,
    padding: 14,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    flexShrink: 1,
  },
});
