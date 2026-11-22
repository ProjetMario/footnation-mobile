import { SafeAreaModal as Modal } from "../components/SafeAreaModal";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import { randomUUID } from "expo-crypto";
import type { ImagePickerAsset } from "expo-image-picker";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Images,
  MapPin,
  Music2,
  Play,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  X,
} from "lucide-react-native";
import { useAuth } from "../lib/auth";
import { AuthGate } from "../components/AuthGate";
import { ProfileAutocompleteField } from "../components/ProfileAutocompleteField";
import { CreationMediaPicker } from "../components/creation/CreationMediaPicker";
import { CreationEditor } from "../components/creation/CreationEditor";
import {
  CreationPreview,
  CreationTimeline,
} from "../components/creation/CreationPreview";
import {
  StudioButton,
  StudioChip,
  StudioField,
  StudioNumber,
  studioColors as c,
  p,
} from "../components/creation/CreationPrimitives";
import {
  creationDuration,
  CREATION_LIMITS,
  needsCreationRender,
  newCreationProject,
  reviseCreation,
  sourceClip,
  validateCreationProject,
  type CreationJob,
  type CreationJobKind,
  type CreationMode,
  type CreationProject,
} from "../lib/creationProject";
import {
  createCreationApi,
  type CreationCapabilities,
} from "../lib/creationApi";
import {
  creationMediaPreview,
  listCreationProjects,
  loadCreationAttempt,
  loadCreationJob,
  loadCreationProject,
  persistPickedCreationMedia,
  removeCreationProject,
  saveCreationJob,
  saveCreationProject,
} from "../lib/creationStorage";
import {
  publishCreationProject,
  creationPublicationErrorMessage as errorMessage,
  creationPublicationNeedsProfile,
} from "../lib/creationPublication";
import { displayName } from "../lib/models";
import {
  notifyNetworkNewContent,
  notifyPublicationPublished,
} from "../lib/notificationEvents";
import { ShortMusicPicker } from "../components/ShortMusicPicker";

const modeLabels: Record<CreationMode, string> = {
  post: "Publication",
  story: "Story",
  short: "Réel / Short",
};
const emptyCapabilities: CreationCapabilities = {
  available: false,
  music: [],
  transcription: false,
};
const legacyPaths = {
  post: "/compose/text",
  story: "/stories/legacy",
  short: "/shorts/legacy",
} as const;
type Busy = "import" | "save" | "sync" | "publish" | null;
type Preview = { uri: string; revision: number; release(): void };
const normalTag = (value: string) =>
  value
    .replace(/^#+/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .slice(0, 32);
function parseTags(value: string) {
  return [
    ...new Map(
      value
        .split(/[\s,]+/)
        .map(normalTag)
        .filter(Boolean)
        .map((tag) => [tag.toLowerCase(), tag]),
    ).values(),
  ];
}
function hashtagSuggestions(project: CreationProject) {
  const existing = new Set(
    parseTags(project.hashtags).map((tag) => tag.toLowerCase()),
  );
  const result: string[] = [];
  const add = (value: string) => {
    const tag = normalTag(value);
    if (tag && !existing.has(tag.toLowerCase())) {
      existing.add(tag.toLowerCase());
      result.push(tag);
    }
  };
  project.location.split(/[·,\-]/).forEach(add);
  const caption = project.caption
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  for (const [expression, tag] of [
    [/\b(but|goal|frappe|lucarne)\b/, "but"],
    [/\b(match|victoire|tournoi|championnat)\b/, "match"],
    [/\b(entrainement|training|seance|exercice)\b/, "entrainement"],
    [/\b(club|equipe|terrain|stade)\b/, "club"],
  ] as const)
    if (expression.test(caption)) add(tag);
  for (const word of project.caption.match(/[\p{L}\p{N}]{4,}/gu) || [])
    if (
      ![
        "avec",
        "dans",
        "pour",
        "cette",
        "notre",
        "votre",
        "plus",
        "tout",
        "tous",
      ].includes(word.toLowerCase())
    )
      add(word);
  [
    "football",
    project.mode === "post" ? "amateur" : project.mode,
    "amateur",
  ].forEach(add);
  return result.slice(0, 8);
}

export default function CreationStudio({
  defaultMode = "post",
}: {
  defaultMode?: CreationMode;
}) {
  const { session } = useAuth();
  const account = useRef(session?.user.id);
  account.current = session?.user.id;
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />
      <AuthGate>
        <>
          {!!session && (
            <StudioContent
              key={session.user.id}
              ownerId={session.user.id}
              defaultMode={defaultMode}
              isCurrentAccount={() => account.current === session.user.id}
            />
          )}
        </>
      </AuthGate>
    </SafeAreaView>
  );
}

