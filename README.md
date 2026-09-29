# FootNation — application Expo native

Refonte mobile de FootNation pour Android et iOS, en React Native avec Expo Router. L’identité actuelle utilise Inter, le bleu FootNation et deux thèmes clair/sombre. L’accueil met la première publication immédiatement après les deux filtres et les stories compactes ; les scores arrivent ensuite dans le fil. La base Supabase existante fournit les comptes et les contenus.

**La migration est en cours. Cette version ne remplace pas encore toutes les fonctions du site.** Consulter [MIGRATION.md](MIGRATION.md) pour les différences et les validations restantes.

Après une connexion explicite réussie ou une inscription confirmée avec profil complété, une invitation permet de copier son lien personnel ou de choisir un canal de partage. Fermer ou « Continuer sans inviter » permet d’accéder librement à l’application. L’écran reste accessible depuis Mon espace → Inviter mon réseau. Les crédits et récompenses de parrainage ne sont pas implémentés et ne sont pas promis dans cet écran.

L’onglet Accueil commence par trois rotations complètes d’un globe terrestre bleu et turquoise, avec les contours géographiques Natural Earth embarqués et une lumière fixe. Après ces 42 secondes, le ballon change de drapeau à chaque rotation complète de 14 secondes : France, Bosnie, Algérie, Union européenne, États-Unis, Chine, Australie, Brésil, Argentine, Royaume-Uni, Japon, Allemagne, Turquie, Portugal, Maroc, Qatar, Italie, Arabie saoudite et Croatie, puis retour à la France. L’introduction terrestre ne se répète pas dans la boucle des drapeaux. Un seul drapeau habille toute la sphère à la fois. Les textures flag-icons sont embarquées localement, avec coutures, relief et lumière fixe en SVG natif. L’animation s’arrête en arrière-plan et respecte « Réduire les animations » ; la reprise conserve l’étape et l’angle courant. Lorsque les animations sont désactivées dès l’ouverture, le globe reste immobile.

« Mon espace » regroupe tous les accès dans six catégories repliables : Profil et carrière, Réseau et communauté, Clubs et équipes, Matchs et contenus, Paramètres et sécurité, Aide et contact. Mon CV, Messages et Enregistrés restent disponibles en raccourcis. Les outils administrateur restent réservés aux comptes autorisés.

« Mon CV » reprend les données et rubriques du profil comme sur le site, avec modification du parcours et du palmarès, export PDF, export Word (.doc), impression et partage du lien public du profil. Le PDF web contient du texte sélectionnable et les polices Inter embarquées ; les exports mobiles utilisent Expo Print et la feuille de partage native. La vérification locale couvre le rendu web, les documents multipages et les adaptateurs natifs simulés ; l’impression et le partage sur appareils iOS/Android restent à vérifier sur appareil.

Les actualités du fil présentent leurs actions J’aime, Commenter et Partager en colonne à droite, avec la même ombre latérale que les publications. Le texte conserve son propre espace à gauche des boutons.

La barre du bas suit l’ordre Accueil, Shorts, bouton central « + » pour publier, Recherche et Mon profil. Le « + » ouvre l’éditeur ; Mon profil ouvre toujours le compte connecté et affiche sa photo lorsqu’elle est disponible. En haut de l’accueil, le logo accompagne les icônes messages, notifications et burger. Les opportunités sont accessibles dans la recherche et le menu. L’icône d’avion garde le nom « Messagerie » pour les lecteurs d’écran, sans texte visible.

Le fil connecté défile maintenant par publication plein écran. Le bandeau et les stories sont au début ; chaque publication suivante occupe la hauteur disponible, avec les commandes au-dessus de la barre flottante. « Retour au fil » retrouve l’introduction. Les textes longs s’ouvrent dans une feuille de lecture et la publication consultée est conservée lors d’une rotation ou d’un réordre des données.

Le burger de l’accueil et du profil ouvre un panneau latéral : identité du membre, série de connexions, vues du profil, partage, invitation, raccourcis communautaires, paramètres et déconnexion. Les chiffres proviennent du compte connecté ; les nombres des captures ne sont pas utilisés. Les autres fonctionnalités restent accessibles via « Tous mes outils ».

Après la première publication, le fil contient les scores des grands clubs : matchs en cours, derniers résultats sur quatorze jours, puis rencontres à venir. Le bandeau utilise les scoreboards publics ESPN des cinq grands championnats européens et de la Ligue des champions ; « Tous » ouvre leur calendrier. Le service FootNation reste un secours et alimente l’accès général aux autres matchs. Les scores dépendent de la couverture et du délai des fournisseurs. L’historique reste en cache, le direct est interrogé lorsque l’écran est actif et les données périmées ou hors connexion ne portent pas de badge LIVE.

