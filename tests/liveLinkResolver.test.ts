import { expect, it, vi } from "vitest";
import {
  managedLiveClubId,
  resolveLiveLink,
} from "../src/lib/liveLinkResolver";
import type { ClubLiveStream } from "../src/lib/clubLive";

const clubId = "00000000-0000-4000-8000-000000000001";
const streamId = "00000000-0000-4000-8000-000000000002";
const anotherId = "00000000-0000-4000-8000-000000000003";
const stream = {
  id: streamId,
  club_id: clubId,
  status: "live",
  started_at: new Date().toISOString(),
  ended_at: null,
  expires_at: null,
  video_url: null,
} as ClubLiveStream;

it("opens a shared stream ID directly without guessing a club or video URL", async () => {
  const reader = {
    stream: vi.fn().mockResolvedValue(stream),
    clubStreams: vi.fn(),
  };
  expect(await resolveLiveLink(streamId, undefined, reader)).toBe(stream);
  expect(reader.stream).toHaveBeenCalledWith(streamId);
  expect(reader.clubStreams).not.toHaveBeenCalled();
  expect(stream.video_url).toBeNull();
});
it("gives an explicit legacy stream query priority over its club path", async () => {
  const reader = {
    stream: vi.fn().mockResolvedValue(stream),
    clubStreams: vi.fn(),
  };
  expect(await resolveLiveLink(clubId, streamId, reader)).toBe(stream);
  expect(reader.stream).toHaveBeenCalledWith(streamId);
  expect(reader.clubStreams).not.toHaveBeenCalled();
});
it("does not replace an unavailable explicit stream by a different club broadcast", async () => {
  const reader = {
    stream: vi.fn().mockResolvedValue(null),
    clubStreams: vi.fn().mockResolvedValue([stream]),
  };
  expect(await resolveLiveLink(clubId, streamId, reader)).toBeNull();
  expect(reader.clubStreams).not.toHaveBeenCalled();
});
it("resolves an old club path to an actual active stream from that club", async () => {
  const reader = {
    stream: vi.fn().mockResolvedValue(null),
    clubStreams: vi
      .fn()
      .mockResolvedValue([
        { ...stream, club_id: anotherId },
        { ...stream, ended_at: new Date().toISOString() },
        { ...stream, expires_at: "2020-01-01T00:00:00Z" },
        stream,
      ]),
  };
  expect(await resolveLiveLink(clubId, undefined, reader)).toBe(stream);
  expect(reader.clubStreams).toHaveBeenCalledWith(clubId);
});
it("returns empty when the club has no active/visible stream", async () => {
  const reader = {
    stream: vi.fn().mockResolvedValue(null),
    clubStreams: vi.fn().mockResolvedValue([{ ...stream, status: "ended" }]),
  };
  expect(await resolveLiveLink(clubId, undefined, reader)).toBeNull();
});
it("propagates authorization/network errors instead of falling back to unrelated content", async () => {
  const reader = {
    stream: vi.fn().mockRejectedValue(new Error("denied")),
    clubStreams: vi.fn(),
  };
  await expect(resolveLiveLink(clubId, undefined, reader)).rejects.toThrow(
    "denied",
  );
  expect(reader.clubStreams).not.toHaveBeenCalled();
});
it("rejects malformed or repeated query IDs without querying", async () => {
  const reader = { stream: vi.fn(), clubStreams: vi.fn() };
  for (const value of [
    "",
    "../other",
    "https://example.com",
    [streamId, anotherId],
  ])
    expect(await resolveLiveLink(clubId, value, reader)).toBeNull();
  expect(await resolveLiveLink("no-id", undefined, reader)).toBeNull();
  expect(reader.stream).not.toHaveBeenCalled();
});
it("uses a requested broadcasting club only after managed-club authorization loaded", () => {
  expect(managedLiveClubId(clubId, undefined)).toBeNull();
  expect(managedLiveClubId(clubId, [{ club_id: anotherId }])).toBeNull();
  expect(managedLiveClubId("../club", [{ club_id: "../club" }])).toBeNull();
  expect(managedLiveClubId(clubId, [{ club_id: clubId }])).toBe(clubId);
});
