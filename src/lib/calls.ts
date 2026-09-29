import { randomUUID } from "expo-crypto";
export type CallMode = "audio" | "video";
export type CallAction = "accept" | "reject" | "end" | "heartbeat";
export type CallPhase =
  | "idle"
  | "preparing"
  | "outgoing"
  | "incoming"
  | "connecting"
  | "connected"
  | "ended";

export interface CallPeer {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface CallRecord {
  id: string;
  caller_id: string;
  callee_id: string;
  mode: CallMode;
  status: "ringing" | "accepted" | "rejected" | "ended";
  offer: RTCSessionDescriptionInit | null;
  answer: RTCSessionDescriptionInit | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export interface CallBackend {
  getIceServers(peerId: string): Promise<RTCIceServer[]>;
  getPeer(peerId: string): Promise<CallPeer>;
  create(
    id: string,
    peerId: string,
    mode: CallMode,
    offer: RTCSessionDescriptionInit,
  ): Promise<CallRecord>;
  respond(
    id: string,
    action: CallAction,
    answer?: RTCSessionDescriptionInit,
  ): Promise<CallRecord>;
}

export interface CallDependencies {
  backend: CallBackend;
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createPeerConnection: (configuration: RTCConfiguration) => RTCPeerConnection;
  createStream: () => MediaStream;
}

export interface CallSnapshot {
  phase: CallPhase;
  peer: CallPeer | null;
  mode: CallMode;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  microphoneEnabled: boolean;
  cameraEnabled: boolean;
  connectedAt: number | null;
  message: string;
}

const idleSnapshot = (): CallSnapshot => ({
  phase: "idle",
  peer: null,
  mode: "audio",
  localStream: null,
  remoteStream: null,
  microphoneEnabled: true,
  cameraEnabled: true,
  connectedAt: null,
  message: "",
});

export function callErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Autorisez le microphone et, pour un appel vidéo, la caméra dans les réglages de FootNation.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "Aucun microphone ou caméra compatible n’a été trouvé.";
  }
  if (name === "NotReadableError") {
    return "Le microphone ou la caméra est déjà utilisé par une autre application.";
  }
  return error instanceof Error
    ? error.message
    : "Impossible d’établir l’appel. Réessayez.";
}

export async function gatherDescription(
  pc: RTCPeerConnection,
  signal: AbortSignal,
): Promise<RTCSessionDescriptionInit> {
  if (signal.aborted)
    throw Object.assign(new Error("Appel annulé"), { name: "AbortError" });
  if (pc.iceGatheringState !== "complete") {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        pc.removeEventListener("icegatheringstatechange", onChange);
        signal.removeEventListener("abort", onAbort);
      };
      const onChange = () => {
        if (pc.iceGatheringState === "complete") {
          cleanup();
          resolve();
        }
      };
      const onAbort = () => {
        cleanup();
        reject(
          Object.assign(new Error("Appel annulé"), { name: "AbortError" }),
        );
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            "Le relais d’appel ne répond pas. Vérifiez votre connexion et réessayez.",
          ),
        );
      }, 15000);
      pc.addEventListener("icegatheringstatechange", onChange);
      signal.addEventListener("abort", onAbort, { once: true });
      onChange();
    });
  }
  if (signal.aborted || !pc.localDescription?.sdp)
    throw Object.assign(new Error("Appel annulé"), { name: "AbortError" });
  return { type: pc.localDescription.type, sdp: pc.localDescription.sdp };
}

export class CallController {
  private snapshot = idleSnapshot();
  private listeners = new Set<() => void>();
  private record: CallRecord | null = null;
  private pendingId: string | null = null;
  private epoch = 0;
  private pc: RTCPeerConnection | null = null;
  private abort: AbortController | null = null;
  private deadline: ReturnType<typeof setTimeout> | null = null;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private leaseTimer: ReturnType<typeof setTimeout> | null = null;
  private applyingAnswer = false;
  private finishedIds = new Set<string>();

  constructor(
    private readonly userId: string,
    private readonly dependencies: CallDependencies,
  ) {}

  getSnapshot = () => this.snapshot;
  getActiveId = () => this.record?.id ?? this.pendingId;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private update(patch: Partial<CallSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private isCurrent(epoch: number) {
    return (
      epoch === this.epoch &&
      this.snapshot.phase !== "idle" &&
      this.snapshot.phase !== "ended"
    );
  }

  private setDeadline(milliseconds: number, message: string) {
    if (this.deadline) clearTimeout(this.deadline);
    this.deadline = setTimeout(
      () => this.finish(message),
      Math.max(0, milliseconds),
    );
  }

  private release() {
    this.abort?.abort();
    this.abort = null;
    if (this.deadline) clearTimeout(this.deadline);
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.leaseTimer) clearTimeout(this.leaseTimer);
    this.leaseTimer = null;
    this.deadline = null;
    this.disconnectTimer = null;
    this.heartbeat = null;
    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
    this.snapshot.localStream?.getTracks().forEach((track) => track.stop());
    this.snapshot.remoteStream?.getTracks().forEach((track) => track.stop());
    this.applyingAnswer = false;
  }

