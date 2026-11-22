import { randomUUID } from "expo-crypto";

export type LiveRtcStream = {
  id: string;
  transport: string | null;
  broadcaster_id: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  expires_at: string | null;
};
export type LiveRtcPeer = {
  id: string;
  stream_id: string;
  viewer_id: string;
  status: "waiting" | "connected" | "ended";
  offer: RTCSessionDescriptionInit | null;
  answer: RTCSessionDescriptionInit | null;
  expires_at: string;
};
export type LiveStartInput = {
  id: string;
  title: string;
  matchId?: string | null;
  clubId?: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
};
export interface LiveRtcBackend {
  start(input: LiveStartInput): Promise<LiveRtcStream>;
  stream(id: string): Promise<LiveRtcStream | null>;
  manage(id: string, action: "heartbeat" | "end"): Promise<LiveRtcStream>;
  ice(streamId: string): Promise<RTCIceServer[]>;
  peers(streamId: string): Promise<LiveRtcPeer[]>;
  peer(id: string): Promise<LiveRtcPeer | null>;
  join(
    streamId: string,
    id: string,
    offer: RTCSessionDescriptionInit,
  ): Promise<LiveRtcPeer>;
  respond(
    id: string,
    action: "answer" | "heartbeat" | "leave",
    answer?: RTCSessionDescriptionInit,
  ): Promise<LiveRtcPeer>;
  watch(streamId: string, refresh: () => void): () => void;
}
export interface LiveRtcDependencies {
  backend: LiveRtcBackend;
  createPeerConnection(configuration: RTCConfiguration): RTCPeerConnection;
  createStream(): MediaStream;
  watchBackground?(listener: () => void): () => void;
}
export type LiveRtcSnapshot = {
  phase:
    | "idle"
    | "starting"
    | "live"
    | "connecting"
    | "connected"
    | "ended"
    | "error";
  streamId: string | null;
  remoteStream: MediaStream | null;
  connectedViewers: number;
  message: string;
};
const canceled = () =>
  Object.assign(new Error("La diffusion a été arrêtée."), {
    name: "AbortError",
  });
const releasedLiveStreams = new WeakSet<MediaStream>();
/** Stop owned tracks and release the native capture handle, once per stream. */
export function stopLiveCapture(stream: MediaStream | null | undefined) {
  if (!stream || releasedLiveStreams.has(stream)) return;
  releasedLiveStreams.add(stream);
  for (const track of stream.getTracks()) {
    track.onended = null;
    try {
      track.stop();
    } catch {
      /* Continue releasing the remaining tracks. */
    }
  }
  try {
    (stream as MediaStream & { release?: () => void }).release?.();
  } catch {
    /* Cleanup must still complete if a native handle is already gone. */
  }
}
const activeStream = (row: LiveRtcStream | null) =>
  !!row &&
  row.transport === "webrtc" &&
  row.status === "live" &&
  !row.ended_at &&
  !!row.expires_at &&
  Date.parse(row.expires_at) > Date.now();
const activePeer = (row: LiveRtcPeer | null) =>
  !!row && row.status !== "ended" && Date.parse(row.expires_at) > Date.now();
