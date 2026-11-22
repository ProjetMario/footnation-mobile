// Browser contract checks with real IndexedDB/MediaRecorder and no network backend.
import assert from "node:assert/strict";
import http from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(new URL("../../package.json", import.meta.url));
const { build } = require("esbuild");
const { chromium } = require("playwright");
const root = fileURLToPath(new URL("..", import.meta.url));
const result = await build({
  stdin: {
    contents:
      'import * as storage from "./src/lib/messageAttachmentStorage.web"; import { BrowserVoiceRecording } from "./src/lib/browserVoiceRecording"; import { CallController } from "./src/lib/calls"; globalThis.testMedia = { ...storage, BrowserVoiceRecording, CallController };',
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  plugins: [
    {
      name: "isolated-backend",
      setup(build) {
        build.onResolve({ filter: /^\.\/supabase$/ }, () => ({
          path: "test-supabase",
          namespace: "fixture",
        }));
        build.onResolve({ filter: /^expo-crypto$/ }, () => ({
          path: "crypto",
          namespace: "fixture",
        }));
        build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
          contents:
            path === "crypto"
              ? "export const randomUUID = () => crypto.randomUUID();"
              : `export const supabase = { auth: { getUser: async () => ({ data: { user: { id: globalThis.testUser } } }) }, storage: { from: () => ({ info: async () => ({ error: { statusCode: '404' } }), upload: async (path, bytes, options) => { globalThis.uploaded = { path, size: bytes.byteLength, options }; return { error: null }; } }) } };`,
        }));
      },
    },
  ],
});
const server = http.createServer((req, res) => {
  res.setHeader(
    "Content-Type",
    req.url === "/bundle.js" ? "text/javascript" : "text/html",
  );
  res.end(
    req.url === "/bundle.js"
      ? result.outputFiles[0].text
      : '<!doctype html><script src="/bundle.js"></script>',
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
try {
  const page = await browser.newPage();
  const url = `http://127.0.0.1:${server.address().port}`;
  await page.goto(url);
  const saved = await page.evaluate(async () => {
    const uid = "00000000-0000-4000-8000-000000000001";
    const other = "00000000-0000-4000-8000-000000000002";
    const retain = async (owner) => {
      const uri = URL.createObjectURL(
        new Blob(["document"], { type: "application/pdf" }),
      );
      try {
        return await testMedia.retainMessageFile(owner, {
          uri,
          name: "a/b.pdf",
          mime: "application/pdf",
          size: 8,
          kind: "file",
          duration: null,
        });
      } finally {
        URL.revokeObjectURL(uri);
      }
    };
    return { uid, other, one: await retain(uid), two: await retain(other) };
  });
  assert.equal(saved.one.name, "a_b.pdf");
  await page.reload();
  const result = await page.evaluate(async ({ uid, other, one, two }) => {
    const attachment = (owner, file) => ({
      version: 1,
      name: file.name,
      mime: file.mime,
      size: file.size,
      kind: file.kind,
      duration: null,
      path: `${owner}/${owner === uid ? other : uid}/00000000-0000-4000-8000-000000000003/00000000-0000-4000-8000-000000000004.pdf`,
    });
    globalThis.testUser = uid;
    await testMedia.uploadMessageFile(uid, attachment(uid, one), one.uri);
    const upload = globalThis.uploaded;
    let isolated = false;
    try {
      await testMedia.uploadMessageFile(other, attachment(other, one), one.uri);
    } catch {
      isolated = true;
    }
    await testMedia.forgetMessageAttachmentFiles(uid);
    let forgotten = false;
    try {
      await testMedia.uploadMessageFile(uid, attachment(uid, one), one.uri);
    } catch {
      forgotten = true;
    }
    globalThis.testUser = other;
    await testMedia.uploadMessageFile(other, attachment(other, two), two.uri);
    return { upload, isolated, forgotten, otherSize: globalThis.uploaded.size };
  }, saved);
  assert.equal(result.upload.size, 8);
  assert.equal(result.upload.options.cacheControl, "0");
  assert.equal(result.isolated, true);
  assert.equal(result.forgotten, true);
  assert.equal(result.otherSize, 8);
  const recording = await page.evaluate(async () => {
    let stream;
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      stream = await getUserMedia(constraints);
      return stream;
    };
    const recording = new testMedia.BrowserVoiceRecording(() => {});
    await recording.start();
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const result = await recording.stop();
    return {
      bytes: result.blob.size,
      mime: result.mime,
      stopped: stream
        .getTracks()
        .every((track) => track.readyState === "ended"),
    };
  });
  assert(recording.bytes > 0);
  assert.equal(recording.mime, "audio/webm");
  assert.equal(recording.stopped, true);
  const call = await page.evaluate(async () => {
    const { CallController } = testMedia;
    let row;
    const a = "00000000-0000-4000-8000-000000000011";
    const b = "00000000-0000-4000-8000-000000000012";
    let caller, callee;
    const backend = {
      getIceServers: async () => [{ urls: "turn:fixture.invalid:3478" }],
      getPeer: async (id) => ({ id, name: "Local test" }),
      create: async (id, peer, mode, offer) => {
        row = {
          id,
          caller_id: a,
          callee_id: b,
          mode,
          offer,
          answer: null,
          status: "ringing",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 60000).toISOString(),
        };
        return row;
      },
      respond: async (id, action, answer) => {
        row = {
          ...row,
          status:
            action === "accept" || action === "heartbeat"
              ? "accepted"
              : "ended",
          answer: answer ?? row.answer,
          expires_at: new Date(Date.now() + 90000).toISOString(),
        };
        return row;
      },
    };
    const deps = {
      backend,
      getUserMedia: (constraints) =>
        navigator.mediaDevices.getUserMedia(constraints),
      // Test-only host candidates: production browserCalls enforces relay-only ICE.
      createPeerConnection: () =>
        new RTCPeerConnection({ iceServers: [], iceTransportPolicy: "all" }),
      createStream: () => new MediaStream(),
    };
    caller = new CallController(a, deps);
    callee = new CallController(b, deps);
    try {
      await caller.start({ id: b, name: "Receiver" }, "video");
      await callee.receive(row);
      const incomingWithoutMedia =
        callee.getSnapshot().phase === "incoming" &&
        !callee.getSnapshot().localStream;
      await callee.accept();
      await caller.receive(row);
      const deadline = Date.now() + 10000;
      while (
        (caller.getSnapshot().phase !== "connected" ||
          callee.getSnapshot().phase !== "connected") &&
        Date.now() < deadline
      )
        await new Promise((done) => setTimeout(done, 50));
      const state = caller.getSnapshot();
      const streams = [
        state.localStream,
        state.remoteStream,
        callee.getSnapshot().localStream,
        callee.getSnapshot().remoteStream,
      ];
      const connected =
        state.phase === "connected" &&
        callee.getSnapshot().phase === "connected";
      const video = state.remoteStream?.getVideoTracks().length === 1;
      const audio = state.remoteStream?.getAudioTracks().length === 1;
      caller.toggleMicrophone();
      const muted = state.localStream
        .getAudioTracks()
        .every((track) => !track.enabled);
      caller.end();
      await callee.receive(row);
      return {
        connected,
        video,
        audio,
        incomingWithoutMedia,
        muted,
        released: streams.every((stream) =>
          stream.getTracks().every((track) => track.readyState === "ended"),
        ),
      };
    } finally {
      caller.dispose();
      callee.dispose();
    }
  });
  assert.deepEqual(call, {
    connected: true,
    video: true,
    audio: true,
    incomingWithoutMedia: true,
    muted: true,
    released: true,
  });
  console.log(
    "Browser media: durable draft reload, account isolation/deletion, private upload, real microphone recording and two-peer WebRTC audio/video with cleanup passed.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
