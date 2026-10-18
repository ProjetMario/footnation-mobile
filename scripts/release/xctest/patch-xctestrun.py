import plistlib, sys
source, output, mode, locale, device = sys.argv[1:]
assert mode in ('login', 'capture') and locale in ('fr-FR', 'en-US') and device in ('iphone', 'ipad')
with open(source, 'rb') as f:
    data = plistlib.load(f)
targets = []
if 'TestConfigurations' in data:
    for configuration in data['TestConfigurations']:
        targets.extend(configuration.get('TestTargets', []))
else:
    targets = [v for k, v in data.items() if k != '__xctestrun_metadata__' and isinstance(v, dict) and 'TestBundlePath' in v]
assert len(targets) == 1, 'Expected one standalone UI-test target'
target = targets[0]
assert target.get('IsUITestBundle'), 'Expected UI test runner'
target.setdefault('EnvironmentVariables', {}).update({'FN_CAPTURE_LOCALE': locale, 'FN_CAPTURE_DEVICE': device})
# UI test bundle is not bound to an app build. Explicit bundleIdentifier in Swift
# launches the existing installed Release app, as supported by XCUIApplication.
target['OnlyTestIdentifiers'] = ['FootNationCaptureTests/testAuthenticate' if mode == 'login' else 'FootNationCaptureTests/testCapture']
target['UITargetAppBundleIdentifier'] = 'com.footnation.app'
target.pop('UITargetAppPath', None)
target['SystemAttachmentLifetime'] = 'keepNever'
target['UserAttachmentLifetime'] = 'keepNever'
with open(output, 'wb') as f:
    plistlib.dump(data, f)
