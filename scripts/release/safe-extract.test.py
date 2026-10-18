import importlib.util
import io
import pathlib
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("safe_extract", pathlib.Path(__file__).with_name("safe-extract.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SafeExtractionTest(unittest.TestCase):
    def archive(self, root, entries):
        archive = root / "input.tar.gz"
        with tarfile.open(archive, "w:gz") as bundle:
            for name, kind in entries:
                member = tarfile.TarInfo(name)
                if kind == "link":
                    member.type = tarfile.SYMTYPE
                    member.linkname = "../../outside"
                    bundle.addfile(member)
                else:
                    member.size = 4
                    bundle.addfile(member, io.BytesIO(b"test"))
        return archive

    def test_safe_source_and_signing_contract(self):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp)
            archive = self.archive(root, [("./package.json", "file"), ("release-private/signing.json", "file"), ("app/index.tsx", "file")])
            module.extract(archive, root / "out")
            self.assertEqual((root / "out/package.json").read_bytes(), b"test")

    def test_unsafe_paths_links_duplicates_and_credentials_are_rejected(self):
        cases = [
            [("../outside", "file")], [("/outside", "file")], [("app\\..\\outside", "file")],
            [("link", "link")], [("app/index.tsx", "file"), ("./app/index.tsx", "file")],
            [("credentials.json", "file")], [(".env.production", "file")],
            [("release-private/extra.p8", "file")], [("node_modules/index.js", "file")],
        ]
        for entries in cases:
            with self.subTest(entries=entries), tempfile.TemporaryDirectory() as temp:
                root = pathlib.Path(temp)
                archive = self.archive(root, entries)
                with self.assertRaises(ValueError):
                    module.extract(archive, root / "out")
                self.assertEqual(list((root / "out").iterdir()), [])


if __name__ == "__main__":
    unittest.main()
