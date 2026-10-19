import XCTest
import UIKit

// This runner controls the already installed Release app. It has no application
// source dependency, authentication shortcut, or synthetic content.
@MainActor
final class FootNationCaptureTests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "com.footnation.app")
    private let profileName = "Démo FootNation"

    override func setUpWithError() throws {
        continueAfterFailure = false
        executionTimeAllowance = 420
        addUIInterruptionMonitor(withDescription: "Open the installed FootNation app") { alert in
            guard alert.label.localizedCaseInsensitiveContains("FootNation") || alert.staticTexts.containing(NSPredicate(format: "label CONTAINS[c] 'FootNation'")).count > 0 else { return false }
            for label in ["Open", "Ouvrir"] {
                let button = alert.buttons[label]
                if button.exists { button.tap(); return true }
            }
            return false
        }
    }

    private func wait(_ seconds: TimeInterval) {
        RunLoop.current.run(until: Date().addingTimeInterval(seconds))
    }

    @discardableResult
    private func handleFootNationPrompt() -> Bool {
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        let runner = XCUIApplication(bundleIdentifier: "com.footnation.captureUITests.xctrunner")
        var contexts = [springboard]
        for context in [safari, runner] where context.state == .runningForeground {
            contexts.append(context)
        }
        for context in contexts {
            let alert = context.alerts.firstMatch
            guard alert.exists else { continue }
            let isFootNation = alert.label.localizedCaseInsensitiveContains("FootNation")
                || alert.staticTexts.containing(NSPredicate(format: "label CONTAINS[c] 'FootNation'")).count > 0
            guard isFootNation else { continue }
            for label in ["Open", "Ouvrir"] {
                let button = alert.buttons[label]
                if button.exists && button.isHittable { button.tap(); return true }
            }
            // A matching prompt may still be animating: do not treat it as closed.
            return true
        }
        return false
    }

    private func open(_ route: String) {
        // The trusted host opens this allowlisted route with simctl. UIKit URL
        // opening from the unsigned test runner is intentionally not attempted.
        // No application code, authentication state or signing trust is changed.
        if handleFootNationPrompt() { wait(1) }
        let folder = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("FootNationCaptureControl", isDirectory: true)
        let requestId = UUID().uuidString
        let began = Date()
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let payload: [String: Any] = ["id": requestId, "route": route, "createdAt": began.timeIntervalSince1970 * 1000]
            try JSONSerialization.data(withJSONObject: payload).write(to: folder.appendingPathComponent("request.json"), options: .atomic)
        } catch { XCTFail("Could not request native host navigation"); return }
        var opened: Bool? = nil
        var lastPrompt = began
        let deadline = began.addingTimeInterval(45)
        while Date() < deadline {
            let promptPresent = handleFootNationPrompt()
            if promptPresent { lastPrompt = Date() }
            if let data = try? Data(contentsOf: folder.appendingPathComponent("response.json")),
               let response = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               response["id"] as? String == requestId {
                opened = response["opened"] as? Bool
            }
            if opened == false { XCTFail("The host could not open the approved FootNation route"); return }
            if opened == true && !promptPresent
                && Date().timeIntervalSince(began) >= 4
                && Date().timeIntervalSince(lastPrompt) >= 2
                && app.state == .runningForeground { return }
            wait(0.3)
        }
        XCTFail("FootNation route did not open after its system confirmation")
    }

    private func dismissInvitations() {
        for label in ["Fermer l’invitation", "Plus tard", "Close invitation", "Later"] {
            let button = app.buttons[label].firstMatch
            if button.exists && button.isHittable { button.tap(); wait(1) }
        }
    }

    private func profileVisible() -> Bool {
        let profile = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", profileName)).firstMatch
        return profile.exists
    }

    private func requireProfile() {
        open("my-profile")
        let deadline = Date().addingTimeInterval(65)
        repeat {
            dismissInvitations()
            if profileVisible() { return }
            wait(2)
        } while Date() < deadline
        XCTFail("Authenticated demo profile was not visible")
    }

    private func reveal(_ field: XCUIElement) {
        let deadline = Date().addingTimeInterval(30)
        while Date() < deadline {
            if field.exists && field.isHittable { return }
            let scroll = app.scrollViews.firstMatch
            guard scroll.exists else {
                XCTFail("Login scroll content was not exposed by native accessibility")
                return
            }
            let appFrame = app.frame
            var safe = scroll.frame.intersection(appFrame).insetBy(dx: 16, dy: 16)
            let keyboard = app.keyboards.firstMatch
            if keyboard.exists {
                // Conservatively stay above even a floating iPad keyboard.
                // Never start a scroll gesture inside any keyboard rectangle.
                let keyboardTop = keyboard.frame.minY
                safe.size.height = max(0, min(safe.maxY, keyboardTop - 16) - safe.minY)
            }
            guard !safe.isNull && safe.width >= 64 && safe.height >= 96 else {
                XCTFail("No safe scroll area remains above the native keyboard")
                return
            }
            let fieldFrame = field.exists ? field.frame : CGRect.null
            let targetAbove = !fieldFrame.isNull && !fieldFrame.isEmpty && fieldFrame.maxY < safe.minY
            let travel = min(CGFloat(180), safe.height * 0.6)
            let fromY = targetAbove ? safe.minY + 12 : safe.maxY - 12
            let toY = targetAbove ? fromY + travel : fromY - travel
            let origin = app.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0))
            let start = origin.withOffset(CGVector(dx: safe.midX - appFrame.minX, dy: fromY - appFrame.minY))
            let end = origin.withOffset(CGVector(dx: safe.midX - appFrame.minX, dy: toY - appFrame.minY))
            start.press(forDuration: 0.05, thenDragTo: end)
            wait(1)
        }
        XCTFail("Required login field is not reachable")
    }

    private func paste(_ value: String, into field: XCUIElement, advanceToPassword: Bool = false) {
        reveal(field)
        field.tap()
        wait(0.6)
        // Focusing can raise the keyboard and move the input. Re-evaluate its
        // visibility before the long press; reveal clips gestures above it.
        reveal(field)
        // Do not typeText(secret): XCTest activity logs include its argument.
        // This is an ordinary system clipboard/UI paste into the real TextInput.
        UIPasteboard.general.setItems([["public.utf8-plain-text": value]], options: [
            .localOnly: true, .expirationDate: Date().addingTimeInterval(45)
        ])
        defer { UIPasteboard.general.items = [] }
        field.press(forDuration: 1.2)
        let pastePredicate = NSPredicate(format: "label IN %@", ["Paste", "Coller"])
        var pasted = false
        for _ in 0..<3 {
            let menuItem = app.menuItems.matching(pastePredicate).firstMatch
            let button = app.buttons.matching(pastePredicate).firstMatch
            if menuItem.exists && menuItem.isHittable { menuItem.tap(); pasted = true; break }
            if button.exists && button.isHittable { button.tap(); pasted = true; break }
            wait(1)
        }
        XCTAssertTrue(pasted, "System Paste action was unavailable")
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for context in [springboard, app] {
            for label in ["Allow Paste", "Autoriser le collage", "Autoriser à coller"] {
                let button = context.buttons[label].firstMatch
                if button.exists && button.isHittable { button.tap() }
            }
        }
        wait(1)
        // Only the boolean is logged. Never include a field value in assertions.
        let hasInput = (field.value as? String).map { !$0.isEmpty && $0 != "joueur@example.com" } ?? false
        XCTAssertTrue(hasInput, "Input did not accept the UI paste")
        UIPasteboard.general.items = []
        if advanceToPassword && app.keyboards.firstMatch.exists {
            // The released TextInput explicitly uses returnKeyType="next" and
            // focuses passwordRef in onSubmitEditing. Only a newline is typed
            // as a fallback: credentials are never arguments to typeText.
            let next = app.keyboards.firstMatch.buttons.matching(
                NSPredicate(format: "label IN %@", ["Next", "next", "Suivant", "suivant"])
            ).firstMatch
            if next.exists && next.isHittable { next.tap() }
            else { field.typeText("\n") }
            wait(1)
        }
    }

    func testAuthenticate() throws {
        let bundle = Bundle(for: FootNationCaptureTests.self)
        guard let url = bundle.url(forResource: "private-demo", withExtension: "json"),
              let object = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any],
              let email = object["email"] as? String, !email.isEmpty,
              let password = object["password"] as? String, !password.isEmpty else {
            XCTFail("Private demo credential resource is missing"); return
        }
        open("login?next=%2Fsearch")
        wait(8)
        dismissInvitations()
        let emailField = app.textFields["Adresse e-mail"].firstMatch
        let passwordField = app.secureTextFields["Mot de passe"].firstMatch
        paste(email, into: emailField, advanceToPassword: true)
        paste(password, into: passwordField)
        let submit = app.buttons["Se connecter"].firstMatch
        if submit.exists && submit.isHittable {
            submit.tap()
        } else {
            // Submit through the real password TextInput's return handler.
            passwordField.typeText("\n")
        }
        wait(10)
        requireProfile()
        try saveCapture("authenticated-profile.png")
    }

    private func saveCapture(_ fileName: String) throws {
        let folder = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("FootNationNativeCaptures", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try XCUIScreen.main.screenshot().pngRepresentation.write(to: folder.appendingPathComponent(fileName), options: .atomic)
    }

    func testCapture() throws {
        let env = ProcessInfo.processInfo.environment
        guard let locale = env["FN_CAPTURE_LOCALE"], ["fr-FR", "en-US"].contains(locale),
              let device = env["FN_CAPTURE_DEVICE"], ["iphone", "ipad"].contains(device) else {
            XCTFail("Capture locale/device is missing"); return
        }
        requireProfile()
        let routes = [
            ("01-accueil", "home"), ("02-recherche", "search"),
            ("03-clubs", "clubs"), ("04-matchs", "matches"),
            ("05-opportunites", "opportunities"), ("06-profil", "my-profile"),
            ("07-matching", "matching")
        ]
        for (name, route) in routes {
            open(route)
            wait(18)
            dismissInvitations()
            wait(3)
            XCTAssertTrue(app.state == .runningForeground, "App left foreground before screenshot")
            // This is a genuine device framebuffer. Human review remains required
            // for asynchronous content errors, localization and empty states.
            try saveCapture(locale + "-" + device + "-" + name + ".png")
        }
    }
}
