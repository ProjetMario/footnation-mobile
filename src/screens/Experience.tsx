import React, { useEffect, useRef, useState } from "react";
import { Modal, Text, View } from "react-native";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthGate } from "../components/AuthGate";
import {
  Button,
  Empty,
  ErrorState,
  Field,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { ChoiceField } from "../components/ChoiceField";
import { ProfileAutocompleteField } from "../components/ProfileAutocompleteField";
import { ExperienceClubSearch } from "../components/ExperienceClubSearch";
import {
  editExperienceClubName,
  experienceClubPath,
  selectExperienceClub,
} from "../lib/experienceClub";
import {
  buildExperienceAttempt,
  editableExperience,
  experienceCapability,
  experienceSaveError,
  saveExperienceAttempt,
  stageExperienceAttempt,
  type CareerExperience,
  type ExperienceAttempt,
  type ExperienceSnapshot,
} from "../lib/experienceSave";
import { experienceRepository } from "../lib/experienceRepository";
import { experienceJournal } from "../lib/experienceSaveStorage";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { ages, levels, positions, choices } from "../lib/careerOptions";

const blank: CareerExperience = {
  club: "",
  ageCategory: "",
  level: "",
  position: "",
  startYear: "",
  endYear: "",
};
export default function ExperienceScreen() {
  return (
    <Screen title="Mon parcours">
      <AuthGate>
        <ExperienceContent />
      </AuthGate>
    </Screen>
  );
}
export function ExperienceContent() {
  const { session } = useAuth();
  const uid = session!.user.id;
  const query = useQuery({
    queryKey: ["native-experience", uid],
    queryFn: async () => {
      const [profile, capability, attempt] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,experience_history")
          .eq("id", uid)
          .maybeSingle(),
        supabase.rpc("native_experience_sync_available"),
        experienceJournal.read(uid),
      ]);
      if (profile.error) throw profile.error;
      let synced = false;
      try {
        synced = experienceCapability(capability.error, capability.data);
      } catch {
        synced = false;
      }
      return {
        profile: {
          id: profile.data?.id ?? uid,
          experience_history: profile.data?.experience_history ?? null,
          updated_at: null,
        } as ExperienceSnapshot,
        synced,
        attempt,
      };
    },
  });
  return query.isPending ? (
    <Loading />
  ) : query.error ? (
    <ErrorState error={query.error} retry={() => void query.refetch()} />
  ) : (
    <Editor key={uid} {...query.data} />
  );
}
function Editor({
  profile,
  synced,
  attempt: initialAttempt,
}: {
  profile: ExperienceSnapshot;
  synced: boolean;
  attempt: ExperienceAttempt | null;
}) {
  const s = useUIStyles();
  const cache = useQueryClient();
  const { session } = useAuth();
  const currentUid = useRef(session?.user.id);
  currentUid.current = session?.user.id;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const assertCurrentAccount = () => {
    if (!mounted.current || currentUid.current !== profile.id)
      throw new Error(
        "Votre session a changé. Retrouvez le compte de ce parcours.",
      );
  };
  const [baseline, setBaseline] = useState(profile);
  const history = Array.isArray(baseline.experience_history)
    ? baseline.experience_history
    : [];
  const [editing, setEditing] = useState<number | null>(null);
  const [entry, setEntry] = useState<CareerExperience>({ ...blank });
  const [open, setOpen] = useState(false);
  const [clubConfirmed, setClubConfirmed] = useState(false);
  const [clubSearchOpen, setClubSearchOpen] = useState(false);
  const [remove, setRemove] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(initialAttempt);
  const attemptRef = useRef(initialAttempt);
  const actionLock = useRef(false);
  const [localError, setLocalError] = useState<Error | null>(null);
  const [reloading, setReloading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [showAttempt, setShowAttempt] = useState(false);
  const invalidate = () => {
    for (const key of [
      ["native-experience", profile.id],
      ["native-cv", profile.id],
      ["profile", profile.id],
      ["club-experience-members"],
    ])
      void cache.invalidateQueries({ queryKey: key });
  };
  const save = useMutation({
    mutationFn: async (proposal: ExperienceAttempt) => {
      try {
        assertCurrentAccount();
        const repository = await experienceRepository(
          profile.id,
          assertCurrentAccount,
        );
        const result = await saveExperienceAttempt(proposal, repository);
        assertCurrentAccount();
        await experienceJournal.clear(proposal);
        assertCurrentAccount();
        return result;
      } catch (error) {
        throw experienceSaveError(error);
      }
    },
    onSuccess: (result) => {
      if (!mounted.current || currentUid.current !== profile.id) return;
      setBaseline(result);
      setOpen(false);
      setRemove(null);
      setAttempt(null);
      attemptRef.current = null;
      setLocalError(null);
      invalidate();
    },
    onSettled: () => {
      actionLock.current = false;
    },
  });
  const submit = async (deleting: number | null) => {
    if (actionLock.current || reloading) return;
    actionLock.current = true;
    setPreparing(true);
    setLocalError(null);
    try {
      assertCurrentAccount();
      const proposal =
        attemptRef.current ??
        buildExperienceAttempt({
          snapshot: baseline,
          mode: synced ? "synced" : "profile-only",
          randomId: randomUUID,
          action:
            deleting !== null
              ? { type: "remove", index: deleting }
              : { type: "save", index: editing, entry, clubConfirmed },
        });
      await stageExperienceAttempt(
        proposal,
        experienceJournal.save,
        assertCurrentAccount,
      );
      attemptRef.current = proposal;
      setAttempt(proposal);
      save.mutate(proposal);
    } catch (error) {
      actionLock.current = false;
      if (mounted.current && currentUid.current === profile.id)
        setLocalError(experienceSaveError(error));
    } finally {
      if (mounted.current) setPreparing(false);
    }
  };
  const reload = async () => {
    if (actionLock.current) return;
    actionLock.current = true;
    setReloading(true);
    setLocalError(null);
    try {
      const repository = await experienceRepository(
        profile.id,
        assertCurrentAccount,
      );
      const result = await repository.read();
      await repository.assertIdentity();
      if (attemptRef.current) await experienceJournal.clear(attemptRef.current);
      assertCurrentAccount();
      setBaseline(result);
      setOpen(false);
      setRemove(null);
      setAttempt(null);
      attemptRef.current = null;
      save.reset();
      invalidate();
    } catch (error) {
      if (mounted.current && currentUid.current === profile.id)
        setLocalError(experienceSaveError(error));
    } finally {
      actionLock.current = false;
      if (mounted.current) setReloading(false);
    }
  };
  const locked = !!attempt || save.isPending || reloading || preparing;
  return (
    <>
      <Text style={s.small}>
        {synced
          ? "Une fiche de club sélectionnée et une année de début permettent d’y présenter cette expérience. Cela n’accorde aucun rôle ni place dans une équipe."
          : "La synchronisation avec les fiches des clubs n’est pas encore active. Vos expériences restent enregistrées dans votre profil."}
      </Text>
      {!!(localError || save.error) && (
        <ErrorState
          error={localError || save.error}
          retry={() => {
            if (attemptRef.current) submit(null);
            else setLocalError(null);
          }}
        />
      )}
      {!!attempt && (
        <View style={s.card}>
          <Text style={s.h2}>Enregistrement à vérifier</Text>
          <Text style={s.text}>
            La tentative complète est conservée sur cet appareil. Réessayer
            vérifie d’abord si elle a déjà été enregistrée. Recharger affiche le
            parcours actuel et abandonne seulement cette tentative locale.
          </Text>
          <Button
            title={
              showAttempt
                ? "Masquer le parcours proposé"
                : "Voir le parcours proposé"
            }
            secondary
            onPress={() => setShowAttempt((value) => !value)}
          />
          {!!showAttempt && (
            <View>
              {!attempt.history.length && (
                <Text style={s.text}>
                  Le parcours proposé ne contient plus d’expérience.
                </Text>
              )}
              {attempt.history.map((value, index) => {
                const item = editableExperience(value);
                return (
                  <Text key={index} style={s.text}>
                    {item
                      ? `${item.club} · ${item.position} · ${item.level} · ${item.ageCategory} · ${item.startYear || "Début non renseigné"} – ${item.endYear || "Aujourd’hui"}`
                      : JSON.stringify(value)}
                  </Text>
                );
              })}
            </View>
          )}
          <Button
            title="Reprendre cette tentative"
            busy={save.isPending}
            disabled={reloading}
            onPress={() => submit(null)}
          />
          <Button
            title="Recharger le parcours actuel"
            secondary
            busy={reloading}
            disabled={save.isPending}
            onPress={() => void reload()}
          />
        </View>
      )}
      {open ? (
        <>
          <ProfileAutocompleteField
            kind="club"
            label="Club"
            value={entry.club}
            disabled={locked}
            onChange={(club) => {
              setEntry((previous) => editExperienceClubName(previous, club));
              setClubConfirmed(false);
            }}
            onSelect={(club) => {
              setEntry((previous) => selectExperienceClub(previous, club));
              setClubConfirmed(true);
            }}
          />
          <Button
            title="Rechercher un club dans l’annuaire"
            secondary
            disabled={locked}
            onPress={() => setClubSearchOpen(true)}
          />
          {!!entry.club_id && (
            <>
              <Text style={s.small}>
                {synced && !entry.native_experience_id && !clubConfirmed
                  ? "Ancien lien conservé. Resélectionnez cette fiche dans l’annuaire pour confirmer sa synchronisation."
                  : "La fiche sélectionnée sera liée à cette expérience. Une année de début est nécessaire pour la synchronisation."}
              </Text>
              <Button
                title="Conserver le nom sans lien de club"
                secondary
                disabled={locked}
                onPress={() => {
                  setEntry((previous) => ({ ...previous, club_id: undefined }));
                  setClubConfirmed(false);
                }}
              />
            </>
          )}
          <Modal
            visible={clubSearchOpen}
            animationType="slide"
            onRequestClose={() => setClubSearchOpen(false)}
          >
            {clubSearchOpen ? (
              <ExperienceClubSearch
                initialName={entry.club}
                onClose={() => setClubSearchOpen(false)}
                onSelect={(club) => {
                  if (
                    !locked &&
                    mounted.current &&
                    currentUid.current === profile.id
                  ) {
                    setEntry((previous) =>
                      selectExperienceClub(previous, club),
                    );
                    setClubConfirmed(true);
                  }
                  setClubSearchOpen(false);
                }}
              />
            ) : null}
          </Modal>
          {(
            [
              ["ageCategory", "Catégorie d’âge", ages],
              ["level", "Niveau", levels],
              ["position", "Poste", positions],
            ] as const
          ).map(([key, label, options]) => (
            <ChoiceField
              key={key}
              label={label}
              value={entry[key]}
              options={choices([...options])}
              optional={false}
              disabled={locked}
              onChange={(value) => {
                if (!locked)
                  setEntry((previous) => ({ ...previous, [key]: value }));
              }}
            />
          ))}
          <Field
            label="Année de début"
            keyboardType="number-pad"
            maxLength={4}
            value={entry.startYear}
            editable={!locked}
            onChangeText={(startYear) =>
              setEntry((previous) => ({ ...previous, startYear }))
            }
          />
          <Field
            label="Année de fin (vide si en cours)"
            keyboardType="number-pad"
            maxLength={4}
            value={entry.endYear}
            editable={!locked}
            onChangeText={(endYear) =>
              setEntry((previous) => ({ ...previous, endYear }))
            }
          />
          <Button
            title="Enregistrer"
            busy={save.isPending}
            disabled={locked}
            onPress={() => submit(null)}
          />
          <Button
            title="Annuler"
            secondary
            disabled={locked}
            onPress={() => {
              setOpen(false);
              setLocalError(null);
            }}
          />
        </>
      ) : (
        <>
          <Button
            title="Ajouter une expérience"
            disabled={locked}
            onPress={() => {
              setEditing(null);
              setEntry({ ...blank });
              setClubConfirmed(false);
              setRemove(null);
              setOpen(true);
            }}
          />
          {baseline.experience_history != null &&
          !Array.isArray(baseline.experience_history) ? (
            <View style={s.card}>
              <Text style={s.h2}>Ancien parcours à vérifier</Text>
              <Text style={s.text}>
                {JSON.stringify(baseline.experience_history)}
              </Text>
              <Text style={s.small}>
                Ce format ancien a été conservé. Il doit être vérifié avant de
                pouvoir modifier le parcours.
              </Text>
            </View>
          ) : !history.length ? (
            <Empty title="Racontez votre parcours" />
          ) : null}
          {history.map((value, index) => {
            const item = editableExperience(value);
            return (
              <View key={item?.native_experience_id || index} style={s.card}>
                {item ? (
                  <>
                    <Text style={s.h2}>{item.club}</Text>
                    {!!experienceClubPath(item) && (
                      <Button
                        title="Voir la fiche du club"
                        secondary
                        onPress={() => {
                          const path = experienceClubPath(item);
                          if (path) router.push(path);
                        }}
                      />
                    )}
                    <Text style={s.text}>
                      {item.position} · {item.level}
                    </Text>
                    <Text style={s.subtitle}>
                      {item.ageCategory} ·{" "}
                      {item.startYear || "Début non renseigné"} –{" "}
                      {item.endYear || "Aujourd’hui"}
                    </Text>
                    <Button
                      title="Modifier"
                      secondary
                      disabled={locked}
                      onPress={() => {
                        setEditing(index);
                        setEntry({ ...item });
                        setClubConfirmed(false);
                        setRemove(null);
                        setOpen(true);
                      }}
                    />
                  </>
                ) : (
                  <>
                    <Text style={s.h2}>Ancienne expérience</Text>
                    <Text style={s.text}>{JSON.stringify(value)}</Text>
                    <Text style={s.small}>
                      Son contenu d’origine est conservé. Cette entrée ne peut
                      pas être modifiée avec ce formulaire.
                    </Text>
                  </>
                )}
                {remove === index ? (
                  <>
                    <Text style={s.text}>
                      Supprimer cette expérience du parcours ?
                    </Text>
                    {!item?.native_experience_id && (
                      <Text style={s.small}>
                        Les anciennes lignes enregistrées séparément sur une
                        fiche de club sont conservées, car leur origine ne peut
                        pas être vérifiée.
                      </Text>
                    )}
                    <Button
                      title="Confirmer"
                      busy={save.isPending}
                      disabled={locked}
                      onPress={() => submit(index)}
                    />
                    <Button
                      title="Annuler"
                      secondary
                      disabled={locked}
                      onPress={() => setRemove(null)}
                    />
                  </>
                ) : (
                  <Button
                    title="Supprimer"
                    secondary
                    disabled={locked}
                    onPress={() => setRemove(index)}
                  />
                )}
              </View>
            );
          })}
          {!attempt && (
            <Button
              title="Actualiser le parcours"
              secondary
              busy={reloading}
              disabled={save.isPending}
              onPress={() => void reload()}
            />
          )}
        </>
      )}
    </>
  );
}