  private finish(message: string, action?: "end" | "reject" | null) {
    const id = this.getActiveId();
    const response =
      action === undefined
        ? this.record?.callee_id === this.userId &&
          this.record.status === "ringing"
          ? "reject"
          : "end"
        : action;
    if (id) {
      this.finishedIds.add(id);
      if (this.finishedIds.size > 100)
        this.finishedIds.delete(this.finishedIds.values().next().value!);
    }
    this.epoch++;
    this.release();
    this.record = null;
    this.pendingId = null;
    this.update({
      phase: "ended",
      message,
      localStream: null,
      remoteStream: null,
    });
    if (id && response)
      void this.dependencies.backend
        .respond(id, response)
        .catch(() => undefined);
  }

  end = () => this.finish("Appel terminé.");

  dismiss = () => {
    if (this.snapshot.phase !== "ended") this.end();
    this.snapshot = idleSnapshot();
    this.listeners.forEach((listener) => listener());
  };

  dispose = () => {
    if (this.getActiveId()) this.end();
    this.epoch++;
    this.release();
    this.listeners.clear();
  };

  toggleMicrophone = () => {
    const enabled = !this.snapshot.microphoneEnabled;
    this.snapshot.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
    this.update({ microphoneEnabled: enabled });
  };

  toggleCamera = () => {
    const enabled = !this.snapshot.cameraEnabled;
    this.snapshot.localStream?.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
    this.update({ cameraEnabled: enabled });
  };

