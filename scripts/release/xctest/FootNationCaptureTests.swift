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

    }

    private func wait(_ seconds: TimeInterval) {
        RunLoop.current.run(until: Date().addingTimeInterval(seconds))
    }

    @discardableResult
    private func dismissPasswordSavePrompt() -> Bool {
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for context in [springboard, app] {
            let alert = context.alerts.firstMatch
            let passwordTitle = NSPredicate(format: "label CONTAINS[c] 'Save Password' OR label CONTAINS[c] 'mot de passe'")
            let matches = alert.exists && (passwordTitle.evaluate(with: alert)
                || alert.staticTexts.matching(passwordTitle).count > 0)
            let exactTitle = context.staticTexts.matching(NSPredicate(format: "label IN %@", ["Save Password?", "Enregistrer le mot de passe ?", "Enregistrer ce mot de passe ?"])).firstMatch
            let isObservedSheet = exactTitle.exists && exactTitle.isHittable
            guard matches || isObservedSheet else { continue }
            for label in ["Not Now", "Pas maintenant", "Plus tard"] {
                let button = (matches ? alert.buttons : context.buttons)[label].firstMatch
                if button.exists && button.isHittable {
                    // Decline only this observed native password-save prompt.
                    // Never select Save or any sharing action.
                    button.tap()
                    wait(1)
                    return true
                }
            }
        }
        return false
    }

    private func passwordSavePromptVisible() -> Bool {
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let title = NSPredicate(format: "label CONTAINS[c] 'Save Password' OR label CONTAINS[c] 'mot de passe'")
        for context in [springboard, app] {
            let alert = context.alerts.firstMatch
            if alert.exists && (title.evaluate(with: alert) || alert.staticTexts.matching(title).count > 0) { return true }
            let exactTitle = context.staticTexts.matching(NSPredicate(format: "label IN %@", ["Save Password?", "Enregistrer le mot de passe ?", "Enregistrer ce mot de passe ?"])).firstMatch
            if exactTitle.exists && exactTitle.isHittable { return true }
        }
        return false
    }

    private func clearPasswordPromptBeforeNavigation() {
        let deadline = Date().addingTimeInterval(12)
        var absentSince: Date? = nil
        repeat {
            dismissPasswordSavePrompt()
            if passwordSavePromptVisible() { absentSince = nil }
            else {
                if absentSince == nil { absentSince = Date() }
                if Date().timeIntervalSince(absentSince!) >= 0.7 { return }
            }
            wait(0.3)
        } while Date() < deadline
        XCTFail("Native password-save prompt did not close before navigation")
    }

    private func open(_ route: String) {
        // All navigation is ordinary UI interaction. No URL opening, host IPC,
        // authentication storage writes, app changes or generated screenshots.
        let allowed = ["login?next=%2Fsearch", "home", "search", "clubs", "matches", "opportunities", "my-profile", "matching"]
        guard allowed.contains(route) else { XCTFail("Unsupported UI capture destination"); return }

        app.activate()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 30), "Installed app did not become foreground")
        clearPasswordPromptBeforeNavigation()
        XCTAssertFalse(app.alerts.firstMatch.exists || XCUIApplication(bundleIdentifier: "com.apple.springboard").alerts.firstMatch.exists, "An unknown native alert blocks navigation")
        dismissInvitations()

        func control(_ labels: [String], bottomOnly: Bool = false, topOnly: Bool = false) -> XCUIElement? {
            let predicate = NSPredicate(format: "label IN %@", labels)
            for query in [app.buttons, app.links, app.otherElements] {
                let matches = query.matching(predicate).allElementsBoundByIndex
                for candidate in matches.prefix(15) where candidate.exists && candidate.isHittable {
                    let frame = candidate.frame
                    if bottomOnly && frame.midY < app.frame.minY + app.frame.height * 0.68 { continue }
                    if topOnly && frame.midY > app.frame.minY + app.frame.height * 0.45 { continue }
                    return candidate
                }
            }
            return nil
        }

        @discardableResult
        func tap(_ labels: [String], bottomOnly: Bool = false, topOnly: Bool = false) -> Bool {
            guard let element = control(labels, bottomOnly: bottomOnly, topOnly: topOnly) else { return false }
            element.tap()
            wait(1.5)
            return true
        }

        @discardableResult
        func home() -> Bool {
            for _ in 0..<5 {
                dismissInvitations()
                if tap(["Accueil", "Home"], bottomOnly: true) { return true }
                if tap(["Retour"], topOnly: true) { continue }
                wait(1)
            }
            return false
        }

        if route == "login?next=%2Fsearch" {
            // Normal landing navigation intentionally has no synthetic `next`.
            // The app's normal successful-login destination is Shorts; the
            // subsequent profile proof uses the real bottom tab from there.
            let deadline = Date().addingTimeInterval(35)
            while Date() < deadline {
                let email = app.textFields["Adresse e-mail"].firstMatch
                let password = app.secureTextFields["Mot de passe"].firstMatch
                if email.exists && password.exists { return }
                if tap(["Se connecter", "Log in", "Se connecter à FootNation"]) {
                    wait(2)
                    continue
                }
                app.swipeUp()
                wait(1)
            }
            XCTFail("Native login controls were not reachable from the landing page")
            return
        }

        dismissInvitations()
        if route == "home" {
            XCTAssertTrue(home(), "Home tab was not reachable through the native UI")
            return
        }
        if route == "my-profile" || route == "search" {
            let labels = route == "my-profile" ? ["Mon profil", "My profile"] : ["Rechercher", "Search"]
            if tap(labels, bottomOnly: true) { return }
            guard home() else { XCTFail("Could not return to the native tab bar"); return }
            XCTAssertTrue(tap(labels, bottomOnly: true), "Required native bottom tab was unavailable")
            return
        }

        guard home() else { XCTFail("Could not reach home before selecting its navigation tab"); return }
        let labels: [String]
        switch route {
        case "clubs": labels = ["Clubs"]
        case "matches": labels = ["Matches"] // Exact native FR and EN label.
        case "opportunities": labels = ["Opportunités", "Opportunities"]
        case "matching": labels = ["Matching"]
        default: XCTFail("Unknown native navigation tab"); return
        }

        let railPredicate = NSPredicate(format: "label IN %@", ["Navigation de l’accueil", "Home navigation"])
        let deadline = Date().addingTimeInterval(35)
        var attempt = 0
        while Date() < deadline && attempt < 10 {
            if tap(labels, topOnly: true) { return }
            let rail = app.descendants(matching: .any).matching(railPredicate).firstMatch
            guard rail.exists && rail.isHittable else {
                XCTFail("Home navigation rail was not exposed by native accessibility")
                return
            }
            // The actual labelled horizontal rail supplies the gesture frame.
            // Reverse after four swipes so a retained offset cannot hide a tab.
            let forward = attempt % 8 < 4
            let start = rail.coordinate(withNormalizedOffset: CGVector(dx: forward ? 0.88 : 0.12, dy: 0.5))
            let end = rail.coordinate(withNormalizedOffset: CGVector(dx: forward ? 0.12 : 0.88, dy: 0.5))
            start.press(forDuration: 0.1, thenDragTo: end)
            attempt += 1
            wait(0.6)
        }
        XCTFail("Required home navigation button remained outside the accessible viewport")
    }


    private func dismissInvitations() {
        dismissPasswordSavePrompt()
        for label in ["Fermer l’invitation", "Plus tard", "Close invitation", "Later"] {
            let button = app.buttons[label].firstMatch
            if button.exists && button.isHittable { button.tap(); wait(1) }
        }
    }

    private func profileVisible() -> Bool {
        let profile = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", profileName)).firstMatch
        return profile.exists && profile.isHittable
    }

    private func requireProfile() {
        dismissInvitations()
        open("my-profile")
        let deadline = Date().addingTimeInterval(65)
        repeat {
            dismissInvitations()
            if profileVisible() {
                wait(1)
                dismissInvitations()
                let system = XCUIApplication(bundleIdentifier: "com.apple.springboard")
                if profileVisible() && !app.alerts.firstMatch.exists && !system.alerts.firstMatch.exists { return }
            }
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
        dismissInvitations()
        let system = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        XCTAssertFalse(passwordSavePromptVisible() || app.alerts.firstMatch.exists || system.alerts.firstMatch.exists, "An unresolved native alert covers the screenshot")
        let invitation = app.buttons.matching(NSPredicate(format: "label IN %@", ["Fermer l’invitation", "Close invitation"])).firstMatch
        XCTAssertFalse(invitation.exists && invitation.isHittable, "An invitation covers the screenshot")
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
            ("06-profil", "my-profile"), ("02-recherche", "search"),
            ("03-clubs", "clubs"), ("01-accueil", "home")
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
