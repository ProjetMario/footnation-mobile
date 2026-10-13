#!/usr/bin/env python3
"""Bounded, service-only 720p derivatives. No third-party Python dependencies."""
from __future__ import annotations

import argparse
import hashlib
import http.client
import json
import math
import os
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, unquote, urlsplit, urlencode
from urllib.request import Request, build_opener, HTTPRedirectHandler

MAX_BYTES = 250 * 1024 * 1024
MAX_SECONDS = 600
VERSION = "mobile-720-v1"
SOURCE_BUCKETS = frozenset(("shorts", "post-media"))


class MediaError(Exception):
    """Only stable safe codes are logged, never subprocess output/URLs/credentials."""


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise MediaError("redirect_rejected")


def storage_source(source: str, base: str) -> tuple[str, str]:
    url, project = urlsplit(source), urlsplit(base)
    if url.scheme != "https" or url.netloc != project.netloc or url.username or url.password:
        raise MediaError("unsupported_source")
    prefix = "/storage/v1/object/public/"
    if not url.path.startswith(prefix) or url.fragment or url.query:
        raise MediaError("unsupported_source")
    parts = unquote(url.path[len(prefix):]).split("/")
    if len(parts) < 2 or parts[0] not in SOURCE_BUCKETS or any(p in ("", ".", "..") for p in parts):
        raise MediaError("unsupported_source")
    if any("\\" in p or "\x00" in p for p in parts):
        raise MediaError("unsupported_source")
    return parts[0], "/".join(parts[1:])


def command(args: list[str], timeout=300) -> bytes:
    try:
        environment = {key: value for key, value in os.environ.items() if key not in
                       ("SUPABASE_SERVICE_ROLE_KEY", "MEDIA_VIDEO_SERVICE_ROLE_KEY")}
        result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout, check=False, env=environment)
    except subprocess.TimeoutExpired as exc:
        raise MediaError("transcode_timeout") from exc
    if result.returncode:
        if b"No space left on device" in result.stderr or b"Cannot allocate memory" in result.stderr:
            raise MediaError("transcode_resources")
        raise MediaError("invalid_media")
    return result.stdout


def probe(path: Path) -> dict:
    try:
        data = json.loads(command(["ffprobe", "-v", "error", "-protocol_whitelist", "file,pipe", "-show_streams",
                                   "-show_format", "-of", "json", str(path)], timeout=30))
        video = next(s for s in data["streams"] if s["codec_type"] == "video" and not s.get("disposition", {}).get("attached_pic"))
        duration = float(data.get("format", {}).get("duration", video.get("duration", 0)))
        width, height = int(video["width"]), int(video["height"])
        if not math.isfinite(duration) or not 0 < duration <= MAX_SECONDS or min(width, height) < 2 or max(width, height) > 16384:
            raise MediaError("media_limits")
        rotation = int(video.get("tags", {}).get("rotate", 0))
        for side in video.get("side_data_list", []):
            if "rotation" in side:
                rotation = int(side["rotation"])
        if abs(rotation) % 180 == 90:
            width, height = height, width
        audio = next((s for s in data["streams"] if s["codec_type"] == "audio"), None)
        return {"width": width, "height": height, "duration": duration, "video": video,
                "audio": audio, "format": data.get("format", {}).get("format_name", "")}
    except (ValueError, KeyError, StopIteration, TypeError) as exc:
        raise MediaError("invalid_media") from exc


