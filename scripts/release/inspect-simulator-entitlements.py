"""Read and verify standard Xcode simulator entitlements without changing a binary."""
import hashlib
import json
import pathlib
import plistlib
import struct
import subprocess
import sys

app = pathlib.Path(sys.argv[1])
team = sys.argv[2]
info = plistlib.loads((app / 'Info.plist').read_bytes())
assert info['CFBundleIdentifier'] == 'com.footnation.app'
assert info['CFBundleShortVersionString'] == '1.0.4' and info['CFBundleVersion'] == '16'
assert 'iPhoneSimulator' in info['CFBundleSupportedPlatforms']
assert len(team) == 10 and team.isalnum()
data = (app / info['CFBundleExecutable']).read_bytes()
assert data[:4] == bytes.fromhex('cffaedfe')
assert struct.unpack_from('<I', data, 4)[0] == 0x0100000c
sections = {}
offset = 32
for _ in range(struct.unpack_from('<I', data, 16)[0]):
    command, size = struct.unpack_from('<II', data, offset)
    assert size >= 8 and offset + size <= len(data)
    if command == 0x19:
        segment = data[offset + 8:offset + 24].split(b'\0')[0].decode()
        for index in range(struct.unpack_from('<I', data, offset + 64)[0]):
            section = offset + 72 + index * 80
            name = data[section:section + 16].split(b'\0')[0].decode()
            length = struct.unpack_from('<Q', data, section + 40)[0]
            start = struct.unpack_from('<I', data, section + 48)[0]
            if segment == '__TEXT' and name in ('__entitlements', '__ents_der'):
                assert length > 0 and start + length <= len(data)
                sections[name] = data[start:start + length]
    offset += size
assert '__entitlements' in sections and '__ents_der' in sections, 'Missing standard Xcode simulated entitlement sections'
entitlements = plistlib.loads(sections['__entitlements'].rstrip(b'\0'))
identity = team + '.com.footnation.app'
assert entitlements.get('application-identifier') == identity
assert entitlements.get('com.apple.developer.team-identifier') == team
if 'keychain-access-groups' in entitlements:
    assert identity in entitlements['keychain-access-groups']
verified = subprocess.run(['codesign', '--verify', '--strict', str(app)], capture_output=True)
assert verified.returncode == 0, 'Simulator bundle signature verification failed'
signature = subprocess.run(['codesign', '--display', '--verbose=4', str(app)], capture_output=True, text=True)
assert signature.returncode == 0 and 'Signature=adhoc' in signature.stderr, 'Expected the normal simulator ad-hoc identity'
print(json.dumps({
    'method': 'Standard Xcode simulator packaging; no post-build signature modification',
    'applicationIdentifier': identity,
    'signature': 'adhoc', 'signatureVerified': True,
    'simulatedEntitlements': entitlements,
    'sections': {name: {'size': len(value), 'sha256': hashlib.sha256(value).hexdigest()} for name, value in sections.items()},
    'nativeExecutableSha256': hashlib.sha256(data).hexdigest(),
    'javascriptBundleSha256': hashlib.sha256((app / 'main.jsbundle').read_bytes()).hexdigest()
}))