function requireRelay(servers: RTCIceServer[]) {
  if (
    !servers.length ||
    servers.some(
      (server) =>
        ![server.urls].flat().length ||
        [server.urls].flat().some((url) => !/^turns?:/i.test(url)),
    )
  )
    throw new Error(
      "Le relais vidéo du live est indisponible. Réessayez dans un instant.",
    );
  return { iceServers: servers, iceTransportPolicy: "relay" as const };
}
export async function gatherLiveDescription(
  pc: RTCPeerConnection,
  signal: AbortSignal,
): Promise<RTCSessionDescriptionInit> {
  if (signal.aborted) throw canceled();
  const hasRelay = () =>
    !!pc.localDescription?.sdp &&
    /^a=candidate:[^\r\n]*\styp relay(?:\s|$)/m.test(pc.localDescription.sdp);
  if (pc.iceGatheringState !== "complete")
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        pc.removeEventListener("icegatheringstatechange", change);
        signal.removeEventListener("abort", abort);
      };
      const change = () => {
        if (pc.iceGatheringState === "complete") {
          cleanup();
          resolve();
        }
      };
      const abort = () => {
        cleanup();
        reject(canceled());
      };
      const timer = setTimeout(() => {
        cleanup();
        if (signal.aborted) {
          reject(canceled());
          return;
        }
        // An unreachable fallback TURN transport can leave gathering pending
        // after usable relays arrive. Send the gathered SDP at this deadline;
        // signaling does not depend on candidates that arrive later.
        if (hasRelay()) {
          resolve();
          return;
        }
        reject(
          new Error(
            "La connexion vidéo n’a pas pu être établie. Vérifiez votre réseau.",
          ),
        );
      }, 15_000);
      pc.addEventListener("icegatheringstatechange", change);
      signal.addEventListener("abort", abort, { once: true });
      change();
    });
  if (signal.aborted || !pc.localDescription?.sdp) throw canceled();
  if (!hasRelay())
    throw new Error(
      "Le relais vidéo n’a pas répondu. Vérifiez votre connexion puis réessayez le live.",
    );
  return { type: pc.localDescription.type, sdp: pc.localDescription.sdp };
}

