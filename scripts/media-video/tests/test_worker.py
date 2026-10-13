import importlib.util
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import time

spec = importlib.util.spec_from_file_location("worker", Path(__file__).parents[1] / "worker.py")
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class WorkerTests(unittest.TestCase):
    def test_storage_sources_are_same_project_and_known_public_buckets(self):
        base = "https://project.supabase.co"
        self.assertEqual(worker.storage_source(base + "/storage/v1/object/public/shorts/u/file%20name.mp4", base), ("shorts", "u/file name.mp4"))
        for url in ("http://project.supabase.co/storage/v1/object/public/shorts/a.mp4",
                    "https://evil.example/storage/v1/object/public/shorts/a.mp4",
                    base + "/storage/v1/object/public/private/a.mp4",
                    base + "/storage/v1/object/public/shorts/../a.mp4",
                    base + "/storage/v1/object/public/shorts/%2E%2E/a.mp4",
                    base + "/storage/v1/object/public/shorts/a.mp4?token=secret"):
            with self.subTest(url=url), self.assertRaises(worker.MediaError):
                worker.storage_source(url, base)

    def test_dimensions_never_upscale_and_preserve_portrait_landscape(self):
        for original, expected in [((1920, 1080), (1280, 720)), ((1080, 1920), (720, 1280)),
                                   ((480, 640), (480, 640)), ((2000, 2000), (720, 720)),
                                   ((3840, 1080), (1280, 360)), ((641, 481), (640, 480))]:
            self.assertEqual(worker.target_size(*original), expected)

    def test_mp4_atom_parser_ignores_moov_inside_media(self):
        with tempfile.TemporaryDirectory() as temporary:
            file = Path(temporary) / "a.mp4"
            file.write_bytes(struct.pack(">I4s", 16, b"mdat") + b"moovxxxx")
            self.assertFalse(worker.is_faststart(file))
            file.write_bytes(struct.pack(">I4s", 12, b"ftyp") + b"abcd" + struct.pack(">I4s", 8, b"moov"))
            self.assertTrue(worker.is_faststart(file))

    def test_cleanup_rejects_any_original_or_external_namespace(self):
        client = worker.Client("https://project.supabase.co", "test-not-a-secret")
        with patch.object(client, "request") as request:
            for bucket, path in (("shorts", "user/original.mp4"), ("private", "optimized/mobile-720-v1/posts/id/hash/video.mp4"),
                                 ("shorts", "optimized/mobile-720-v1/../original.mp4")):
                with self.assertRaises(worker.MediaError):
                    client.remove_derivative(bucket, path)
            request.assert_not_called()
            client.remove_derivative("shorts", "optimized/mobile-720-v1/posts/id/hash/video.mp4")
            request.assert_called_once_with("/storage/v1/object/shorts", {"prefixes": ["optimized/mobile-720-v1/posts/id/hash/video.mp4"]}, method="DELETE")

    def test_cleanup_acks_only_successful_deletion(self):
        client = worker.Client("https://project.supabase.co", "test-not-a-secret")
        job = {"id": "id", "lease_token": "lease", "bucket": "shorts", "path": "optimized/mobile-720-v1/posts/id/hash/video.mp4"}
        with patch.object(client, "rpc", side_effect=[job, True, None]) as rpc, patch.object(client, "remove_derivative", side_effect=worker.MediaError("network")), patch("builtins.print"):
            worker.cleanup_jobs(client, 3, time.monotonic() + 10)
            self.assertEqual(rpc.call_args_list[1].args, ("finish_video_cleanup", {"p_cleanup_id": "id", "p_lease_token": "lease", "p_success": False}))

    @unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpeg required")
    def test_real_ffmpeg_derivative_is_smaller_compatible_faststart_with_thumbnail(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            source = directory / "source.mp4"
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=1080x1920:rate=30",
                            "-f", "lavfi", "-i", "sine=frequency=440", "-t", "1", "-c:v", "libx264", "-crf", "12",
                            "-preset", "ultrafast", "-c:a", "aac", "-threads", "2", str(source)], check=True)
            original = source.read_bytes()
            result = worker.optimize(source, directory)
            self.assertIsNotNone(result["video"])
            info = worker.probe(result["video"])
            self.assertEqual((info["width"], info["height"]), (720, 1280))
            self.assertEqual(info["video"]["codec_name"], "h264")
            self.assertEqual(info["audio"]["codec_name"], "aac")
            self.assertTrue(worker.is_faststart(result["video"]))
            self.assertLess(result["video"].stat().st_size, len(original))
            self.assertGreater(result["thumbnail"].stat().st_size, 100)
            self.assertEqual(source.read_bytes(), original)

    @unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpeg required")
    def test_full_range_rotated_iphone_video_becomes_limited_range_yuv420p(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            raw = directory / "raw.mp4"
            source = directory / "rotated.mp4"
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=360x640:rate=30",
                            "-t", "1", "-vf", "scale=out_range=pc", "-c:v", "libx264", "-crf", "12",
                            "-color_range", "pc", "-threads", "2", str(raw)], check=True)
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-display_rotation:v:0", "90", "-i", str(raw),
                            "-c", "copy", str(source)], check=True)
            self.assertEqual(worker.probe(source)["video"]["pix_fmt"], "yuvj420p")
            result = worker.optimize(source, directory)
            self.assertIsNotNone(result["video"])
            output = worker.probe(result["video"])
            self.assertEqual(output["video"]["pix_fmt"], "yuv420p")
            # Some FFmpeg versions omit the default limited-range VUI field.
            self.assertIn(output["video"].get("color_range"), (None, "tv"))
            self.assertEqual((output["width"], output["height"]), (640, 360))

    @unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpeg required")
    def test_small_silent_clip_keeps_original_when_transcoding_is_larger(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            source = directory / "tiny.mp4"
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=black:size=160x90:rate=1",
                            "-t", "1", "-c:v", "libx264", "-crf", "40", "-movflags", "+faststart", str(source)], check=True)
            result = worker.optimize(source, directory)
            self.assertIsNone(result["video"])
            self.assertTrue(result["stats"]["kept_original"])
            self.assertEqual(worker.probe(directory / "mobile.mp4")["audio"], None)


if __name__ == "__main__":
    unittest.main()
