import XCTest
import UIKit
import Vision

// This runner controls the already installed Release app. It has no application
// source dependency, authentication shortcut, or synthetic content.
@MainActor
final class FootNationCaptureTests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "com.footnation.app")
    private let profileName = "Démo FootNation"
    private var passwordPromptMayBePending = false

    override func setUpWithError() throws {
        continueAfterFailure = false
        executionTimeAllowance = 420
        // The iOS 26 Passwords sheet is hosted by a separate system process.
        // Let XCTest resolve the actual interrupting element before inspecting
        // the application tree, which can otherwise time out on that process.
        addUIInterruptionMonitor(withDescription: "Decline saving the review password") { alert in
            let title = NSPredicate(format: "label CONTAINS[c] 'Save Password' OR label CONTAINS[c] 'mot de passe'")
            guard title.evaluate(with: alert) || alert.staticTexts.matching(title).firstMatch.exists else { return false }
            for label in ["Not Now", "Pas maintenant", "Plus tard"] {
                let decline = alert.buttons[label].firstMatch
                if decline.exists { decline.tap(); return true }
            }
            return false
        }
    }

    private func wait(_ seconds: TimeInterval) {
        RunLoop.current.run(until: Date().addingTimeInterval(seconds))
    }

    @discardableResult
    private func dismissPasswordSavePrompt() -> Bool {
        guard passwordPromptMayBePending else { return false }
        // iOS 26 can expose the Passwords sheet visually while its remote AX
        // process no longer answers queries. Recognize only the observed system
        // prompt and its explicit decline button in the current framebuffer.
        // This never guesses a coordinate or selects Save.
        if let image = XCUIScreen.main.screenshot().image.cgImage {
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.recognitionLanguages = ["en-US", "fr-FR"]
            if (try? VNImageRequestHandler(cgImage: image).perform([request])) != nil {
                let observations = request.results ?? []
                let normalized: (VNRecognizedTextObservation) -> String = {
                    ($0.topCandidates(1).first?.string ?? "").lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
                }
                let recognizedPrompt = observations.contains {
                    ["save password?", "save password ?", "enregistrer le mot de passe ?", "enregistrer ce mot de passe ?"].contains(normalized($0))
                }
                if recognizedPrompt, let decline = observations.first(where: {
                    ["not now", "pas maintenant", "plus tard"].contains(normalized($0))
                }) {
                    let box = decline.boundingBox
                    app.coordinate(withNormalizedOffset: CGVector(dx: box.midX, dy: 1 - box.midY)).tap()
                    wait(1)
                    return true
                }
            }
        }
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
        guard passwordPromptMayBePending else { return }
        let deadline = Date().addingTimeInterval(30)
        repeat {
            dismissPasswordSavePrompt()
            if !passwordSavePromptVisible() {
                passwordPromptMayBePending = false
                return
            }
            wait(0.3)
        } while Date() < deadline
        XCTFail("Native password-save prompt did not close before navigation")
    }

    private func open(_ route: String) {
        // All navigation is ordinary UI interaction. No URL opening, host IPC,
        // authentication storage writes, app changes or generated screenshots.
        let allowed = ["login?next=%2Fsearch", "home", "search", "shorts", "clubs", "matches", "opportunities", "my-profile", "matching"]
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
            var loginAttempts = 0
            while Date() < deadline {
                let email = app.textFields["Adresse e-mail"].firstMatch
                let password = app.secureTextFields["Mot de passe"].firstMatch
                if email.exists && password.exists { return }
                if let loginLink = control(["Se connecter", "Log in", "Se connecter à FootNation"]) {
                    if loginAttempts == 0 {
                        loginLink.tap()
                    } else if loginAttempts == 1 {
                        // Compare a normal tap with a brief deliberate press on
                        // the same observed control. No accessibility action or
                        // route injection bypasses the app's real touch path.
                        print("Landing touch diagnostic: frame \(loginLink.frame)")
                        loginLink.press(forDuration: 0.15)
                    } else if loginAttempts == 2 {
                        print("Landing hierarchy before scroll: \(app.debugDescription)")
                        app.swipeUp()
                    } else {
                        loginLink.tap()
                    }
                    loginAttempts += 1
                    wait(2)
                    continue
                }
                app.swipeUp()
                wait(1)
            }
            print("Landing hierarchy after touches: \(app.debugDescription)")
            XCTFail("Native login controls were not reachable from the landing page")
            return
        }

        dismissInvitations()
        if route == "home" {
            XCTAssertTrue(home(), "Home tab was not reachable through the native UI")
            return
        }
        if route == "my-profile" || route == "search" || route == "shorts" {
            let labels = route == "my-profile" ? ["Mon profil", "My profile"] : route == "shorts" ? ["Shorts"] : ["Rechercher", "Search"]
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
        if dismissPasswordSavePrompt() { return }
        // A dismissal can immediately replace the screen underneath. Avoid
        // querying stale modal descendants during that navigation transition.
        let invitation = app.buttons.matching(NSPredicate(format: "label IN %@", ["Fermer l’invitation", "Close invitation"])).firstMatch
        if invitation.exists && invitation.isHittable {
            invitation.tap(); wait(4); return
        }
        let welcome = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'Bienvenue' OR label BEGINSWITH 'Welcome' OR label BEGINSWITH 'Salut' OR label BEGINSWITH 'Hello' ")).firstMatch
        if welcome.exists {
            let close = app.buttons.matching(NSPredicate(format: "label IN %@", ["Fermer", "Close"])).firstMatch
            if close.exists && close.isHittable { close.tap(); wait(4); return }
            let later = app.buttons.matching(NSPredicate(format: "label IN %@", ["Plus tard", "Later"])).firstMatch
            if later.exists && later.isHittable { later.tap(); wait(4); return }
        }
    }

    private func profileVisible() -> Bool {
        let profile = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", profileName)).firstMatch
        return profile.exists && profile.isHittable
    }

    private func requireProfile() {
        // open activates the current app process before any accessibility query,
        // including after a normal language-change restart.
        open("my-profile")
        let deadline = Date().addingTimeInterval(65)
        repeat {
            dismissInvitations()
            // Closing the first-login presentation intentionally returns home.
            // Restore the requested destination after that real UI action.
            if !profileVisible() { open("my-profile") }
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
        passwordPromptMayBePending = true
        let submit = app.buttons["Se connecter"].firstMatch
        if submit.exists && submit.isHittable {
            submit.tap()
        } else {
            // Submit through the real password TextInput's return handler.
            passwordField.typeText("\n")
        }
        wait(10)
        // Dismiss only a recognized password prompt. A generic centre tap
        // would pause the first short and invalidate the later autoplay test.
        dismissPasswordSavePrompt()
        wait(2)
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

    private func requireTap(_ label: String, contains: Bool = false, scroll: Bool = false) {
        let predicate = NSPredicate(format: contains ? "label CONTAINS %@" : "label == %@", label)
        for attempt in 0..<(scroll ? 22 : 8) {
            let candidates = app.buttons.matching(predicate).allElementsBoundByIndex
            // A labelled backdrop may share the X button's close label. Its
            // centre is covered by the sheet, so prefer the compact control.
            if let button = candidates.filter({ $0.exists && $0.isHittable })
                .min(by: { $0.frame.width * $0.frame.height < $1.frame.width * $1.frame.height }) {
                button.tap()
                wait(1.5)
                return
            }
            if scroll && attempt > 0 { app.swipeUp(); wait(1) }
            else { wait(1) }
        }
        // Private, encrypted diagnostics distinguish a missing modal from a
        // changed accessibility label. No credentials are written here.
        let folder = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("FootNationNativeCaptures", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try? app.debugDescription.write(to: folder.appendingPathComponent("control-failure.txt"), atomically: true, encoding: .utf8)
        try? XCUIScreen.main.screenshot().pngRepresentation.write(to: folder.appendingPathComponent("control-failure.png"))
        XCTFail("Native control did not respond: " + label)
    }

    func testHeaderControls() throws {
        open("home")
        // Repeated modal/tab transitions exercise the iOS hit-testing regression.
        // Nothing is liked, published, sent to another person, or commented.
        for _ in 0..<2 {
            requireTap("Changer la langue")
            requireTap("Fermer le choix de langue")
            requireTap("Ouvrir mon espace")
            requireTap("Fermer le menu du compte")
        }
        requireTap("Messagerie")
        XCTAssertTrue(app.buttons["Voir mon profil"].firstMatch.waitForExistence(timeout: 20), "Messaging screen did not open")
        open("home")
        requireTap("Notifications", contains: true)
        XCTAssertTrue(app.staticTexts["Activité récente FootNation"].firstMatch.waitForExistence(timeout: 20), "Notifications screen did not open")
        open("home")
    }

    func testPublicationControls() throws {
        open("home")
        for _ in 0..<2 {
            requireTap("Partager", scroll: true)
            requireTap("Fermer le partage")
            requireTap("Ouvrir les commentaires", contains: true, scroll: true)
            XCTAssertTrue(app.buttons["Publier le commentaire"].firstMatch.waitForExistence(timeout: 20), "Comments sheet did not open")
            wait(3)
            XCTAssertFalse(app.staticTexts["Les réactions aux commentaires sont temporairement indisponibles."].firstMatch.exists, "Comment reactions are unavailable")
            // The compact close button is labelled "Fermer". The longer
            // label belongs to the backdrop behind the preview and sheet.
            requireTap("Fermer")
            let closeDeadline = Date().addingTimeInterval(10)
            while app.buttons["Publier le commentaire"].firstMatch.exists && Date() < closeDeadline { wait(0.5) }
            XCTAssertFalse(app.buttons["Publier le commentaire"].firstMatch.exists, "Comments sheet did not close")
        }
        open("my-profile")
        requireProfile()
    }

    func testMatchControls() throws {
        open("home")
        let match = app.buttons.matching(NSPredicate(format: "label CONTAINS ' contre ' AND label CONTAINS ' pour '")).allElementsBoundByIndex.first { $0.exists && $0.isHittable }
        guard let match else { XCTFail("No visible match card to verify"); return }
        match.tap()
        XCTAssertTrue(app.staticTexts["Match"].firstMatch.waitForExistence(timeout: 20), "Match card did not open its detail")
        XCTAssertFalse(app.buttons["Changer la langue"].firstMatch.isHittable, "Home remained over match detail")
        XCTAssertFalse(app.staticTexts["Match introuvable pour cette date"].firstMatch.exists, "Selected match preview was lost")
        open("home")
        requireTap("Voir tous les matchs")
        XCTAssertTrue(app.staticTexts["Compétitions"].firstMatch.waitForExistence(timeout: 25), "All matches did not open")
        open("home")
    }

    private func requireVideoProgress() {
        let progress = app.sliders["Position de la vidéo"].firstMatch
        XCTAssertTrue(progress.waitForExistence(timeout: 35), "The native video did not become ready")
        var values = Set<String>()
        for _ in 0..<4 {
            if let value = progress.value as? String { values.insert(value) }
            wait(1.2)
        }
        XCTAssertGreaterThan(values.count, 1, "The native video timeline did not advance")
    }

    func testVideoPlayback() throws {
        open("shorts")
        requireVideoProgress()
        requireTap("Mettre le short en pause")
        let progress = app.sliders["Position de la vidéo"].firstMatch
        wait(1)
        let paused = progress.value as? String
        wait(2)
        XCTAssertEqual(progress.value as? String, paused, "Manual pause was not preserved")
        requireTap("Reprendre le short")
        requireVideoProgress()
        // A short drag stays below the card-switch threshold. Then a full
        // swipe checks that the next card resumes native playback.
        let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.4, dy: 0.55))
        let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.4, dy: 0.42))
        start.press(forDuration: 0.1, thenDragTo: end, withVelocity: .slow, thenHoldForDuration: 1)
        requireVideoProgress()
        app.swipeUp()
        requireVideoProgress()
        open("search")
        open("shorts")
        requireVideoProgress()
    }

    func testReleaseAudit() throws {
        // One UI-test session avoids repeatedly interrupting the native app
        // between related checks. Every check still uses real touch input.
        executionTimeAllowance = 900
        var completed: [String] = []
        let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("FootNationNativeCaptures", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        func record(_ name: String) throws {
            completed.append(name)
            try JSONSerialization.data(withJSONObject: ["completed": completed, "native": true])
                .write(to: directory.appendingPathComponent("native-checks.json"), options: .atomic)
        }
        try testHeaderControls(); try record("header")
        try testMatchControls(); try record("matches")
        try testPublicationControls(); try record("publication")
        try testVideoPlayback(); try record("video")
        try testCapture(); try record("captures")
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
            ("03-clubs", "clubs"), ("04-opportunites", "opportunities"),
            ("05-matchs", "matches"), ("01-accueil", "home")
        ]
        for (name, route) in routes {
            open(route)
            wait(18)
            dismissInvitations()
            wait(3)
            XCTAssertTrue(app.state == .runningForeground, "App left foreground before screenshot")
            // A successful tap is not evidence of successful navigation.
            let destinationText: String?
            switch route {
            case "clubs": destinationText = "Trouver un club"
            case "matches": destinationText = "Compétitions"
            // The opportunity deck is full-screen and identifies each listing
            // by its author/title. It intentionally has no page-title heading.
            case "opportunities": destinationText = nil
            default: destinationText = nil
            }
            if let expected = destinationText {
                let homeLanguage = app.buttons["Changer la langue"].firstMatch
                XCTAssertFalse(homeLanguage.exists && homeLanguage.isHittable, "Home remained visible after route selection")
                XCTAssertTrue(app.staticTexts[expected].firstMatch.waitForExistence(timeout: 15), "Destination heading did not appear")
            }
            if route == "opportunities" {
                let publish = app.buttons["Publier une annonce"].firstMatch
                XCTAssertTrue(publish.waitForExistence(timeout: 25) && publish.isHittable, "The opportunity deck did not open")
                XCTAssertTrue(app.buttons["Voir l’annonce"].firstMatch.isHittable, "The opportunity listing action is missing")
            }
            // This is a genuine device framebuffer. Human review remains required
            // for asynchronous content errors, localization and empty states.
            try saveCapture(locale + "-" + device + "-" + name + ".png")
        }

    }
}
