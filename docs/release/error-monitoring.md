# Suivi des erreurs — contrôle de préparation, 10 septembre 2026

Le raccord Sentry est présent, **inactif sans activation explicite et DSN public valide**, et désactivé dans un environnement de développement. Aucun projet, service ou envoi distant n’a été activé pendant ce contrôle. La procédure de configuration reste dans [Suivi des erreurs FootNation](../error-monitoring.md).

## Corrections et preuves locales

- **Filtre final ajouté** : le SDK installé peut omettre `beforeSend` pour ses propres erreurs internes, puis ajouter des métadonnées et pièces jointes. `src/lib/monitoringEnvelope.ts` reconstruit l’enveloppe juste avant le transport : un événement d’erreur autorisé, aucun fichier joint, aucune session, trace, journal ou métadonnée de compte. Les enveloppes vides sont ignorées par le transport JavaScript standard. La limite de 20 rapports/minute couvre maintenant aussi ce chemin interne.
- **Liste de données resserrée** : seuls les noms de bundles de release attendus sont conservés, avec coordonnées finies, ID d’événement valide et Debug IDs concordants. Les messages bruts, URL complètes, noms de fichiers arbitraires, identifiants membres, jetons, formulaires, requêtes et contextes sont exclus. Les captures d’écran, replays et rapports automatiques de sessions restent désactivés.
- **Changement de compte** : l’application ne configure ni utilisateur Sentry ni contexte de compte. Un test avec le véritable Client Sentry simule deux comptes successifs, leurs données de portée et des pièces jointes tardives ; seuls des événements anonymisés sortent vers un transport simulé. Les rapports déjà en attente peuvent finir après déconnexion, mais ne contiennent pas l’identité du compte précédent. Aucune file persistante après fermeture n’est garantie.
- **Build** : `scripts/check-build-env.cjs` refuse les valeurs d’activation ambiguës et exige `EXPO_PUBLIC_APP_ENV=preview` ou `production`, cohérent avec le profil EAS correspondant lorsque le suivi est activé. Le DSN public, l’organisation, le projet et le jeton privé d’envoi des source maps sont alors requis ; leurs valeurs ne sont jamais imprimées. Ce contrôle ne valide pas leur authenticité ni les droits distants.

Les tests utilisent exclusivement des données synthétiques et un transport sans réseau. Ils couvrent l’inactivité, les défaillances du SDK, la confidentialité, les rapports internes, les pièces jointes, le débit et la configuration des builds. **28 tests ciblés et `npx tsc --noEmit` passent.** Commande ciblée : `npx vitest run tests/monitoring.test.ts tests/monitoringClient.test.ts tests/monitoringEnvelope.test.ts tests/buildEnv.test.ts`.

## Limites avant une publication

Le transport reste **JavaScript seulement** (`enableNative:false`). Les exceptions JS non interceptées, erreurs de rendu/routes, échecs finaux React Query et erreurs explicitement signalées sont raccordés. Les crashs natifs, ANR/blocages et erreurs précédant l’initialisation JavaScript ne sont pas couverts. Leur activation exige un filtrage natif et des essais sur appareils.

`metro.config.js` prépare les Debug IDs ; le plugin de `app.config.js` prépare les source maps uniquement quand le suivi est activé. La release est identifiée par `com.footnation.app@version` ; la correspondance précise des bundles repose aussi sur leurs Debug IDs. Un prebuild ou un export réussi ne prouve ni l’envoi des maps ni la symbolication. Aucun jeton n’est ajouté au code public. Pour Web/EAS Update, l’envoi des maps reste une étape distincte ; les fichiers `.map` doivent rester hors de l’hébergement public.

Il reste à choisir le projet Sentry, produire une build preview signée et identifiée, puis vérifier une erreur synthétique reçue, sa ligne source, l’absence de données personnelles et les alertes configurées. Tester également fermeture hors ligne, reprise et changements de compte sur iOS/Android. **Aucune réception, alerte ou validation sur appareil n’est attestée ici.**

Références : [Expo et Sentry](https://docs.expo.dev/guides/using-sentry/), [SDK Expo 57](https://docs.expo.dev/versions/v57.0.0/), [configuration Sentry React Native](https://docs.sentry.io/platforms/react-native/configuration/options/). Le contournement et le transport ont été vérifiés dans le SDK installé (`@sentry/core`, `client.js` et `transports/base.js`), avec tests du véritable pipeline.
