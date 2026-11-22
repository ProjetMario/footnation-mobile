import { createClient } from "@supabase/supabase-js";
import { CryptoDigestAlgorithm, digest } from "expo-crypto";
import { supabase, requireBackend } from "./supabase";
import type {
  CreationJob,
  CreationJobKind,
  CreationMusic,
  CreationProject,
  CreationSource,
} from "./creationProject";
import {
  readCreationMedia,
  persistCreationMedia,
  creationMediaPreview,
} from "./creationStorage";
import {
  checkCreationDraft,
  creationKey,
  creationSourcePath,
  checkCreationMedia,
  creationMediaLimit,
} from "./creationStorageShared";

export type CreationCapabilities = {
  available: boolean;
  music: CreationMusic[];
  transcription: boolean;
};
export type CreationProgress = (stage: string, progress: number) => void;
export async function creationChecksum(bytes: ArrayBuffer) {
  const checksum = await digest(
    CryptoDigestAlgorithm.SHA256,
    new Uint8Array(bytes),
  );
  return Array.from(new Uint8Array(checksum), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export async function frozenCreationClient(ownerId: string, guard: () => void) {
  creationKey(ownerId, ownerId);
  requireBackend();
  guard();
  const current = await supabase.auth.getSession();
  guard();
  if (current.error || current.data.session?.user.id !== ownerId)
    throw new Error(
      "Votre session a changé. Revenez au compte de ce brouillon.",
    );
  const token = current.data.session.access_token;
  const client = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL!,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    {
      accessToken: async () => token,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  return { client, token };
}
/** Downloads only signed URLs obtained from the authenticated storage client. */
export async function readCreationRemote(uri: string, maxBytes: number) {
  const response = await fetch(uri);
  if (!response.ok)
    throw new Error("Le média n’a pas pu être récupéré. Réessayez.");
  if (Number(response.headers.get("content-length") || 0) > maxBytes)
    throw new Error("Ce média dépasse la taille autorisée.");
  if (response.body?.getReader) {
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > maxBytes)
          throw new Error("Ce média dépasse la taille autorisée.");
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes.buffer;
  }
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > maxBytes)
    throw new Error("Ce média est vide ou dépasse la taille autorisée.");
  return bytes;
}
export async function createCreationApi(ownerId: string, guard: () => void) {
  const { client, token } = await frozenCreationClient(ownerId, guard);
  const bucket = client.storage.from("creation-media");
  const configured = (process.env.EXPO_PUBLIC_MEDIA_STUDIO_URL || "")
    .trim()
    .replace(/\/$/, "");
  if (configured) {
    const url = new URL(configured);
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "10.0.2.2"].includes(url.hostname)
      )
    )
      throw new Error("La connexion au studio doit être sécurisée.");
  }
  async function request<T>(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    guard();
    if (!configured)
      throw new Error(
        "Le studio de montage est en cours de configuration. Votre brouillon reste enregistré.",
      );
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${configured}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
      guard();
      if (!response.ok) {
        if (response.status === 401)
          throw new Error(
            "Votre session a expiré. Reconnectez-vous pour reprendre ce brouillon.",
          );
        if (response.status === 409)
          throw new Error(
            "Le brouillon a changé. Rechargez-le avant de réessayer.",
          );
        throw new Error(
          "Le studio n’a pas pu terminer cette opération. Votre brouillon reste enregistré.",
        );
      }
      const result = (await response.json()) as T;
      guard();
      return result;
    } finally {
      clearTimeout(timer);
    }
  }
  async function privatePreview(projectId: string, path: string) {
    const prefix = `${creationKey(ownerId, projectId)}/`;
    if (
      !path.startsWith(prefix) ||
      path.includes("..") ||
      path.includes(":") ||
      path.includes("\\")
    )
      throw new Error("Ce média privé ne correspond pas à ce compte.");
    guard();
    const result = await bucket.createSignedUrl(path, 300);
    guard();
    if (result.error || !result.data?.signedUrl)
      throw new Error("L’aperçu privé n’est pas disponible. Réessayez.");
    return { uri: result.data.signedUrl, release: () => {} };
  }
  function checkJob(job: CreationJob) {
    creationKey(ownerId, job.projectId);
    creationKey(ownerId, job.id);
    if (
      !Number.isSafeInteger(job.revision) ||
      !["queued", "running", "succeeded", "failed", "cancelled"].includes(
        job.status,
      )
    )
      throw new Error("La réponse du studio est invalide.");
    return job;
  }
  const api = {
    async capabilities(): Promise<CreationCapabilities> {
      if (!configured)
        return { available: false, music: [], transcription: false };
      const result =
        await request<Partial<CreationCapabilities>>("/capabilities");
      return {
        available: result.available !== false,
        music: result.music || [],
        transcription: !!result.transcription,
      };
    },
    async sync(value: CreationProject, progress?: CreationProgress) {
      const project = checkCreationDraft(value, ownerId);
      if (!configured)
        throw new Error(
          "Le studio de montage est en cours de configuration. Votre brouillon reste enregistré.",
        );
      for (let index = 0; index < project.sources.length; index++) {
        const source = project.sources[index],
          path = creationSourcePath(ownerId, project.id, source);
        guard();
        progress?.("Transfert", index / project.sources.length);
        let bytes: ArrayBuffer;
        try {
          bytes = await readCreationMedia(ownerId, project.id, source);
        } catch (error) {
          if (!source.path) throw error;
          const preview = await privatePreview(project.id, source.path);
          bytes = await readCreationRemote(
            preview.uri,
            creationMediaLimit(source),
          );
        }
        checkCreationMedia(source, bytes.byteLength);
        const sha256 = await creationChecksum(bytes);
        guard();
        const existing = await bucket.info(path);
        guard();
        const matches = (info: typeof existing) =>
          !info.error &&
          info.data?.size === bytes.byteLength &&
          info.data?.metadata?.sha256 === sha256 &&
          info.data?.metadata?.projectId === project.id &&
          info.data?.metadata?.sourceId === source.id;
        if (!matches(existing)) {
          const result = await bucket.upload(path, bytes, {
            contentType: source.mime,
            upsert: false,
            metadata: { projectId: project.id, sourceId: source.id, sha256 },
          });
          guard();
          if (result.error && !matches(await bucket.info(path)))
            throw new Error(
              "L’envoi du média n’a pas pu être confirmé. Réessayez ce même brouillon.",
            );
        }
        source.path = path;
      }
      guard();
      progress?.("Transfert", 1);
      const response = await request<
        CreationProject | { project: CreationProject }
      >(`/projects/${project.id}`, "PUT", project);
      return checkCreationDraft(
        "project" in response ? response.project : response,
        ownerId,
      );
    },
    async list() {
      const response = await request<
        CreationProject[] | { projects: CreationProject[] }
      >("/projects");
      return (Array.isArray(response) ? response : response.projects).map(
        (project) => checkCreationDraft(project, ownerId),
      );
    },
    async load(id: string) {
      creationKey(ownerId, id);
      const response = await request<
        CreationProject | { project: CreationProject }
      >(`/projects/${id}`);
      return checkCreationDraft(
        "project" in response ? response.project : response,
        ownerId,
      );
    },
    async createJob(project: CreationProject, kind: CreationJobKind) {
      checkCreationDraft(project, ownerId);
      const response = await request<CreationJob>(
        `/projects/${project.id}/jobs`,
        "POST",
        { kind, revision: project.revision },
      );
      if (
        response.projectId !== project.id ||
        response.revision !== project.revision ||
        response.kind !== kind
      )
        throw new Error(
          "Ce résultat correspond à une autre version du montage.",
        );
      return checkJob(response);
    },
    async job(id: string) {
      creationKey(ownerId, id);
      return checkJob(await request<CreationJob>(`/jobs/${id}`));
    },
    async cancelJob(id: string) {
      creationKey(ownerId, id);
      return checkJob(
        await request<CreationJob>(`/jobs/${id}/cancel`, "POST", {}),
      );
    },
    async outputPreview(job: CreationJob) {
      checkJob(job);
      if (job.status !== "succeeded" || !job.result?.path)
        throw new Error("Ce montage n’est pas encore prêt.");
      return privatePreview(job.projectId, job.result.path);
    },
    async coverPreview(job: CreationJob) {
      checkJob(job);
      if (job.status !== "succeeded" || !job.result?.coverPath)
        throw new Error("La couverture n’est pas encore prête.");
      return privatePreview(job.projectId, job.result.coverPath);
    },
    async sourcePreview(projectId: string, source: CreationSource) {
      guard();
      try {
        return await creationMediaPreview(ownerId, projectId, source);
      } catch (error) {
        if (source.path !== creationSourcePath(ownerId, projectId, source))
          throw error;
        const preview = await privatePreview(projectId, source.path);
        const bytes = await readCreationRemote(
          preview.uri,
          creationMediaLimit(source),
        );
        guard();
        await persistCreationMedia(ownerId, projectId, source, bytes);
        return creationMediaPreview(ownerId, projectId, source);
      }
    },
  };
  return api;
}