  private async prepare(peerId: string, mode: CallMode, epoch: number) {
    const iceServers = await this.dependencies.backend.getIceServers(peerId);
    if (!this.isCurrent(epoch)) return null;
    if (
      !iceServers.some((server) =>
        [server.urls].flat().some((url) => /^turns?:/.test(url)),
      )
    ) {
      throw new Error("Le relais des appels n’est pas encore configuré.");
    }
    const stream = await this.dependencies.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video:
        mode === "video"
          ? {
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : false,
    });
    if (!this.isCurrent(epoch)) {
      stream.getTracks().forEach((track) => track.stop());
      return null;
    }
    this.update({
      localStream: stream,
      microphoneEnabled: true,
      cameraEnabled: mode === "video",
    });
    const pc = this.dependencies.createPeerConnection({
      iceServers,
      iceTransportPolicy: "relay",
    });
    this.pc = pc;
    this.abort = new AbortController();
    const remoteStream = this.dependencies.createStream();
    this.update({ remoteStream });
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
      track.onended = () => {
        if (this.isCurrent(epoch))
          this.finish("Le microphone ou la caméra a été déconnecté.");
      };
    });
    pc.ontrack = (event) => {
      if (
        this.isCurrent(epoch) &&
        !remoteStream.getTracks().some((track) => track.id === event.track.id)
      ) {
        remoteStream.addTrack(event.track);
      }
    };
    pc.onconnectionstatechange = () => {
      if (!this.isCurrent(epoch)) return;
      if (pc.connectionState === "connected") {
        if (this.deadline) clearTimeout(this.deadline);
        if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
        this.disconnectTimer = null;
        this.update({
          phase: "connected",
          connectedAt: this.snapshot.connectedAt ?? Date.now(),
        });
        this.startHeartbeat(epoch);
      } else if (pc.connectionState === "failed") {
        this.finish(
          "La connexion a échoué. Vérifiez votre réseau et réessayez.",
        );
      } else if (
        pc.connectionState === "disconnected" &&
        !this.disconnectTimer
      ) {
        this.disconnectTimer = setTimeout(
          () => this.finish("La connexion a été interrompue."),
          10000,
        );
      }
    };
    return pc;
  }

  private startHeartbeat(epoch: number) {
    if (this.heartbeat) return;
    this.heartbeat = setInterval(async () => {
      const id = this.record?.id;
      if (!id || !this.isCurrent(epoch)) return;
      try {
        const record = await this.dependencies.backend.respond(id, "heartbeat");
        if (this.isCurrent(epoch)) await this.receive(record);
      } catch {
        if (this.isCurrent(epoch))
          this.finish(
            "L’appel a été interrompu. Reconnectez-vous et réessayez.",
          );
      }
    }, 25000);
  }

  start = async (peer: CallPeer, mode: CallMode) => {
    if (
      !["idle", "ended"].includes(this.snapshot.phase) ||
      peer.id === this.userId
    )
      return;
    const epoch = ++this.epoch;
    const id = randomUUID();
    this.pendingId = id;
    this.update({ ...idleSnapshot(), phase: "preparing", peer, mode });
    this.setDeadline(
      45000,
      "La préparation de l’appel a expiré. Vérifiez les permissions et réessayez.",
    );
    try {
      const pc = await this.prepare(peer.id, mode, epoch);
      if (!pc || !this.isCurrent(epoch)) return;
      await pc.setLocalDescription(await pc.createOffer());
      if (!this.isCurrent(epoch)) return;
      const offer = await gatherDescription(pc, this.abort!.signal);
      if (!this.isCurrent(epoch)) return;
      const record = await this.dependencies.backend.create(
        id,
        peer.id,
        mode,
        offer,
      );
      if (!this.isCurrent(epoch)) {
        void this.dependencies.backend
          .respond(id, "end")
          .catch(() => undefined);
        return;
      }
      this.pendingId = null;
      if (!this.record) this.record = record;
      if (this.snapshot.phase === "preparing") {
        this.update({ phase: "outgoing" });
        this.setDeadline(
          Date.parse(record.expires_at) - Date.now(),
          "Aucune réponse. Votre contact doit avoir FootNation ouvert pour recevoir l’appel.",
        );
      }
      await this.receive(record);
    } catch (error) {
      if (this.isCurrent(epoch)) this.finish(callErrorMessage(error));
    }
  };

  accept = async () => {
    const record = this.record;
    if (!record || this.snapshot.phase !== "incoming" || !record.offer) return;
    const epoch = this.epoch;
    this.update({ phase: "connecting" });
    this.setDeadline(45000, "La connexion de l’appel a expiré.");
    try {
      const pc = await this.prepare(record.caller_id, record.mode, epoch);
      if (!pc || !this.isCurrent(epoch)) return;
      await pc.setRemoteDescription(record.offer);
      await pc.setLocalDescription(await pc.createAnswer());
      if (!this.isCurrent(epoch)) return;
      const answer = await gatherDescription(pc, this.abort!.signal);
      if (!this.isCurrent(epoch)) return;
      const accepted = await this.dependencies.backend.respond(
        record.id,
        "accept",
        answer,
      );
      if (!this.isCurrent(epoch)) {
        void this.dependencies.backend
          .respond(record.id, "end")
          .catch(() => undefined);
        return;
      }
      await this.receive(accepted);
    } catch (error) {
      if (this.isCurrent(epoch)) this.finish(callErrorMessage(error), "reject");
    }
  };

  receive = async (record: CallRecord) => {
    if (
      this.finishedIds.has(record.id) ||
      ![record.caller_id, record.callee_id].includes(this.userId)
    )
      return;
    const activeId = this.getActiveId();
    if (!activeId) {
      if (
        !["idle", "ended"].includes(this.snapshot.phase) ||
        record.callee_id !== this.userId ||
        record.status !== "ringing" ||
        Date.parse(record.expires_at) <= Date.now()
      )
        return;
      const epoch = ++this.epoch;
      this.record = record;
      this.update({
        ...idleSnapshot(),
        phase: "incoming",
        mode: record.mode,
        peer: { id: record.caller_id, name: "Votre contact" },
      });
      this.setDeadline(
        Date.parse(record.expires_at) - Date.now(),
        "Appel manqué.",
      );
      try {
        const peer = await this.dependencies.backend.getPeer(record.caller_id);
        if (this.isCurrent(epoch)) this.update({ peer });
      } catch {
        return;
      }
      return;
    }
    if (
      record.id !== activeId ||
      (this.record && record.updated_at < this.record.updated_at)
    )
      return;
    if (this.record?.status === "accepted" && record.status === "ringing")
      return;
    this.record = record;
    if (record.status === "ended" || record.status === "rejected") {
      this.finish(
        record.status === "rejected" ? "Appel refusé." : "Appel terminé.",
        null,
      );
    } else if (Date.parse(record.expires_at) <= Date.now()) {
      this.finish("L’appel a expiré.");
    } else if (record.status === "accepted") {
      if (this.leaseTimer) clearTimeout(this.leaseTimer);
      this.leaseTimer = setTimeout(
        () => this.finish("La connexion au service d’appels a été perdue."),
        Date.parse(record.expires_at) - Date.now(),
      );
      if (this.snapshot.phase === "incoming") {
        this.finish("Appel pris sur un autre appareil.", null);
      } else if (
        record.caller_id === this.userId &&
        this.pc &&
        record.answer &&
        !this.pc.remoteDescription &&
        !this.applyingAnswer
      ) {
        const epoch = this.epoch;
        this.applyingAnswer = true;
        this.update({ phase: "connecting" });
        this.setDeadline(
          30000,
          "Impossible de joindre votre contact. Réessayez.",
        );
        try {
          await this.pc.setRemoteDescription(record.answer);
        } catch (error) {
          if (this.isCurrent(epoch)) this.finish(callErrorMessage(error));
        }
      }
    }
  };
}