La rangée de stories réunit de vrais membres, avec priorité aux photos et noms renseignés. Une seule bulle par membre, anneau FootNation pour une story active, anneau neutre sinon ; toucher le nom ouvre le profil et le « + » personnel ouvre la création. Les profils privés, suspendus ou bloqués sont exclus selon les données et les règles de lecture existantes.

Les cartes de matchs montrent les logos officiels fournis par ESPN autour du score. Le bandeau défile en boucle, avec pause/reprise à gauche et glissement manuel. Il s’arrête pendant la manipulation, au focus clavier, en arrière-plan et hors de l’introduction du fil. Réduire les animations désactive le défilement automatique ; les lecteurs d’écran natifs gardent une liste immobile, sans doublons accessibles.

## Démarrage

Utiliser Node.js 24 LTS, puis :

```sh
npm ci
```

Créer `.env.local` à partir de `.env.example`, avec l’URL Supabase et la clé publique `anon` du projet existant. Aucun secret serveur ni clé `service_role` ne doit être utilisé. La configuration publique du site est déjà présente dans la copie de travail locale, dans un fichier ignoré par Git.

```sh
npm run prebuild
npm run ios
# ou
npm run android
```

La compilation iOS nécessite Xcode complet et les dépendances CocoaPods. Android nécessite un JDK compatible et le SDK Android. Les dossiers `ios/` et `android/` sont générés par Expo à partir de `app.json` et sont ignorés par Git ; les régénérer avec `prebuild` sur une autre machine.

WebRTC nécessite une **development build** : Expo Go seul ne contient pas ce module. Une fois la development build installée :

```sh
npx expo start --dev-client
```

`eas.json` fournit les profils `development`, `preview` (APK Android), et `production`. Aucun projet EAS, certificat, build cloud ou publication sur les stores n’a été créé par cette migration. Lier le projet Expo et configurer les signatures avant d’utiliser EAS Build.

## Configuration des builds EAS

