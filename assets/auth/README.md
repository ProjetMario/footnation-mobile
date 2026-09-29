# Sign-in branding assets

Downloaded 2026-09-24 from the providers; bundled locally so the login screen does not contact their CDNs before a sign-in action.

- `google-g.png`: https://developers.google.com/static/identity/images/g-logo.png
- `GoogleSans-Medium-signin.ttf`: Google Fonts Google Sans, weight 500, character subset for “Continuer avec Google”; obtained from https://fonts.googleapis.com/css2?family=Google+Sans:wght@500&text=Continuer%20avec%20Google. Usage is limited to the Google sign-in button, as prescribed by https://developers.google.com/identity/branding-guidelines.
- `apple-continue-black.png` / `apple-continue-white.png`: Apple's official button renderer, https://appleid.cdn-apple.com/appleid/button, parameters `height=50&width=280&color=black|white&border=false&type=continue&border_radius=8&scale=3&locale=fr_FR`. The native iOS button uses `ASAuthorizationAppleIDButton` through Expo; these assets are for Android and Web. https://developer.apple.com/documentation/signinwithapple/incorporating-sign-in-with-apple-into-other-platforms

Do not recolor, redraw, stretch or replace the provider marks with generic icons.