def target_size(width: int, height: int) -> tuple[int, int]:
    scale = min(1.0, 720 / min(width, height), 1280 / max(width, height))
    return max(2, int(width * scale) // 2 * 2), max(2, int(height * scale) // 2 * 2)


def is_faststart(path: Path) -> bool:
    """Parse top-level MP4 atoms rather than matching arbitrary bytes in mdat."""
    try:
        with path.open("rb") as stream:
            total = path.stat().st_size
            while stream.tell() + 8 <= total:
                start = stream.tell()
                size, kind = struct.unpack(">I4s", stream.read(8))
                if size == 1:
                    size = struct.unpack(">Q", stream.read(8))[0]
                if kind == b"moov":
                    return True
                if kind == b"mdat" or size < 8 or start + size > total:
                    return False
                stream.seek(start + size)
    except (OSError, struct.error):
        return False
    return False


def optimize(source: Path, directory: Path, needs_thumbnail=True) -> dict:
    original = probe(source)
    width, height = target_size(original["width"], original["height"])
    result = directory / "mobile.mp4"
    command(["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-protocol_whitelist", "file,pipe",
             "-i", str(source), "-map", "0:v:0", "-map", "0:a:0?", "-sn", "-dn", "-map_metadata", "-1",
             "-vf", f"scale={width}:{height}:flags=lanczos,setsar=1,fps=30", "-c:v", "libx264", "-preset", "fast",
             "-crf", "26", "-maxrate", "1800k", "-bufsize", "3600k", "-pix_fmt", "yuv420p", "-profile:v", "high",
             "-level:v", "3.1", "-g", "60", "-keyint_min", "30", "-c:a", "aac", "-b:a", "96k", "-ac", "2",
             "-movflags", "+faststart", "-threads", "2", str(result)])
    output = probe(result)
    # Never publish a broken/truncated file or a codec that Safari cannot decode.
    if (output["video"].get("codec_name") != "h264" or output["video"].get("pix_fmt") != "yuv420p"
            or (output["audio"] and output["audio"].get("codec_name") != "aac") or not is_faststart(result)
            or (output["width"], output["height"]) != (width, height)
            or abs(output["duration"] - original["duration"]) > max(.25, original["duration"] * .02)):
        raise MediaError("output_validation")
    # Existing small videos are left alone. Merely transcoding can make them bigger.
    selected = result if result.stat().st_size < source.stat().st_size else None
    thumb = None
    if needs_thumbnail:
        thumb = directory / "poster.jpg"
        command(["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-protocol_whitelist", "file,pipe",
                 "-ss", str(min(.1, original["duration"] / 2)), "-i", str(result), "-frames:v", "1",
                 "-vf", "scale=360:640:force_original_aspect_ratio=decrease", "-q:v", "3", "-threads", "1", str(thumb)], timeout=30)
        if not thumb.is_file() or thumb.stat().st_size < 100:
            raise MediaError("thumbnail_validation")
    return {"video": selected, "thumbnail": thumb, "stats": {"version": VERSION, "source_bytes": source.stat().st_size,
            "output_bytes": selected.stat().st_size if selected else source.stat().st_size,
            "width": width if selected else original["width"], "height": height if selected else original["height"], "duration_seconds": round(output["duration"], 3),
            "kept_original": selected is None, "faststart": bool(selected)}}


class Client:
    def __init__(self, base: str, key: str):
        parsed = urlsplit(base)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.path not in ("", "/"):
            raise MediaError("invalid_project_url")
        self.base, self.key = base.rstrip("/"), key
        self.opener = build_opener(NoRedirect())

    def request(self, path: str, payload=None, method="POST"):
        headers = {"apikey": self.key, "Authorization": f"Bearer {self.key}", "Content-Type": "application/json"}
        body = None if payload is None else json.dumps(payload).encode()
        try:
            with self.opener.open(Request(self.base + path, data=body, headers=headers, method=method), timeout=30) as response:
                raw = response.read(2 * 1024 * 1024)
                return json.loads(raw) if raw else None
        except (HTTPError, URLError, TimeoutError, OSError) as exc:
            raise MediaError("api_request_failed") from exc

    def rpc(self, name, data=None):
        return self.request("/rest/v1/rpc/" + name, data or {})

    def download(self, url: str, path: Path):
        storage_source(url, self.base)
        started = time.monotonic()
        try:
            with self.opener.open(Request(url), timeout=30) as response, path.open("wb") as output:
                declared = int(response.headers.get("Content-Length", 0))
                if declared > MAX_BYTES:
                    raise MediaError("media_limits")
                size = 0
                while chunk := response.read(1024 * 1024):
                    size += len(chunk)
                    if size > MAX_BYTES or time.monotonic() - started > 120:
                        raise MediaError("download_limits")
                    output.write(chunk)
                if not size or (declared and size != declared):
                    raise MediaError("incomplete_download")
        except (HTTPError, URLError, TimeoutError, OSError, ValueError) as exc:
            raise MediaError("download_failed") from exc

    def upload(self, bucket: str, name: str, path: Path, content_type: str) -> str:
        encoded = quote(bucket + "/" + name, safe="/")
        target = urlsplit(self.base)
        connection = http.client.HTTPSConnection(target.hostname, target.port, timeout=120)
        try:
            # Content-addressed path and no overwrite: a retry can safely adopt 409.
            with path.open("rb") as body:
                connection.request("POST", "/storage/v1/object/" + encoded, body=body, headers={
                    "apikey": self.key, "Authorization": f"Bearer {self.key}", "Content-Type": content_type,
                    "Content-Length": str(path.stat().st_size), "Cache-Control": "max-age=31536000", "x-upsert": "false"})
                response = connection.getresponse()
                raw = response.read(10000)
                duplicate = response.status == 409
                if response.status == 400:
                    try:
                        duplicate = str(json.loads(raw).get("statusCode")) == "409"
                    except (ValueError, AttributeError):
                        pass
                if not 200 <= response.status < 300 and not duplicate:
                    raise MediaError("upload_failed")
        except (OSError, http.client.HTTPException) as exc:
            raise MediaError("upload_failed") from exc
        finally:
            connection.close()
        public_url = self.base + "/storage/v1/object/public/" + encoded
        # A small byte range confirms the playback URL works, including retries.
        try:
            with self.opener.open(Request(public_url, headers={"Range": "bytes=0-1023"}), timeout=30) as check:
                if check.status != 206 or not check.read(1024):
                    raise MediaError("range_check_failed")
        except (HTTPError, URLError, TimeoutError, OSError) as exc:
            raise MediaError("range_check_failed") from exc
        return public_url

    def remove_derivative(self, bucket: str, path: str):
        if (bucket not in SOURCE_BUCKETS or not path.startswith(f"optimized/{VERSION}/")
                or any(segment in ("", ".", "..") for segment in path.split("/"))
                or "\\" in path or "\x00" in path or path.rsplit("/", 1)[-1] not in ("video.mp4", "poster.jpg")):
            raise MediaError("invalid_cleanup_path")
        self.request("/storage/v1/object/" + quote(bucket, safe=""), {"prefixes": [path]}, method="DELETE")


def cleanup_jobs(client: Client, max_jobs: int, deadline: float):
    for _ in range(max_jobs):
        if time.monotonic() >= deadline:
            break
        job = client.rpc("claim_video_cleanup")
        if job is None:
            break
        success = False
        try:
            client.remove_derivative(job["bucket"], job["path"])
            success = True
        except MediaError:
            pass
        accepted = client.rpc("finish_video_cleanup", {"p_cleanup_id": job["id"], "p_lease_token": job["lease_token"], "p_success": success})
        print(json.dumps({"cleanup_job_id": job["id"], "deleted": success, "accepted": accepted}), flush=True)


def process(client: Client, job: dict) -> dict:
    bucket, _ = storage_source(job["source_url"], client.base)
    with tempfile.TemporaryDirectory(prefix="footnation-video-") as temporary:
        directory = Path(temporary)
        source = directory / "source.media"
        started = time.monotonic()
        client.download(job["source_url"], source)
        downloaded = time.monotonic()
        result = optimize(source, directory, job.get("needs_thumbnail", True))
        # Bind to source bytes and this lease. A later A→B→A source replacement
        # must not reuse a path already leased to a cleanup worker for deletion.
        digest = hashlib.sha256()
        digest.update((VERSION + "\n" + job["source_url"] + "\n" + job["lease_token"]).encode())
        with source.open("rb") as data:
            while chunk := data.read(1024 * 1024):
                digest.update(chunk)
        prefix = f"optimized/{VERSION}/{job['table_name']}/{job['record_id']}/{digest.hexdigest()}"
        video_url = client.upload(bucket, prefix + "/video.mp4", result["video"], "video/mp4") if result["video"] else None
        # The completion RPC preserves a thumbnail that the owner supplied meanwhile.
        poster_url = client.upload(bucket, prefix + "/poster.jpg", result["thumbnail"], "image/jpeg") if result["thumbnail"] else None
        result["stats"].update(download_seconds=round(downloaded - started, 3), processing_seconds=round(time.monotonic() - downloaded, 3))
        accepted = client.rpc("finish_video_optimization", {"p_job_id": job["id"], "p_lease_token": job["lease_token"],
            "p_outcome": "complete", "p_video_url": video_url, "p_thumbnail_url": poster_url, "p_result": result["stats"]})
        if not accepted:
            # Queue only through the RPC that proves this source has changed or
            # disappeared; it also refuses to remove an attached current object.
            paths = ([prefix + "/video.mp4"] if video_url else []) + ([prefix + "/poster.jpg"] if poster_url else [])
            if paths:
                client.rpc("enqueue_orphan_video_cleanup", {"p_table_name": job["table_name"], "p_record_id": job["record_id"],
                    "p_bucket": bucket, "p_paths": paths, "p_source_url": job["source_url"]})
        return {"job_id": job["id"], "accepted": accepted, **result["stats"]}


def load_env(path: str | None):
    if not path:
        return
    for raw in Path(path).read_text().splitlines():
        line = raw.strip()
        if line.startswith("export "):
            line = line[7:]
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"):
            os.environ.setdefault(key, value.strip().strip("\"'"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", help="Server-only credentials; contents are never printed")
    parser.add_argument("--max-jobs", type=int, default=3)
    parser.add_argument("--max-seconds", type=int, default=480)
    parser.add_argument("--poll-seconds", type=int, default=0, help="0 exits on an empty queue; >0 polls until deadline")
    parser.add_argument("--skip-cleanup", action="store_true", help="Initial migration rollout only: skip the cleanup RPCs")
    parser.add_argument("--local-input", type=Path, help="Offline validation: transcode one local file, no network/database")
    parser.add_argument("--local-output", type=Path)
    args = parser.parse_args()
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise MediaError("ffmpeg_missing")
    if args.local_input:
        if not args.local_output:
            parser.error("--local-output is required for --local-input")
        args.local_output.mkdir(parents=True, exist_ok=True)
        result = optimize(args.local_input, args.local_output)
        print(json.dumps(result["stats"]))
        return
    if not 1 <= args.max_jobs <= 100 or not 1 <= args.max_seconds <= 86400 or not 0 <= args.poll_seconds <= 3600:
        parser.error("Invalid worker bounds")
    load_env(args.env_file)
    if not os.environ.get("SUPABASE_URL") or not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        raise MediaError("server_credentials_missing")
    client = Client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    deadline = time.monotonic() + args.max_seconds
    if not args.skip_cleanup:
        cleanup_jobs(client, 6, deadline)
    count = 0
    while count < args.max_jobs and time.monotonic() < deadline:
        job = client.rpc("claim_video_optimization")
        if job is None:
            if not args.poll_seconds:
                break
            time.sleep(min(args.poll_seconds, max(0, deadline - time.monotonic())))
            continue
        count += 1
        try:
            print(json.dumps(process(client, job)), flush=True)
        except MediaError as exc:
            code = str(exc)
            terminal = code in ("unsupported_source", "media_limits", "invalid_media", "download_limits")
            client.rpc("finish_video_optimization", {"p_job_id": job["id"], "p_lease_token": job["lease_token"],
                "p_outcome": "skipped" if terminal else "retry", "p_error_code": code})
            print(json.dumps({"job_id": job["id"], "error_code": code, "retry": not terminal}), flush=True)
    print(json.dumps({"processed_jobs": count}), flush=True)
    if not args.skip_cleanup:
        cleanup_jobs(client, 6, deadline)


if __name__ == "__main__":
    try:
        main()
    except MediaError as error:
        print(json.dumps({"error_code": str(error)}), flush=True)
        raise SystemExit(1)