abstract class LiveSession {
  protected snapshot: LiveRtcSnapshot = {
    phase: "idle",
    streamId: null,
    remoteStream: null,
    connectedViewers: 0,
    message: "",
  };
  private listeners = new Set<() => void>();
  protected epoch = 0;
  protected abort = new AbortController();
  protected cleanups: (() => void)[] = [];
  private lease: ReturnType<typeof setTimeout> | null = null;
  protected disposed = false;
  constructor(protected readonly dependencies: LiveRtcDependencies) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  protected update(patch: Partial<LiveRtcSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  protected current(epoch: number) {
    return !this.disposed && epoch === this.epoch && !this.abort.signal.aborted;
  }
  protected assertCurrent(epoch: number) {
    if (!this.current(epoch)) throw canceled();
  }
  protected begin(id: string, phase: "starting" | "connecting") {
    if (this.disposed || this.snapshot.phase !== "idle")
      throw new Error("Cette session de live a déjà été utilisée.");
    this.update({ streamId: id, phase, message: "" });
    this.cleanups.push(
      this.dependencies.watchBackground?.(() => this.background()) ||
        (() => {}),
    );
    return this.epoch;
  }
  protected interval(fn: () => void, milliseconds: number) {
    const timer = setInterval(fn, milliseconds);
    this.cleanups.push(() => clearInterval(timer));
  }
  protected renewLease(expires: string | null, failure: () => void) {
    if (this.lease) clearTimeout(this.lease);
    const remaining = expires ? Date.parse(expires) - Date.now() : 0;
    this.lease = setTimeout(
      failure,
      Math.max(0, Number.isFinite(remaining) ? remaining : 0),
    );
  }
  protected cancel() {
    this.epoch++;
    this.abort.abort();
    if (this.lease) clearTimeout(this.lease);
    this.lease = null;
    this.cleanups.splice(0).forEach((cleanup) => cleanup());
  }
  protected abstract background(): void;
  abstract dispose(): void;
}

type PublisherPeer = {
  pc: RTCPeerConnection;
  abort: AbortController;
  disconnect: ReturnType<typeof setTimeout> | null;
  deadline: ReturnType<typeof setTimeout> | null;
};
/** Owns the supplied capture from start until end/dispose. Never opens a camera. */
export class LiveRtcPublisher extends LiveSession {
  private capture: MediaStream | null = null;
  private connections = new Map<string, PublisherPeer>();
  private iceServers: RTCIceServer[] = [];
  private iceFetchedAt = 0;
  private probe: RTCPeerConnection | null = null;
  private starting: Promise<LiveRtcStream> | null = null;
  private creating: Promise<LiveRtcStream> | null = null;
  private ending: Promise<void> | null = null;
  private polling = false;
  private pollAgain = false;
  private heartbeating = false;
  start(input: LiveStartInput, capture: MediaStream): Promise<LiveRtcStream> {
    if (this.starting && this.snapshot.streamId === input.id)
      return this.starting;
    const epoch = this.begin(input.id, "starting");
    this.capture = capture;
    this.starting = (async () => {
      try {
        if (
          !capture.getVideoTracks().some((track) => track.readyState === "live")
        )
          throw new Error("Activez la caméra avant de lancer le live.");
        this.creating = this.dependencies.backend.start(input);
        const row = await this.creating;
        if (!this.current(epoch)) {
          await this.dependencies.backend.manage(row.id, "end").catch(() => {});
          throw canceled();
        }
        if (!activeStream(row))
          throw new Error(
            "Ce live est déjà terminé. Préparez un nouveau direct.",
          );
        this.iceServers = await this.dependencies.backend.ice(row.id);
        this.assertCurrent(epoch);
        requireRelay(this.iceServers);
        this.iceFetchedAt = Date.now();
        this.renewLease(row.expires_at, () =>
          this.fail("La connexion au live a expiré."),
        );
        // An available URL is not proof that TURN credentials work. Gather an
        // actual relay before displaying LIVE; no SDP from this probe is sent.
        const probe = this.dependencies.createPeerConnection(
          requireRelay(this.iceServers),
        );
        this.probe = probe;
        try {
          capture
            .getTracks()
            .forEach((track) => probe.addTrack(track, capture));
          const offer = await probe.createOffer();
          this.assertCurrent(epoch);
          await probe.setLocalDescription(offer);
          await gatherLiveDescription(probe, this.abort.signal);
          this.assertCurrent(epoch);
        } finally {
          if (this.probe === probe) {
            probe.close();
            this.probe = null;
          }
        }
        capture.getTracks().forEach((track) => {
          track.onended = () => {
            if (this.current(epoch))
              this.fail("La caméra ou le microphone a été déconnecté.");
          };
        });
        this.update({ phase: "live" });
        this.cleanups.push(
          this.dependencies.backend.watch(row.id, () => void this.poll(epoch)),
        );
        this.interval(() => void this.poll(epoch), 2_000);
        this.interval(() => void this.heartbeat(epoch), 25_000);
        void this.poll(epoch);
        return row;
      } catch (error) {
        if (this.current(epoch)) {
          this.cancel();
          this.release();
          await this.dependencies.backend
            .manage(input.id, "end")
            .catch(() => {});
          this.update({
            phase: "error",
            message:
              error instanceof Error
                ? error.message
                : "Le live n’a pas pu démarrer.",
          });
        }
        throw error;
      }
    })();
    return this.starting;
  }
  private count() {
    this.update({
      connectedViewers: [...this.connections.values()].filter(
        ({ pc }) => pc.connectionState === "connected",
      ).length,
    });
  }
  private closePeer(id: string, leave = false) {
    const peer = this.connections.get(id);
    if (peer) {
      peer.abort.abort();
      if (peer.disconnect) clearTimeout(peer.disconnect);
      if (peer.deadline) clearTimeout(peer.deadline);
      peer.pc.onconnectionstatechange = null;
      peer.pc.close();
      this.connections.delete(id);
      this.count();
    }
    if (leave)
      void this.dependencies.backend.respond(id, "leave").catch(() => {});
  }
  private async poll(epoch: number) {
    if (!this.current(epoch) || !this.snapshot.streamId) return;
    if (this.polling) {
      this.pollAgain = true;
      return;
    }
    this.polling = true;
    try {
      const [stream, peers] = await Promise.all([
        this.dependencies.backend.stream(this.snapshot.streamId),
        this.dependencies.backend.peers(this.snapshot.streamId),
      ]);
      if (!this.current(epoch)) return;
      if (!activeStream(stream)) {
        this.fail("Le live est terminé.");
        return;
      }
      const active = peers.filter(activePeer);
      if (
        Date.now() - this.iceFetchedAt >= 45 * 60 * 1000 &&
        active.some(
          (peer) => peer.status === "waiting" && !this.connections.has(peer.id),
        )
      ) {
        const servers = await this.dependencies.backend.ice(
          this.snapshot.streamId,
        );
        if (!this.current(epoch)) return;
        requireRelay(servers);
        this.iceServers = servers;
        this.iceFetchedAt = Date.now();
      }
      for (const id of this.connections.keys())
        if (!active.some((peer) => peer.id === id)) this.closePeer(id);
      for (const peer of active) {
        if (
          this.connections.has(peer.id) ||
          peer.status !== "waiting" ||
          !peer.offer ||
          this.connections.size >= 8
        )
          continue;
        void this.answer(peer, epoch);
      }
    } catch {
      /* Poll again; a failed request never extends the server lease. */
    } finally {
      this.polling = false;
      if (this.pollAgain && this.current(epoch)) {
        this.pollAgain = false;
        void this.poll(epoch);
      }
    }
  }
  private async answer(row: LiveRtcPeer, epoch: number) {
    if (!this.current(epoch) || !this.capture) return;
    let pc: RTCPeerConnection;
    try {
      pc = this.dependencies.createPeerConnection(
        requireRelay(this.iceServers),
      );
    } catch {
      void this.dependencies.backend.respond(row.id, "leave").catch(() => {});
      return;
    }
    const peer: PublisherPeer = {
      pc,
      abort: new AbortController(),
      disconnect: null,
      deadline: null,
    };
    this.connections.set(row.id, peer);
    const current = () =>
      this.current(epoch) && this.connections.get(row.id) === peer;
    peer.deadline = setTimeout(() => {
      if (current()) this.closePeer(row.id, true);
    }, 35_000);
    pc.onconnectionstatechange = () => {
      if (!current()) return;
      if (pc.connectionState === "connected") {
        if (peer.deadline) clearTimeout(peer.deadline);
        if (peer.disconnect) clearTimeout(peer.disconnect);
        peer.deadline = peer.disconnect = null;
      } else if (
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      )
        this.closePeer(row.id, true);
      else if (pc.connectionState === "disconnected" && !peer.disconnect)
        peer.disconnect = setTimeout(
          () => this.closePeer(row.id, true),
          10_000,
        );
      this.count();
    };
    try {
      this.capture
        .getTracks()
        .forEach((track) => pc.addTrack(track, this.capture!));
      await pc.setRemoteDescription(row.offer!);
      if (!current()) return;
      const answer = await pc.createAnswer();
      if (!current()) return;
      await pc.setLocalDescription(answer);
      const description = await gatherLiveDescription(pc, peer.abort.signal);
      if (!current()) return;
      const result = await this.dependencies.backend.respond(
        row.id,
        "answer",
        description,
      );
      if (!current()) return;
      if (!activePeer(result) || result.status !== "connected")
        this.closePeer(row.id);
    } catch {
      if (current()) this.closePeer(row.id, true);
    }
  }
  private async heartbeat(epoch: number) {
    if (!this.current(epoch) || this.heartbeating || !this.snapshot.streamId)
      return;
    this.heartbeating = true;
    try {
      const stream = await this.dependencies.backend.manage(
        this.snapshot.streamId,
        "heartbeat",
      );
      if (!this.current(epoch)) return;
      if (!activeStream(stream)) {
        this.fail("Le live est terminé.");
        return;
      }
      this.renewLease(stream.expires_at, () =>
        this.fail("La connexion au live a expiré."),
      );
    } catch {
      /* No extension on failure; expiry closes capture and connections. */
    } finally {
      this.heartbeating = false;
    }
  }
  async replaceStream(stream: MediaStream) {
    const epoch = this.epoch;
    if (this.snapshot.phase !== "live" || !this.current(epoch)) {
      stopLiveCapture(stream);
      throw canceled();
    }
    const previous = this.capture;
    this.capture = stream;
    try {
      for (const [id, { pc }] of this.connections) {
        try {
          await Promise.all(
            pc
              .getSenders()
              .map((sender) =>
                sender.replaceTrack(
                  stream
                    .getTracks()
                    .find((track) => track.kind === sender.track?.kind) || null,
                ),
              ),
          );
        } catch {
          this.closePeer(id, true);
        }
        this.assertCurrent(epoch);
      }
      stream.getTracks().forEach((track) => {
        track.onended = () => {
          if (this.current(epoch) && this.capture === stream)
            this.fail("La caméra ou le microphone a été déconnecté.");
        };
      });
    } finally {
      stopLiveCapture(previous);
      if (!this.current(epoch)) stopLiveCapture(stream);
    }
  }
  private release() {
    this.probe?.close();
    this.probe = null;
    for (const id of [...this.connections.keys()]) this.closePeer(id);
    stopLiveCapture(this.capture);
    this.capture = null;
  }
  private fail(message: string) {
    const id = this.snapshot.streamId;
    this.cancel();
    this.release();
    this.update({ phase: "error", message });
    if (id) void this.dependencies.backend.manage(id, "end").catch(() => {});
  }
  end = (): Promise<void> => {
    if (this.ending) return this.ending;
    const id = this.snapshot.streamId;
    this.cancel();
    this.release();
    this.update({
      phase: "ended",
      message: "Le live est arrêté sur cet appareil.",
    });
    this.ending = (async () => {
      if (this.creating) await this.creating.catch(() => {});
      if (!id) return;
      let row: LiveRtcStream | null;
      try {
        row = await this.dependencies.backend.manage(id, "end");
      } catch (error) {
        // Creation may have been rejected, or the end response may have been
        // lost. Only an authoritative read can confirm there is nothing active.
        try {
          row = await this.dependencies.backend.stream(id);
        } catch {
          throw error;
        }
        if (row && (row.status !== "ended" || !row.ended_at)) throw error;
      }
      if (row && (row.status !== "ended" || !row.ended_at))
        throw new Error(
          "L’arrêt du live n’a pas encore été confirmé. Réessayez.",
        );
      this.update({ phase: "ended", message: "Le live est terminé." });
    })()
      .catch((error) => {
        this.update({
          phase: "error",
          message:
            "La caméra est arrêtée. Réessayez pour confirmer la fin du live.",
        });
        throw error;
      })
      .finally(() => {
        this.ending = null;
      });
    return this.ending;
  };
  protected background() {
    void this.end().catch(() => {});
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    void this.end().catch(() => {});
  }
}

/** A viewer only receives media. It never requests camera/microphone permission. */
export class LiveRtcViewer extends LiveSession {
  private pc: RTCPeerConnection | null = null;
  private peerId: string | null = null;
  private starting: Promise<void> | null = null;
  private applying = false;
  private polling = false;
  private pollAgain = false;
  private heartbeating = false;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private disconnect: ReturnType<typeof setTimeout> | null = null;
  start(streamId: string, peerId = randomUUID()): Promise<void> {
    if (this.starting && this.snapshot.streamId === streamId)
      return this.starting;
    const epoch = this.begin(streamId, "connecting");
    this.peerId = peerId;
    this.starting = (async () => {
      try {
        const stream = await this.dependencies.backend.stream(streamId);
        this.assertCurrent(epoch);
        if (!activeStream(stream)) throw new Error("Ce live est terminé.");
        const ice = await this.dependencies.backend.ice(streamId);
        this.assertCurrent(epoch);
        const pc = this.dependencies.createPeerConnection(requireRelay(ice));
        this.pc = pc;
        const remote = this.dependencies.createStream();
        this.update({ remoteStream: remote });
        pc.ontrack = (event) => {
          if (!this.current(epoch)) {
            event.track.stop();
            return;
          }
          if (!remote.getTracks().some((track) => track.id === event.track.id))
            remote.addTrack(event.track);
          this.update({ remoteStream: remote });
        };
        pc.onconnectionstatechange = () => {
          if (!this.current(epoch)) return;
          if (pc.connectionState === "connected") {
            if (this.timeout) clearTimeout(this.timeout);
            if (this.disconnect) clearTimeout(this.disconnect);
            this.timeout = this.disconnect = null;
            this.update({ phase: "connected", message: "" });
          } else if (
            pc.connectionState === "failed" ||
            pc.connectionState === "closed"
          )
            this.finish("La connexion vidéo a été interrompue.", true);
          else if (pc.connectionState === "disconnected" && !this.disconnect)
            this.disconnect = setTimeout(
              () => this.finish("La connexion vidéo a été interrompue.", true),
              10_000,
            );
        };
        pc.addTransceiver("audio", { direction: "recvonly" });
        pc.addTransceiver("video", { direction: "recvonly" });
        const offer = await pc.createOffer();
        this.assertCurrent(epoch);
        await pc.setLocalDescription(offer);
        const description = await gatherLiveDescription(pc, this.abort.signal);
        this.assertCurrent(epoch);
        const peer = await this.dependencies.backend.join(
          streamId,
          peerId,
          description,
        );
        if (!this.current(epoch)) {
          await this.dependencies.backend
            .respond(peerId, "leave")
            .catch(() => {});
          throw canceled();
        }
        await this.receive(peer, epoch);
        this.assertCurrent(epoch);
        if (this.snapshot.phase !== "connected")
          this.timeout = setTimeout(
            () =>
              this.finish(
                "Le diffuseur ne répond pas. Réessayez de rejoindre le live.",
                true,
              ),
            35_000,
          );
        this.cleanups.push(
          this.dependencies.backend.watch(
            streamId,
            () => void this.poll(epoch),
          ),
        );
        this.interval(() => void this.poll(epoch), 2_000);
        this.interval(() => void this.heartbeat(epoch), 25_000);
        void this.poll(epoch);
      } catch (error) {
        if (this.current(epoch))
          this.finish(
            error instanceof Error
              ? error.message
              : "Le live n’a pas pu être rejoint.",
            true,
          );
        throw error;
      }
    })();
    return this.starting;
  }
  private async receive(peer: LiveRtcPeer | null, epoch: number) {
    if (!this.current(epoch)) return;
    if (!activePeer(peer)) {
      this.finish("Le live est terminé.");
      return;
    }
    this.renewLease(peer!.expires_at, () =>
      this.finish("La connexion au live a expiré.", true),
    );
    if (peer!.answer && !this.pc?.remoteDescription && !this.applying) {
      this.applying = true;
      try {
        await this.pc?.setRemoteDescription(peer!.answer);
      } finally {
        this.applying = false;
      }
    }
  }
  private async poll(epoch: number) {
    if (!this.current(epoch) || !this.peerId || !this.snapshot.streamId) return;
    if (this.polling) {
      this.pollAgain = true;
      return;
    }
    this.polling = true;
    try {
      const [stream, peer] = await Promise.all([
        this.dependencies.backend.stream(this.snapshot.streamId),
        this.dependencies.backend.peer(this.peerId),
      ]);
      if (!this.current(epoch)) return;
      if (!activeStream(stream)) {
        this.finish("Le live est terminé.");
        return;
      }
      await this.receive(peer, epoch);
    } catch {
      /* The existing lease remains authoritative during a brief outage. */
    } finally {
      this.polling = false;
      if (this.pollAgain && this.current(epoch)) {
        this.pollAgain = false;
        void this.poll(epoch);
      }
    }
  }
  private async heartbeat(epoch: number) {
    if (!this.current(epoch) || this.heartbeating || !this.peerId) return;
    this.heartbeating = true;
    try {
      await this.receive(
        await this.dependencies.backend.respond(this.peerId, "heartbeat"),
        epoch,
      );
    } catch {
      /* No extension on failed authentication or lost connectivity. */
    } finally {
      this.heartbeating = false;
    }
  }
  private finish(message: string, error = false) {
    this.cancel();
    if (this.timeout) clearTimeout(this.timeout);
    if (this.disconnect) clearTimeout(this.disconnect);
    this.timeout = this.disconnect = null;
    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
    stopLiveCapture(this.snapshot.remoteStream);
    this.update({
      phase: error ? "error" : "ended",
      remoteStream: null,
      message,
    });
    if (this.peerId)
      void this.dependencies.backend
        .respond(this.peerId, "leave")
        .catch(() => {});
  }
  protected background() {
    this.finish("Le live a été fermé en arrière-plan.");
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.finish("Le live est fermé.");
  }
}