Chaque profil de `eas.json` sélectionne explicitement son environnement : `development`, `preview` ou `production`. Après liaison du projet Expo, y renseigner `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY` avec la configuration publique du backend souhaité. Le fichier `.env.local` ignoré par Git n’est pas transmis au build distant. Voir la [documentation des environnements EAS](https://docs.expo.dev/eas/environment-variables/).

`EXPO_PUBLIC_NATIVE_PUSH_ENABLED` reste à `false` tant que le service d’envoi, le traitement des reçus Expo et les identifiants APNs/FCM n’ont pas été déployés et validés sur appareils. Le projet EAS doit également exposer un `projectId` UUID valide. Ce garde-fou empêche une interface d’annoncer des alertes actives alors qu’aucun transport n’est opérationnel.

Le hook `eas-build-pre-install` arrête le build avant installation des dépendances si ces valeurs sont absentes, des exemples, une URL non HTTPS ou une clé qui n’a pas le format public attendu. Il ne journalise pas leurs valeurs. Il accepte une clé JWT de rôle `anon` ou une clé `sb_publishable_…` ; il ne vérifie ni signature ni validité réseau. La validation des connexions sur appareil reste nécessaire. Voir les [hooks de build Expo](https://docs.expo.dev/build-reference/npm-hooks/).

Vérifier la configuration locale sans lancer de compilation :

```sh
node --env-file=.env.local scripts/check-build-env.cjs
```

EAS CLI 24.0.0 est disponible dans le cache local. Aucun compte n’est connecté. La note [build du 10 septembre](docs/build-readiness-2026-09-10.md) détaille Java, le SDK, les signatures existantes et les blocages disque/Xcode ; ne pas recréer les certificats existants sans nécessité.

Aucune variable EAS distante n’a encore été créée ou vérifiée. La liaison du compte/projet Expo, les signatures et la première compilation restent à effectuer.

## Aperçu du design

L’accueil conserve les icônes demandées et présente seulement **Pour vous / Mon réseau**. Les stories sont compactes ; l’auteur, la légende et le média arrivent avant les matchs. La navigation et les formulaires partagent les surfaces du thème choisi. Les écrans courts et les textes agrandis passent au défilement naturel.

```sh
npm run web
```

Cet aperçu utilise React Native Web pour inspecter la mise en page. Les versions iOS et Android résolvent les adaptateurs `.native.tsx` : stockage SecureStore, sélecteurs système, lecture des fichiers et appels WebRTC. Le mode web ne valide pas ces modules natifs.

## Vérifications

La [recette mobile](docs/mobile-quality.md) distingue les contrôles automatisés/Web des essais restant sur appareils (clavier, VoiceOver/TalkBack, mode avion, fluidité native). Le [suivi des erreurs](docs/error-monitoring.md) est raccordé au code mais nécessite un projet Sentry et une validation de réception avant activation.

```sh
npm run typecheck
npm test
npm run format:check
npm run export:all
```

L’export produit les bundles JavaScript/Hermes des plateformes ; il ne produit pas un APK signé ou une archive iOS.

## Organisation

- `app/` : navigation et liens internes Expo Router.
- `src/screens/` : écrans natifs.
- `src/components/` : composants communs, médias et appels.
- `src/lib/` : authentification, requêtes, stockage et règles métier.
- `src/theme/` : palette FootNation.
- `src/content/` : textes statiques du blog et documents du site.
- `tests/` : stockage des sessions, validation, autorisation des clubs et cycle de vie des appels.
- `docs/source-routes.json` : inventaire des routes statiques actives du site d’origine, sans les pages SEO générées dynamiquement.

Les médias publiés par les utilisateurs restent dans leurs buckets existants. Les opérations de publication, modification et inscription agissent sur la base existante lorsqu’un utilisateur les déclenche. Les tests automatisés ne publient rien dans cette base.

## Contenu d’origine

```sh
node scripts/import-content.cjs /chemin/vers/footzone-main
node scripts/inventory-source.cjs /chemin/vers/footzone-main
```

Le script de contenu extrait les textes sans exécuter le code du site. Le manifeste légal enregistre les fichiers sources et leurs empreintes. Le blog provient de `BLOG_POSTS` du site.

## Appels et connexion Google

Le schéma d’URL `com.footnation.app` reprend celui de l’application existante. Le retour OAuth `com.footnation.app://auth/callback` doit être accepté par la configuration d’authentification existante. La connexion Google et la récupération de compte doivent être testées depuis une development build.

Les appels reprennent le contrôleur et les contrats RPC du site. La présence des tables et RPC a été confirmée sur le backend. Le service TURN et la fonction `call-ice-config` restent à vérifier sur appareil ; aucun secret ni backend d’appel n’a été modifié. Les deux migrations de droits d’accès et de vérification de profil sont documentées dans `MIGRATION.md`. Les appels sont limités à l’application ouverte. Le serveur push et les inscriptions sont préparés localement ; leur activation reste à effectuer et à tester. CallKit et la réponse aux appels en arrière-plan ne sont pas implémentés.

## Identité visuelle et apparence

La référence FootNation du 10 septembre est appliquée en clair et sombre : accent bleu `#087CFF`, variante de bouton `#0064D8`, surfaces sobres et typographie Inter. Le choix **Automatique / Clair / Sombre** se trouve dans **Paramètres → Compte et confidentialité → Apparence**, et reste sur l’appareil. Le changement de thème ne remonte ni l’authentification ni les formulaires.

L’accueil connecté montre le logo, les deux filtres **Pour vous / Mon réseau**, une seule rangée de stories compactes, puis immédiatement la première publication. Les scores et logos défilants sont intégrés après cette première publication. Les icônes existantes (ballon animé, Shorts, +, recherche, profil) et les accès du menu sont conservés. Les écrans courts et les grandes tailles de texte utilisent un défilement naturel pour garder les commandes accessibles.

Les quatre fichiers Inter sont embarqués dans `assets/fonts` avec leur licence OFL. Sources : [Expo Google Fonts](https://github.com/expo/google-fonts/tree/main/font-packages/inter), [licence Inter](https://github.com/google/fonts/blob/main/ofl/inter/OFL.txt). Aucun téléchargement de police externe n’est requis par l’application installée.

## Préparation de la bêta

Le [dossier de distribution](docs/release/README.md) regroupe les fiches stores, les scénarios de recette et les conditions restant à vérifier. Il ne constitue pas une confirmation de publication ou de validation sur téléphone.

Le [checkpoint de la nuit du 9 au 10 septembre](docs/release/checkpoint-2026-09-10.md) détaille le travail sur les six étapes demandées : builds, parcours, push, communication, parité et distribution. Les fonctionnalités préparées côté serveur doivent être activées dans un environnement vérifié avant d’être annoncées comme opérationnelles.