function StudioContent({
  ownerId,
  defaultMode,
  isCurrentAccount,
}: {
  ownerId: string;
  defaultMode: CreationMode;
  isCurrentAccount(): boolean;
}) {
  const { profile, profileStatus } = useAuth();
  const cache = useQueryClient();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ draft?: string }>();
  const [project, setProject] = useState(() =>
    newCreationProject(ownerId, randomUUID(), defaultMode),
  );
  const current = useRef(project);
  current.current = project;
  const mounted = useRef(true);
  const accountGuard = useRef(isCurrentAccount);
  accountGuard.current = isCurrentAccount;
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [clipIndex, setClipIndex] = useState(0);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [uris, setUris] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Busy>(null);
  const operation = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const [capabilities, setCapabilities] =
    useState<CreationCapabilities>(emptyCapabilities);
  const [capabilitiesLoaded, setCapabilitiesLoaded] = useState(false);
  const [job, setJob] = useState<CreationJob | null>(null);
  const [jobError, setJobError] = useState("");
  const [renderJob, setRenderJob] = useState<CreationJob | null>(null);
  const [progress, setProgress] = useState({ stage: "", value: 0 });
  const [preview, setPreview] = useState<Preview | null>(null);
  const previewRef = useRef<Preview | null>(null);
  const [drafts, setDrafts] = useState<CreationProject[]>([]);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [profileTagQuery, setProfileTagQuery] = useState("");
  const [clubTagQuery, setClubTagQuery] = useState("");
  const [pendingPublication, setPendingPublication] = useState(false);
  const [authorProfileMissing, setAuthorProfileMissing] = useState(false);
  const needsProfile = profileStatus === "missing" || authorProfileMissing;
  const [published, setPublished] = useState<{
    id: string;
    mode: CreationMode;
  } | null>(null);
  const leaving = useRef(false);
  const lastHandledJob = useRef("");
  const autosave = useRef<Promise<void>>(Promise.resolve());
  const activeJob = job?.status === "queued" || job?.status === "running";
  const locked = !!busy || !!activeJob || pendingPublication || !!published;
  const canAct = !!project.sources.length && !locked;
  const rendered =
    renderJob?.status === "succeeded" &&
    renderJob.projectId === project.id &&
    renderJob.revision === project.revision;
  const needsRender = needsCreationRender(project);
  const previewUri =
    preview?.revision === project.revision ? preview.uri : null;
  const progressPercent = Math.round(
    Math.min(
      100,
      Math.max(0, busy ? progress.value * 100 : job?.progress || 0),
    ),
  );
  const guard = useCallback(() => {
    if (!mounted.current || !accountGuard.current())
      throw new Error(
        "Votre session a changé. Revenez au compte de ce brouillon.",
      );
  }, []);
  const safe = () => mounted.current && accountGuard.current();

  useFocusEffect(
    useCallback(() => {
      leaving.current = false;
    }, []),
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      previewRef.current?.release();
    };
  }, []);
  useEffect(() => {
    let stopped = false;
    void createCreationApi(ownerId, guard)
      .then((api) => api.capabilities())
      .then((result) => {
        if (!stopped && safe()) setCapabilities(result);
      })
      .catch(() => {
        if (!stopped && safe()) setCapabilities(emptyCapabilities);
      })
      .finally(() => {
        if (!stopped && safe()) setCapabilitiesLoaded(true);
      });
    return () => {
      stopped = true;
    };
  }, [ownerId, guard]);

  const sourceKey = project.sources
    .map((source) => `${source.id}:${source.path || ""}`)
    .join("|");
  useEffect(() => {
    let stopped = false;
    const releases: (() => void)[] = [];
    setUris({});
    for (const source of project.sources)
      void creationMediaPreview(ownerId, project.id, source)
        .catch(async () =>
          (await createCreationApi(ownerId, guard)).sourcePreview(
            project.id,
            source,
          ),
        )
        .then((result) => {
          if (stopped || !safe()) {
            result.release();
            return;
          }
          releases.push(result.release);
          setUris((previous) => ({ ...previous, [source.id]: result.uri }));
        })
        .catch((reason) => {
          if (!stopped && safe()) setError(errorMessage(reason));
        });
    return () => {
      stopped = true;
      releases.forEach((release) => release());
    };
  }, [ownerId, project.id, sourceKey, guard]);

  useEffect(() => {
    if (!project.sources.length || pendingPublication || published) return;
    const snapshot = project;
    setSaveState("saving");
    const timer = setTimeout(() => {
      autosave.current = autosave.current
        .catch(() => {})
        .then(async () => {
          guard();
          await saveCreationProject(snapshot);
          guard();
          if (
            current.current.id === snapshot.id &&
            current.current.revision === snapshot.revision
          )
            setSaveState("saved");
        })
        .catch((reason) => {
          if (
            safe() &&
            current.current.id === snapshot.id &&
            current.current.revision === snapshot.revision
          ) {
            setSaveState("error");
            setError(errorMessage(reason));
          }
        });
    }, 450);
    return () => clearTimeout(timer);
  }, [project, pendingPublication, published, guard]);

  const askClose = useCallback(() => {
    if (operation.current) return;
    if (!current.current.sources.length) {
      leaving.current = true;
      if (router.canGoBack()) router.back();
      else router.replace("/shorts");
      return;
    }
    setCloseOpen(true);
  }, []);
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (leaving.current || !current.current.sources.length) return;
      event.preventDefault();
      setCloseOpen(true);
    });
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      askClose();
      return true;
    });
    return () => {
      unsubscribe();
      back.remove();
    };
  }, [navigation, askClose]);

  const update = (next: CreationProject) => {
    if (locked) return;
    const shortest = Math.min(...next.clips.map((clip) => clip.duration));
    const adjusted = {
      ...next,
      transition: Number.isFinite(shortest)
        ? Math.min(next.transition, Math.max(0, shortest / 2 - 0.01))
        : next.transition,
    };
    const seconds = creationDuration(adjusted);
    const limitTiming = <T extends { start: number; end: number }>(
      item: T,
    ): T => {
      const start = Math.max(0, Math.min(item.start, seconds - 0.1));
      return {
        ...item,
        start,
        end: Math.min(seconds, Math.max(start + 0.1, item.end)),
      };
    };
    const normalized =
      seconds > 0
        ? {
            ...adjusted,
            coverTime: Math.min(
              adjusted.coverTime,
              Math.max(0, seconds - 0.05),
            ),
            texts: adjusted.texts.map(limitTiming),
            captions: adjusted.captions.map(limitTiming),
          }
        : adjusted;
    setProject(normalized);
    current.current = normalized;
    setError("");
    setNotice("");
  };
  const patch = (value: Partial<CreationProject>) =>
    update(reviseCreation(project, value));
  const startBusy = (kind: Busy) => {
    if (operation.current) return false;
    operation.current = true;
    setBusy(kind);
    setProgress({ stage: "", value: 0 });
    setError("");
    setNotice("");
    return true;
  };
  const finishBusy = () => {
    operation.current = false;
    if (safe()) setBusy(null);
  };
  const reportProgress = (stage: string, value: number) => {
    if (safe()) setProgress({ stage, value });
  };

  async function flushDraft() {
    await autosave.current.catch(() => {});
    guard();
    if (current.current.sources.length) {
      await saveCreationProject(current.current);
      guard();
      setSaveState("saved");
    }
  }
  async function completeProfile() {
    if (!startBusy("save")) return;
    try {
      // Keep both the local media and the immutable publication attempt. The
      // return route reopens this exact draft after explicit profile completion.
      await flushDraft();
      const snapshot = current.current;
      const path =
        snapshot.mode === "post"
          ? "/compose"
          : `/${snapshot.mode === "short" ? "shorts" : "stories"}/create`;
      leaving.current = true;
      router.replace({
        pathname: "/onboarding",
        params: { next: `${path}?draft=${snapshot.id}` },
      });
    } catch (reason) {
      if (safe()) setError(errorMessage(reason));
    } finally {
      finishBusy();
    }
  }
  async function openLegacy(path: (typeof legacyPaths)[CreationMode]) {
    if (!startBusy("save")) return;
    try {
      await flushDraft();
      setDraftsOpen(false);
      leaving.current = true;
      router.push(path);
    } catch (reason) {
      if (safe()) setError(errorMessage(reason));
    } finally {
      finishBusy();
    }
  }

  async function restoreDraft(draft: CreationProject) {
    if (!startBusy("save")) return;
    try {
      await flushDraft();
      const local = await loadCreationProject(ownerId, draft.id);
      const chosen = local && local.revision >= draft.revision ? local : draft;
      const attempt = await loadCreationAttempt(ownerId, draft.id);
      guard();
      const restored = attempt?.project || chosen;
      setProject(restored);
      current.current = restored;
      setPendingPublication(!!attempt && !attempt.completed);
      setStep(attempt ? 2 : 0);
      setSourceIndex(0);
      setClipIndex(0);
      setJob(null);
      setRenderJob(null);
      setJobError("");
      previewRef.current?.release();
      previewRef.current = null;
      setPreview(null);
      setDraftsOpen(false);
      setError("");
      if (attempt?.completed)
        setPublished({ id: attempt.project.id, mode: attempt.project.mode });
      const retainedJob = await loadCreationJob(ownerId, restored.id);
      guard();
      if (
        retainedJob &&
        retainedJob.revision === restored.revision &&
        !attempt
      ) {
        const fresh = await (
          await createCreationApi(ownerId, guard)
        ).job(retainedJob.id);
        guard();
        if (
          current.current.id === restored.id &&
          current.current.revision === restored.revision
        ) {
          lastHandledJob.current = "";
          setJob(fresh);
          setStep(1);
        }
      }
    } catch (reason) {
      if (safe()) setError(errorMessage(reason));
    } finally {
      finishBusy();
    }
  }
  useEffect(() => {
    if (!params.draft || Array.isArray(params.draft)) return;
    let stopped = false;
    void loadCreationProject(ownerId, params.draft)
      .then(
        async (local) =>
          local ||
          (await createCreationApi(ownerId, guard)).load(params.draft!),
      )
      .then((draft) => {
        if (!stopped && safe()) void restoreDraft(draft);
      })
      .catch((reason) => {
        if (!stopped && safe()) setError(errorMessage(reason));
      });
    return () => {
      stopped = true;
    };
  }, [params.draft, ownerId]);

  async function openDrafts() {
    setDraftsOpen(true);
    setLoadingDrafts(true);
    setError("");
    try {
      await flushDraft();
      const local = await listCreationProjects(ownerId);
      guard();
      setDrafts(local);
      if (capabilities.available) {
        const remote = await (await createCreationApi(ownerId, guard)).list();
        guard();
        const combined = new Map(local.map((draft) => [draft.id, draft]));
        for (const draft of remote)
          if (
            !combined.has(draft.id) ||
            combined.get(draft.id)!.revision < draft.revision
          )
            combined.set(draft.id, draft);
        setDrafts(
          [...combined.values()].sort((a, b) =>
            b.updatedAt.localeCompare(a.updatedAt),
          ),
        );
      }
    } catch (reason) {
      if (safe()) setError(errorMessage(reason));
    } finally {
      if (safe()) setLoadingDrafts(false);
    }
  }
  async function addAssets(assets: ImagePickerAsset[]) {
    if (locked || !assets.length || !startBusy("import")) return;
    const snapshot = current.current;
    try {
      if (snapshot.sources.length + assets.length > CREATION_LIMITS.sources)
        throw new Error("Choisis au maximum 10 photos ou vidéos.");
      const sources = [];
      for (const asset of assets) {
        guard();
        sources.push(
          await persistPickedCreationMedia(ownerId, snapshot.id, asset),
        );
      }
      guard();
      const next = reviseCreation(snapshot, {
        sources: [...snapshot.sources, ...sources],
        clips: [
          ...snapshot.clips,
          ...sources.map((source) => sourceClip(source, randomUUID())),
        ],
      });
      await saveCreationProject(next);
      guard();
      setProject(next);
      current.current = next;
      setSourceIndex(snapshot.sources.length);
      setNotice(
        `${sources.length} média${sources.length > 1 ? "s" : ""} ajouté${sources.length > 1 ? "s" : ""}`,
      );
    } catch (reason) {
      if (safe()) setError(errorMessage(reason));
    } finally {
      finishBusy();
    }
  }
  async function saveDraft(sync: boolean, close = false) {
    if (!startBusy("save")) return;
    try {
      await autosave.current.catch(() => {});
      guard();
      let snapshot = current.current;
      await saveCreationProject(snapshot);
      guard();
      setSaveState("saved");
      if (sync && capabilities.available && !pendingPublication && !activeJob) {
        snapshot = await (
          await createCreationApi(ownerId, guard)
        ).sync(snapshot, reportProgress);
        guard();
        await saveCreationProject(snapshot);
        guard();
        setProject(snapshot);
        current.current = snapshot;
      }
      setNotice(
        sync && capabilities.available
          ? "Brouillon enregistré et synchronisé."
          : "Brouillon enregistré sur cet appareil.",
      );
      if (close) {
        leaving.current = true;
        setCloseOpen(false);
        if (router.canGoBack()) router.back();
        else router.replace("/shorts");
      }
    } catch (reason) {
      if (safe()) setError(errorMessage(reason));
    } finally {
      finishBusy();
    }
  }
  async function startJob(kind: CreationJobKind) {
    if (locked || !startBusy("sync")) return;
    const snapshot = current.current;
    try {
      const invalid = validateCreationProject(snapshot);
      if (invalid) throw new Error(invalid);
      await autosave.current.catch(() => {});
      guard();
      await saveCreationProject(snapshot);
      guard();
      setProgress({ stage: "Transfert", value: 0 });
      setJobError("");
      const api = await createCreationApi(ownerId, guard);
      const synced = await api.sync(snapshot, reportProgress);
      guard();
      if (
        current.current.id !== snapshot.id ||
        current.current.revision !== snapshot.revision
      )
        return;
      await saveCreationProject(synced);
      guard();
      setProject(synced);
      current.current = synced;
      const nextJob = await api.createJob(synced, kind);
      guard();
      setJob(nextJob);
      await saveCreationJob(ownerId, nextJob);
      guard();
    } catch (reason) {
      if (safe()) setError(errorMessage(reason));
    } finally {
      finishBusy();
    }
  }
  useEffect(() => {
    if (!job || !activeJob || jobError) return;
    let stopped = false;
    const timer = setTimeout(() => {
      void createCreationApi(ownerId, guard)
        .then((api) => api.job(job.id))
        .then((next) => {
          if (stopped || !safe()) return;
          if (
            next.projectId !== current.current.id ||
            next.revision !== current.current.revision
          ) {
            setJob(null);
            return;
          }
          setJob(next);
          void saveCreationJob(ownerId, next).catch(() => {});
        })
        .catch((reason) => {
          if (!stopped && safe()) setJobError(errorMessage(reason));
        });
    }, 1500);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [job, activeJob, jobError, ownerId, guard]);
  useEffect(() => {
    if (
      !job ||
      job.status !== "succeeded" ||
      job.id === lastHandledJob.current ||
      job.projectId !== project.id ||
      job.revision !== project.revision
    )
      return;
    lastHandledJob.current = job.id;
    if (job.kind === "transcribe") {
      const next = reviseCreation(current.current, {
        captions: job.result?.captions || [],
        captionsEnabled: !!job.result?.captions?.length,
      });
      setProject(next);
      current.current = next;
      setNotice(
        job.result?.captions?.length
          ? "Sous-titres prêts. Tu peux corriger chaque phrase."
          : "Aucune voix détectée dans le montage. Tu peux ajouter des sous-titres manuellement.",
      );
      return;
    }
    if (job.kind === "render") setRenderJob(job);
    let stopped = false;
    void createCreationApi(ownerId, guard)
      .then((api) => api.outputPreview(job))
      .then((result) => {
        if (stopped || !safe() || current.current.revision !== job.revision) {
          result.release();
          return;
        }
        previewRef.current?.release();
        const next = { ...result, revision: job.revision };
        previewRef.current = next;
        setPreview(next);
        setNotice(
          job.kind === "render"
            ? "Ta vidéo est prête. Un dernier regard, puis publie !"
            : "Ton aperçu est prêt.",
        );
      })
      .catch((reason) => {
        if (!stopped && safe()) setError(errorMessage(reason));
      });
    return () => {
      stopped = true;
    };
  }, [job, project.id, project.revision, ownerId, guard]);
  async function cancelJob() {
    if (!job || !activeJob) return;
    try {
      const next = await (
        await createCreationApi(ownerId, guard)
      ).cancelJob(job.id);
      guard();
      setJob(next);
      await saveCreationJob(ownerId, next);
      guard();
      setJobError("");
      setNotice("Montage arrêté. Ton brouillon est conservé.");
    } catch (reason) {
      if (safe()) setJobError(errorMessage(reason));
    }
  }
  async function publish() {
    if (needsProfile) {
      await completeProfile();
      return;
    }
    if ((!pendingPublication && locked) || !startBusy("publish")) return;
    try {
      await autosave.current.catch(() => {});
      guard();
      const snapshot = current.current;
      const invalid = validateCreationProject(snapshot);
      if (invalid) throw new Error(invalid);
      if (!pendingPublication && needsCreationRender(snapshot) && !rendered)
        throw new Error(
          "Prépare d’abord la vidéo pour vérifier le montage final.",
        );
      setProgress({ stage: "Publication", value: 0 });
      const result = await publishCreationProject(
        snapshot,
        guard,
        renderJob || undefined,
        reportProgress,
      );
      guard();
      setPublished(result);
      setPendingPublication(false);
      void Promise.allSettled([
        cache.invalidateQueries({ queryKey: ["posts"] }),
        cache.invalidateQueries({ queryKey: ["shorts-native"] }),
        cache.invalidateQueries({ queryKey: ["stories"] }),
        cache.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
      void notifyPublicationPublished({
        authorId: ownerId,
        contentId: result.id,
        kind: result.mode,
      });
      void notifyNetworkNewContent({
        authorId: ownerId,
        authorName: profile ? displayName(profile) : undefined,
        contentId: result.id,
        kind: result.mode,
      });
    } catch (reason) {
      if (safe()) {
        if (creationPublicationNeedsProfile(reason))
          setAuthorProfileMissing(true);
        setError(errorMessage(reason));
        try {
          const attempt = await loadCreationAttempt(
            ownerId,
            current.current.id,
          );
          if (safe() && attempt) setPendingPublication(true);
        } catch {
          /* The publication error remains actionable. */
        }
      }
    } finally {
      finishBusy();
    }
  }
  async function discard() {
    if (pendingPublication || activeJob || !startBusy("save")) return;
    try {
      await autosave.current.catch(() => {});
      guard();
      await removeCreationProject(ownerId, project.id);
      guard();
      leaving.current = true;
      setCloseOpen(false);
      if (router.canGoBack()) router.back();
      else router.replace("/shorts");
    } catch (reason) {
      if (safe()) setError(errorMessage(reason));
    } finally {
      finishBusy();
    }
  }
  function nextStep() {
    if (!canAct) return;
    if (step === 0) {
      // Go directly from media selection to publication. Video preparation,
      // when needed, is handled automatically before publishing.
      setStep(2);
      setClipIndex(0);
    }
  }
  const suggestions = useMemo(
    () => hashtagSuggestions(project),
    [project.caption, project.location, project.hashtags, project.mode],
  );
  const previewProject =
    step === 0 && project.sources[sourceIndex]
      ? {
          ...project,
          clips: [
            project.clips.find(
              (clip) => clip.sourceId === project.sources[sourceIndex].id,
            ) || sourceClip(project.sources[sourceIndex], "preview"),
          ],
        }
      : project;

  if (published)
    return (
      <View style={s.success}>
        <View style={s.successIcon}>
          <Check size={45} color={c.cyan} />
        </View>
        <Text style={s.successTitle}>C’est partagé !</Text>
        <Text style={[p.note, { textAlign: "center" }]}>
          {published.mode === "story"
            ? "Ta story est en ligne pour 24 heures."
            : "Ton moment de foot est maintenant en ligne."}
        </Text>
        <StudioButton
          label="Voir ma publication"
          icon={ArrowRight}
          onPress={() => {
            leaving.current = true;
            router.replace(
              published.mode === "story"
                ? "/stories"
                : published.mode === "short"
                  ? {
                      pathname: "/shorts",
                      params: { id: published.id, mode: "all" },
                    }
                  : { pathname: "/posts/[id]", params: { id: published.id } },
            );
          }}
        />
      </View>
    );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={s.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            step === 0 ? "Fermer la création" : "Étape précédente"
          }
          disabled={!!busy}
          onPress={() =>
            step > 0 && !pendingPublication ? setStep(0) : askClose()
          }
          style={s.iconButton}
        >
          {step === 0 ? (
            <X color={c.text} size={24} />
          ) : (
            <ArrowLeft color={c.text} size={23} />
          )}
        </Pressable>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.headerTitle}>{step === 0 ? "Créer" : "Publier"}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ouvrir les brouillons"
          onPress={() => void openDrafts()}
          disabled={locked}
          style={s.iconButton}
        >
          <FolderOpen color={c.muted} size={21} />
        </Pressable>
      </View>
      <View style={s.steps}>
        {["Médias", "Publication"].map((title, index) => {
          const active = index === 0 ? step === 0 : step === 2;
          const complete = index === 0 ? true : step === 2;
          return (
            <View key={title} style={{ flex: 1, gap: 6 }}>
              <View
                style={{
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: complete ? c.blue : c.line,
                }}
              />
              <Text
                style={{
                  color: active ? c.text : c.muted,
                  fontSize: 12,
                  fontWeight: "700",
                  letterSpacing: 0.5,
                }}
              >
                {index + 1} · {title}
              </Text>
            </View>
          );
        })}
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        {step === 0 && (
          <View style={p.row}>
            <StudioChip label="Texte seul" selected={false} disabled={locked} onPress={() => void openLegacy(legacyPaths.post)} />
            {(["post", "story", "short"] as const).map((mode) => (
              <StudioChip
                key={mode}
                label={modeLabels[mode]}
                selected={project.mode === mode}
                disabled={locked}
                onPress={() =>
                  patch({ mode, aspect: mode === "post" ? "4:5" : "9:16" })
                }
              />
            ))}
          </View>
        )}
        {(project.sources.length > 0 || step > 0) && (
          <CreationPreview
            project={previewProject}
            uris={uris}
            selectedIndex={step === 0 ? 0 : clipIndex}
            renderedUri={step > 0 ? previewUri : null}
            editable={step === 1}
            onDuration={(sourceId, duration) => {
              if (locked) return;
              const snapshot = current.current;
              if (
                snapshot.sources.find((source) => source.id === sourceId)
                  ?.duration
              )
                return;
              update(
                reviseCreation(snapshot, {
                  sources: snapshot.sources.map((source) =>
                    source.id === sourceId ? { ...source, duration } : source,
                  ),
                  clips: snapshot.clips.map((clip) =>
                    clip.sourceId === sourceId && clip.duration <= 0
                      ? { ...clip, duration: Math.min(duration, 60) }
                      : clip,
                  ),
                }),
              );
            }}
          />
        )}
        {!!project.sources.length && step !== 2 && (
          <View pointerEvents={locked ? "none" : "auto"}>
            <CreationTimeline
              project={project}
              uris={uris}
              selectedIndex={step === 0 ? sourceIndex : clipIndex}
              onSelect={step === 0 ? setSourceIndex : setClipIndex}
              sourceMode={step === 0}
              onChange={update}
            />
          </View>
        )}
        {step === 0 && (
          <>
            <View style={project.sources.length ? { gap: 12 } : s.mediaCard}>
              {!project.sources.length && (
                <View
                  style={{ alignItems: "center", gap: 10, paddingVertical: 12 }}
                >
                  <View style={s.mediaIcon}>
                    <Images size={28} color={c.cyan} />
                  </View>
                  <Text
                    style={{
                      color: c.text,
                      fontSize: 20,
                      fontWeight: "700",
                      textAlign: "center",
                    }}
                  >
                    Ajoute ton moment
                  </Text>
                  <Text style={[p.note, { textAlign: "center" }]}>
                    Ajoute une photo ou une vidéo, ou choisis « Texte seul » pour publier sans média.
                  </Text>
                </View>
              )}
              <CreationMediaPicker
                project={project}
                onAdd={addAssets}
                disabled={locked}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={locked}
              onPress={() => void openLegacy(legacyPaths.post)}
              style={({ pressed }) => ({
                alignSelf: "center",
                minHeight: 44,
                justifyContent: "center",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text
                style={{
                  color: c.muted,
                  fontSize: 12,
                  textDecorationLine: "underline",
                }}
              >
                Écrire une publication sans photo
              </Text>
            </Pressable>
          </>
        )}
        {step === 2 && (
          <View
            pointerEvents={locked ? "none" : "auto"}
            style={{ gap: 19, opacity: locked ? 0.65 : 1 }}
          >
            <StudioField
              label="Légende"
              placeholder="Raconte ton moment…"
              multiline
              maxLength={2000}
              value={project.caption}
              onChangeText={(caption) => patch({ caption })}
            />
            {(project.mode === "story" || project.mode === "short") && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choisir la musique de la story"
                onPress={() => setMusicOpen(true)}
                style={s.optionRow}
              >
                <Music2 color={c.muted} size={20} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontWeight: "700", fontSize: 14 }}>
                    Musique
                  </Text>
                  <Text style={[p.note, { fontSize: 11 }]}> 
                    {project.music ? "Musique sélectionnée" : "Ajouter une musique à la story"}
                  </Text>
                </View>
                <ChevronRight size={19} color={c.muted} />
              </Pressable>
            )}
            <View style={s.options}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: optionsOpen }}
                onPress={() => setOptionsOpen(!optionsOpen)}
                style={s.optionRow}
              >
                <MapPin color={c.muted} size={20} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ color: c.text, fontWeight: "700", fontSize: 14 }}
                  >
                    Options
                  </Text>
                  <Text style={[p.note, { fontSize: 11 }]}>
                    {project.mode === "short"
                      ? "Hashtags, lieu et couverture"
                      : "Hashtags et lieu"}
                  </Text>
                </View>
                {optionsOpen ? (
                  <ChevronDown size={19} color={c.muted} />
                ) : (
                  <ChevronRight size={19} color={c.muted} />
                )}
              </Pressable>
              {optionsOpen && (
                <View
                  style={{
                    gap: 16,
                    padding: 16,
                    borderTopWidth: 1,
                    borderColor: c.line,
                  }}
                >
                  <View style={{ gap: 10 }}>
                    <StudioField
                      label="Hashtags"
                      placeholder="#football #monclub"
                      value={project.hashtags}
                      maxLength={300}
                      onChangeText={(hashtags) => patch({ hashtags })}
                    />
                    <Text style={p.label}>Suggestions</Text>
                    <View style={p.row}>
                      {suggestions.map((tag) => (
                        <StudioChip
                          key={tag}
                          label={`#${tag}`}
                          disabled={parseTags(project.hashtags).length >= 10}
                          onPress={() => {
                            const next = [...parseTags(project.hashtags), tag]
                              .slice(0, 10)
                              .map((value) => `#${value}`)
                              .join(" ");
                            if (next.length <= 300) patch({ hashtags: next });
                          }}
                        />
                      ))}
                    </View>
                  </View>
                  <View
                    style={{
                      backgroundColor: "#F5F7FC",
                      borderRadius: 16,
                      padding: 12,
                      gap: 14,
                    }}
                  >
                    <ProfileAutocompleteField
                      kind="profile"
                      label="Taguer un profil FootNation"
                      value={profileTagQuery}
                      onChange={setProfileTagQuery}
                      onSelect={(profile) => {
                        const mention = profile.username
                          ? `@${profile.username}`
                          : `@${profile.name.replace(/\\s+/g, "_")}`;
                        const caption = project.caption.trim();
                        if (!caption.split(/\\s+/).includes(mention))
                          patch({
                            caption: `${caption}${caption ? " " : ""}${mention}`,
                          });
                        setProfileTagQuery("");
                      }}
                      disabled={locked}
                    />
                    <ProfileAutocompleteField
                      kind="club"
                      label="Taguer un club"
                      value={clubTagQuery}
                      onChange={setClubTagQuery}
                      onSelect={(club) => {
                        const mention = `@${club.name.replace(/\\s+/g, "_")}`;
                        const caption = project.caption.trim();
                        if (!caption.split(/\\s+/).includes(mention))
                          patch({
                            caption: `${caption}${caption ? " " : ""}${mention}`,
                          });
                        setClubTagQuery("");
                      }}
                      disabled={locked}
                    />
                    <ProfileAutocompleteField
                      kind="city"
                      label="Lieu"
                      value={project.location}
                      onChange={(location) => patch({ location })}
                      onSelect={(city) =>
                        patch({
                          location: [city.name, city.department]
                            .filter(Boolean)
                            .join(" · ")
                            .slice(0, 150),
                        })
                      }
                      maxLength={150}
                      disabled={locked}
                    />
                  </View>
                  {project.mode === "short" ? (
                    <StudioNumber
                      label="Image de couverture à (secondes)"
                      value={project.coverTime}
                      max={Math.max(0, creationDuration(project) - 0.05)}
                      onChange={(coverTime) => patch({ coverTime })}
                    />
                  ) : null}
                  <Text style={p.note}>
                    {project.mode === "story"
                      ? "Ta story sera visible pendant 24 heures."
                      : project.mode === "short"
                        ? "Ton short peut être découvert par toute la communauté."
                        : "Ta publication rejoint ton fil et ton profil."}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
        {(!!busy || activeJob) && (
          <View style={s.progressCard}>
            <View style={p.row}>
              <ActivityIndicator color={c.cyan} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: c.text, fontWeight: "800" }}>
                  {busy === "import"
                    ? "Préparation des médias"
                    : busy === "save"
                      ? "Enregistrement"
                      : busy
                        ? progress.stage || "Préparation"
                        : job?.stage ||
                          (job?.kind === "transcribe"
                            ? "Transcription"
                            : "Montage")}
                </Text>
                <Text style={p.note}>
                  {job?.status === "queued"
                    ? "Ton montage est dans la file."
                    : "Ton brouillon reste à l’abri."}
                </Text>
              </View>
              <Text style={{ color: c.cyan, fontWeight: "800" }}>
                {progressPercent} %
              </Text>
            </View>
            <View style={s.progressTrack}>
              <View
                style={[s.progressFill, { width: `${progressPercent}%` }]}
              />
            </View>
            {activeJob && (
              <StudioButton
                compact
                secondary
                label="Annuler le montage"
                onPress={() => void cancelJob()}
              />
            )}
          </View>
        )}
        {!!jobError && (
          <View style={s.error}>
            <Text accessibilityRole="alert" style={{ color: c.danger }}>
              {jobError}
            </Text>
            <StudioButton
              secondary
              compact
              label="Reprendre le suivi"
              icon={RotateCcw}
              onPress={() => setJobError("")}
            />
          </View>
        )}
        {job?.status === "failed" && job.revision === project.revision && (
          <View style={s.error}>
            <Text accessibilityRole="alert" style={{ color: c.danger }}>
              {job.error ||
                "Le montage n’a pas pu être terminé. Tes médias sont conservés."}
            </Text>
            <StudioButton
              secondary
              compact
              label="Réessayer le montage"
              icon={RotateCcw}
              onPress={() => void startJob(job.kind)}
              disabled={locked}
            />
          </View>
        )}
        {!!error && (
          <View style={s.error}>
            <Text
              accessibilityRole="alert"
              style={{ color: c.danger, lineHeight: 21 }}
            >
              {error}
            </Text>
          </View>
        )}
        {!!notice && (
          <View style={s.notice}>
            <Check color={c.cyan} size={17} />
            <Text
              accessibilityLiveRegion="polite"
              style={{ color: c.cyan, flex: 1, fontSize: 13 }}
            >
              {notice}
            </Text>
          </View>
        )}
        {needsProfile && step === 2 ? (
          <Text style={p.note}>
            Complète ton profil pour reprendre la publication. Ton média et ton
            brouillon restent enregistrés sur cet appareil.
          </Text>
        ) : (
          pendingPublication && (
            <Text style={p.note}>
              L’envoi a été conservé. Vérifie cette publication avant de
              modifier ton brouillon.
            </Text>
          )
        )}
        {step > 0 &&
          capabilitiesLoaded &&
          !capabilities.available &&
          needsRender && (
            <Text style={p.note}>
              Le montage vidéo n’est pas encore disponible. Tu peux préparer et
              enregistrer ton brouillon pour le reprendre dès son activation.
            </Text>
          )}
      </ScrollView>
      <ShortMusicPicker
        open={musicOpen}
        selected={project.music?.id || null}
        choose={(id) => patch({ music: id ? { id, volume: 0.7 } : null })}
        close={() => setMusicOpen(false)}
      />
      <View style={s.footer}>
        <View style={{ flex: 1 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enregistrer le brouillon"
            disabled={!!busy || !project.sources.length}
            onPress={() => void saveDraft(true)}
            style={{
              paddingVertical: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Save color={c.muted} size={19} />
            <View>
              <Text style={{ color: c.text, fontSize: 12, fontWeight: "700" }}>
                Brouillon
              </Text>
              <Text
                style={{
                  color: saveState === "error" ? c.danger : c.muted,
                  fontSize: 10,
                }}
              >
                {saveState === "saving"
                  ? "Enregistrement…"
                  : saveState === "error"
                    ? "À enregistrer"
                    : "Enregistrer"}
              </Text>
            </View>
          </Pressable>
        </View>
        <View style={{ flex: 1.65 }}>
          {step < 2 ? (
            <StudioButton
              label="Suivant"
              icon={ArrowRight}
              disabled={!canAct}
              onPress={nextStep}
            />
          ) : needsProfile ? (
            <StudioButton
              label="Compléter mon profil"
              icon={ArrowRight}
              busy={busy === "save"}
              disabled={!!busy || !!activeJob}
              onPress={() => void completeProfile()}
            />
          ) : pendingPublication ? (
            <StudioButton
              label="Vérifier l’envoi"
              icon={RotateCcw}
              busy={busy === "publish"}
              disabled={!!busy}
              onPress={() => void publish()}
            />
          ) : needsRender && !rendered ? (
            <StudioButton
              label="Préparer la vidéo"
              icon={Sparkles}
              busy={busy === "sync" || !!activeJob}
              disabled={!canAct || !capabilities.available}
              onPress={() => void startJob("render")}
            />
          ) : (
            <StudioButton
              label="Publier"
              icon={Send}
              busy={busy === "publish"}
              disabled={!canAct}
              onPress={() => void publish()}
            />
          )}
        </View>
      </View>
      <Modal
        visible={draftsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDraftsOpen(false)}
      >
        <SafeAreaView style={s.modalBackdrop}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={p.sectionTitle}>Tes brouillons</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer les brouillons"
                onPress={() => setDraftsOpen(false)}
                style={s.iconButton}
              >
                <X color={c.text} size={21} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 15 }}>
              {!!error && (
                <Text accessibilityRole="alert" style={{ color: c.danger }}>
                  {error}
                </Text>
              )}
              {loadingDrafts && <ActivityIndicator color={c.blue} />}
              {!loadingDrafts && !drafts.length && (
                <Text style={p.note}>
                  Tes créations en attente apparaîtront ici.
                </Text>
              )}
              {drafts.map((draft) => (
                <Pressable
                  key={draft.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Reprendre ${modeLabels[draft.mode]} du ${new Date(draft.updatedAt).toLocaleDateString("fr-FR")}`}
                  disabled={!!busy}
                  onPress={() => void restoreDraft(draft)}
                  style={s.draft}
                >
                  <View style={s.draftIcon}>
                    <FolderOpen size={24} color={c.cyan} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text
                      numberOfLines={1}
                      style={{ color: c.text, fontSize: 15, fontWeight: "800" }}
                    >
                      {draft.caption ||
                        `Ta ${modeLabels[draft.mode].toLowerCase()}`}
                    </Text>
                    <Text style={p.note}>
                      {draft.sources.length} média
                      {draft.sources.length > 1 ? "s" : ""} ·{" "}
                      {new Date(draft.updatedAt).toLocaleDateString("fr-FR")}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={c.muted} />
                </Pressable>
              ))}
              <StudioButton
                secondary
                label="Retrouver un ancien brouillon"
                icon={FolderOpen}
                onPress={() => void openLegacy(legacyPaths[project.mode])}
              />
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={closeOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCloseOpen(false)}
      >
        <SafeAreaView style={s.modalBackdrop}>
          <View style={s.sheet}>
            <ScrollView
              contentContainerStyle={{ gap: 17 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={p.sectionTitle}>
                Garder ce moment pour plus tard ?
              </Text>
              <Text style={p.note}>
                Reprends ton montage quand tu veux, sans perdre tes idées.
              </Text>
              <StudioButton
                label="Enregistrer et quitter"
                icon={Save}
                busy={busy === "save"}
                disabled={!!busy}
                onPress={() => void saveDraft(false, true)}
              />
              <StudioButton
                secondary
                label="Continuer la création"
                onPress={() => setCloseOpen(false)}
              />
              {!pendingPublication && !activeJob && (
                <StudioButton
                  secondary
                  danger
                  label="Supprimer le brouillon local"
                  disabled={!!busy}
                  onPress={() => void discard()}
                />
              )}
              {activeJob && (
                <>
                  <Text style={p.note}>
                    Le montage continue. Retrouve son résultat dans tes
                    brouillons.
                  </Text>
                  <StudioButton
                    secondary
                    label="Annuler le montage"
                    onPress={() => void cancelJob()}
                  />
                </>
              )}
              {!!error && <Text style={{ color: c.danger }}>{error}</Text>}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 13,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: c.text, fontSize: 18, fontWeight: "800" },
  steps: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 22,
    paddingBottom: 12,
  },
  content: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 16,
  },
  footer: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: c.background,
    borderTopWidth: 1,
    borderColor: c.line,
  },
  mediaCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: c.line,
    padding: 20,
    gap: 22,
    backgroundColor: c.panel,
  },
  mediaIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: c.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  options: {
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 20,
    overflow: "hidden",
  },
  optionRow: {
    padding: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressCard: {
    borderWidth: 1,
    borderColor: "#254771",
    borderRadius: 18,
    padding: 16,
    backgroundColor: "#101F36",
    gap: 14,
  },
  progressTrack: {
    height: 5,
    borderRadius: 5,
    backgroundColor: c.line,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: c.blue, borderRadius: 5 },
  error: {
    backgroundColor: "#361C2A",
    padding: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#603247",
    gap: 12,
  },
  notice: {
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    backgroundColor: "#112D34",
    borderRadius: 16,
    padding: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "#000000AA",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  sheet: {
    width: "100%",
    maxWidth: 650,
    maxHeight: "85%",
    backgroundColor: c.panel,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    paddingBottom: 32,
    gap: 17,
    borderWidth: 1,
    borderColor: c.line,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  draft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 14,
    borderRadius: 17,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.line,
  },
  draftIcon: {
    width: 46,
    height: 52,
    borderRadius: 13,
    backgroundColor: "#203450",
    alignItems: "center",
    justifyContent: "center",
  },
  success: {
    flex: 1,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    gap: 23,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 35,
    backgroundColor: "#123A45",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#287482",
  },
  successTitle: { color: c.text, fontWeight: "900", fontSize: 34 },
});
