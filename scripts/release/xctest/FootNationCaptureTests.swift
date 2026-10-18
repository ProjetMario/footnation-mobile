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

    private func open(_ route: String) {
        app.open(URL(string: "footnation://" + route)!)
        for context in [XCUIApplication(bundleIdentifier: "com.apple.springboard"), XCUIApplication(bundleIdentifier: "com.apple.mobilesafari"), app] {
            let alert = context.alerts.firstMatch
            if alert.exists {
                for label in ["Open", "Ouvrir"] {
                    let button = alert.buttons[label]
                    if button.exists && button.isHittable { button.tap() }
                }
            }
        }
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 30), "App did not become foreground")
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
            // Gesture on the content, not the navigation bar or keyboard.
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.75, dy: 0.72))
                .press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.75, dy: 0.35)))
            wait(1)
        }
        XCTFail("Required login field is not reachable")
    }

    private func paste(_ value: String, into field: XCUIElement) {
        reveal(field)
        field.tap()
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
        for context in [app, springboard] {
            for label in ["Allow Paste", "Autoriser le collage", "Autoriser à coller"] {
                let button = context.buttons[label].firstMatch
                if button.exists && button.isHittable { button.tap() }
            }
        }
        wait(1)
        // Only the boolean is logged. Never include a field value in assertions.
        let hasInput = (field.value as? String).map { !$0.isEmpty && $0 != "joueur@example.com" } ?? false
        XCTAssertTrue(hasInput, "Input did not accept the UI paste")
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
        paste(email, into: emailField)
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
