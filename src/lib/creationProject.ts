/** Portable, versioned edit decision list shared by the studio and render worker. */
export type CreationMode = "post" | "story" | "short";
export type CreationTemplate = "energy" | "memories" | "clean";
export type CreationSource = {
  id: string;
  type: "image" | "video";
  name: string;
  mime: string;
  size: number;
  width: number;
  height: number;
  duration: number;
  /** Private storage object key, never an arbitrary URL. */
  path?: string;
};
export type CreationClip = {
  id: string;
  sourceId: string;
  start: number;
  duration: number;
  fit: "contain" | "cover";
  x: number;
  y: number;
};
export type CreationCaption = {
  id: string;
  text: string;
  start: number;
  end: number;
};
export type CreationText = CreationCaption & {
  x: number;
  y: number;
  size: number;
  color: string;
};
export type CreationProject = {
  version: 1;
  id: string;
  ownerId: string;
  revision: number;
  mode: CreationMode;
  sources: CreationSource[];
  clips: CreationClip[];
  template: CreationTemplate;
  aspect: "9:16" | "4:5" | "1:1" | "16:9";
  transition: number;
  music: { id: string; volume: number } | null;
  originalVolume: number;
  texts: CreationText[];
  captions: CreationCaption[];
  captionsEnabled: boolean;
  caption: string;
  location: string;
  hashtags: string;
  coverTime: number;
  createdAt: string;
  updatedAt: string;
};
export type CreationMusic = {
  id: string;
  title: string;
  artist: string;
  url?: string;
  beats: number[];
  license: string;
};
export type CreationJobKind = "preview" | "render" | "transcribe";
export type CreationJob = {
  id: string;
  projectId: string;
  revision: number;
  kind: CreationJobKind;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  progress: number;
  stage: string;
  result?: {
    coverPath?: string;
    url?: string;
    path?: string;
    coverUrl?: string;
    captions?: CreationCaption[];
  };
  error?: string;
};
export const CREATION_LIMITS = {
  sources: 10,
  photoBytes: 10 * 1024 * 1024,
  videoBytes: 50 * 1024 * 1024,
  sourceSeconds: 600,
  outputSeconds: 60,
};
export const CREATION_TEMPLATES: {
  id: CreationTemplate;
  name: string;
  detail: string;
  seconds: number;
  transition: number;
}[] = [
  {
    id: "energy",
    name: "Énergie",
    detail: "Coupes rapides · rythme sportif",
    seconds: 2,
    transition: 0,
  },
  {
    id: "memories",
    name: "Souvenirs",
    detail: "Fondus doux · moments à partager",
    seconds: 4,
    transition: 0.3,
  },
  {
    id: "clean",
    name: "Sobre",
    detail: "Plans plus longs · toute l’action",
    seconds: 6,
    transition: 0,
  },
];
export function newCreationProject(
  ownerId: string,
  id: string,
  mode: CreationMode,
): CreationProject {
  const now = new Date().toISOString();
  return {
    version: 1,
    id,
    ownerId,
    revision: 1,
    mode,
    sources: [],
    clips: [],
    template: "clean",
    aspect: mode === "post" ? "4:5" : "9:16",
    transition: 0,
    music: null,
    originalVolume: 1,
    texts: [],
    captions: [],
    captionsEnabled: false,
    caption: "",
    location: "",
    hashtags: "",
    coverTime: 0,
    createdAt: now,
    updatedAt: now,
  };
}
export function creationDuration(
  project: Pick<CreationProject, "clips" | "transition">,
) {
  return Math.max(
    0,
    project.clips.reduce((sum, clip) => sum + clip.duration, 0) -
      Math.max(0, project.clips.length - 1) * project.transition,
  );
}
export function reviseCreation(
  project: CreationProject,
  patch: Partial<CreationProject>,
): CreationProject {
  return {
    ...project,
    ...patch,
    version: 1,
    id: project.id,
    ownerId: project.ownerId,
    createdAt: project.createdAt,
    revision: project.revision + 1,
    updatedAt: new Date().toISOString(),
  };
}
export function sourceClip(source: CreationSource, id: string): CreationClip {
  return {
    id,
    sourceId: source.id,
    start: 0,
    duration: source.type === "image" ? 3 : Math.min(source.duration, 60),
    fit: "contain",
    x: 0.5,
    y: 0.5,
  };
}
/** Produces actual edit decisions; music beats, when available, determine cut points. */
export function autoCutProject(
  project: CreationProject,
  template: CreationTemplate,
  target: 15 | 30 | 60,
  beats: readonly number[] = [],
): CreationProject {
  if (!project.sources.length)
    throw new Error("Choisissez d’abord vos photos ou vidéos.");
  const model = CREATION_TEMPLATES.find((item) => item.id === template)!;
  let transition = Math.min(
    model.transition,
    ...project.sources
      .filter((source) => source.type === "video")
      .map((source) => Math.max(0, source.duration / 3)),
  );
  const available = project.sources.reduce(
    (sum, source) => sum + (source.type === "image" ? target : source.duration),
    0,
  );
  const total = Math.min(target, available);
  const validBeats = [...new Set(beats)]
    .filter((n) => Number.isFinite(n) && n > 0 && n < total)
    .sort((a, b) => a - b);
  const clips: CreationClip[] = [];
  const used = new Map<string, number>();
  let elapsed = 0,
    index = 0,
    exhausted = 0;
  while (elapsed < total - 0.05 && clips.length < 60) {
    const source = project.sources[index++ % project.sources.length];
    const start = used.get(source.id) || 0;
    const room = source.type === "image" ? total : source.duration - start;
    if (room < 0.1) {
      if (++exhausted >= project.sources.length) break;
      continue;
    }
    exhausted = 0;
    const ideal = elapsed + model.seconds;
    const beat = validBeats.find(
      (time) => time >= ideal - 0.35 && time <= ideal + 0.75,
    );
    const overlap = clips.length ? transition : 0;
    // Reserve a place for every selected media before adding more cuts.
    const remainingFirstPass = Math.max(1, project.sources.length - index + 1);
    const duration = Math.min(
      room,
      (total - elapsed) / remainingFirstPass + overlap,
      (beat ?? ideal) - elapsed + overlap,
    );
    if (duration <= overlap + 0.05) break;
    clips.push({
      ...sourceClip(source, `${project.id}-clip-${clips.length}`),
      start,
      duration,
    });
    if (source.type === "video") used.set(source.id, start + duration);
    elapsed += duration - overlap;
  }
  if (clips.length > 1) {
    const safeTransition = Math.min(
      transition,
      ...clips.map((clip) => Math.max(0, clip.duration / 2 - 0.01)),
    );
    let excess = (transition - safeTransition) * (clips.length - 1);
    transition = safeTransition;
    for (let i = clips.length - 1; i >= 0 && excess > 0; i--) {
      const trim = Math.min(
        excess,
        Math.max(0, clips[i].duration - Math.max(0.1, transition * 2 + 0.02)),
      );
      clips[i].duration -= trim;
      excess -= trim;
    }
  }
  return reviseCreation(project, {
    clips,
    template,
    transition: clips.length > 1 ? transition : 0,
    captions: [],
    captionsEnabled: false,
    coverTime: 0,
  });
}
/** Unedited single media stays on the proven publication path, without a render server. */
export function needsCreationRender(project: CreationProject) {
  const clip = project.clips[0],
    source = project.sources.find((item) => item.id === clip?.sourceId);
  if (!source || !clip || project.clips.length !== 1) return true;
  if (project.mode === "short" && source.type === "image") return true;
  return (
    clip.start !== 0 ||
    clip.fit !== "contain" ||
    project.aspect !== (project.mode === "post" ? "4:5" : "9:16") ||
    project.coverTime > 0 ||
    project.music !== null ||
    project.originalVolume !== 1 ||
    project.texts.length > 0 ||
    (project.captionsEnabled && project.captions.length > 0) ||
    (source.type === "video" &&
      Math.abs(clip.duration - source.duration) > 0.05)
  );
}
export function validateCreationProject(
  project: CreationProject,
): string | null {
  if (!project.sources.length || !project.clips.length)
    return "Choisissez au moins un média.";
  if (project.sources.length > 10)
    return "Vous pouvez sélectionner 10 médias maximum.";
  if (project.clips.length > 60)
    return "Vous pouvez ajouter 60 extraits maximum.";
  const within = (value: number, min: number, max: number) =>
    Number.isFinite(value) && value >= min && value <= max;
  const seconds = creationDuration(project);
  if (!within(seconds, 0.1, 60.05))
    return "Le montage doit durer entre 0,1 et 60 secondes.";
  if (!within(project.transition, 0, 1))
    return "Vérifiez la durée des transitions.";
  if (
    !within(project.originalVolume, 0, 1) ||
    (project.music && !within(project.music.volume, 0, 1))
  )
    return "Vérifiez le volume de l’audio.";
  if (!within(project.coverTime, 0, seconds))
    return "Choisissez une couverture dans la durée du montage.";
  for (const clip of project.clips) {
    const source = project.sources.find((item) => item.id === clip.sourceId);
    if (
      !source ||
      !within(clip.start, 0, 600) ||
      !within(clip.duration, 0.1, 60) ||
      (project.clips.length > 1 && clip.duration <= project.transition * 2) ||
      (source.type === "video" &&
        clip.start + clip.duration > source.duration + 0.05)
    )
      return "Vérifiez le début et la durée de chaque extrait.";
    if (![clip.x, clip.y].every((n) => within(n, 0, 1)))
      return "Vérifiez le cadrage de vos médias.";
  }
  if (project.texts.length > 20 || project.captions.length > 150)
    return "Le montage accepte 20 titres et 150 sous-titres maximum.";
  for (const text of [
    ...project.texts,
    ...(project.captionsEnabled ? project.captions : []),
  ]) {
    if (
      !text.text.trim() ||
      text.text.length > 500 ||
      !Number.isFinite(text.start) ||
      !Number.isFinite(text.end) ||
      text.start < 0 ||
      text.end <= text.start ||
      text.end > seconds + 0.05
    )
      return "Vérifiez le texte et les timings des titres ou sous-titres.";
  }
  for (const text of project.texts) {
    if (
      !within(text.x, 0, 1) ||
      !within(text.y, 0, 1) ||
      !within(text.size, 10, 100) ||
      !/^#[0-9a-fA-F]{6}$/.test(text.color)
    )
      return "Vérifiez la taille, la position et la couleur des titres.";
  }
  if (
    project.mode === "short" &&
    project.sources.length === 1 &&
    project.sources[0].type === "image" &&
    !needsCreationRender(project)
  )
    return "Activez Auto Cut pour transformer cette photo en short.";
  if (
    project.caption.length > 2000 ||
    project.hashtags.length > 300 ||
    project.location.length > 300
  )
    return "La légende ou les hashtags dépassent la limite autorisée.";
  return null;
}
