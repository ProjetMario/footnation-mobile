"""Extract a screenshot snapshot without signing assets, links or escaping paths."""
import pathlib
import sys
import tarfile


def extract(archive, destination):
    root = pathlib.Path(destination)
    root.mkdir(mode=0o700, parents=True, exist_ok=False)
    seen = set()
    total = 0
    private_files = {"build-env.json", "demo.json"}
    with tarfile.open(archive, "r:gz") as bundle:
        members = bundle.getmembers()
        if len(members) > 100000:
            raise ValueError("Too many archive entries")
        for member in members:
            name = pathlib.PurePosixPath(member.name)
            if str(name) == "." and member.isdir():
                continue
            if name.is_absolute() or ".." in name.parts or "\\" in member.name or not name.parts:
                raise ValueError("Unsafe archive path")
            if str(name) in seen or not (member.isfile() or member.isdir()):
                raise ValueError("Duplicate or unsupported archive entry")
            seen.add(str(name))
            if name.parts[0] in {".git", "node_modules", "ios", "android", "credentials", "dist"}:
                raise ValueError("Unexpected generated/private directory")
            if name.parts[0] == "release-private":
                if not member.isdir() and (len(name.parts) != 2 or name.parts[1] not in private_files):
                    raise ValueError("Unexpected signing payload")
            elif name.name == "credentials.json" or name.name.startswith(".env") or name.suffix in {".p12", ".mobileprovision", ".jks", ".keystore", ".p8"}:
                raise ValueError("Unexpected credential outside the private payload")
            total += member.size
            if member.size < 0 or total > 1024 * 1024 * 1024:
                raise ValueError("Archive exceeds size limit")
        for member in members:
            target = root / member.name
            if member.isdir():
                target.mkdir(mode=0o700, parents=True, exist_ok=True)
            else:
                target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
                with bundle.extractfile(member) as source, target.open("xb") as output:
                    while chunk := source.read(1024 * 1024):
                        output.write(chunk)
                target.chmod(0o700 if member.mode & 0o111 else 0o600)


if __name__ == "__main__":
    try:
        extract(sys.argv[1], sys.argv[2])
    except Exception:
        sys.exit("Authenticated release extraction failed.")
