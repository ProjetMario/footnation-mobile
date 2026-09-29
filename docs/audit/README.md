# Audit des parcours Expo — 23 septembre 2026

Les corrections ci-dessous sont intégrées localement. Cet audit ne constitue pas une validation visuelle complète. Initialement indisponible, Chrome a ensuite permis une [recette visuelle partielle](recette-visuelle.md), malgré des délais fréquents du contrôleur. Aucun téléphone n’a été utilisé. Aucune donnée réelle n’a été créée, modifiée ou supprimée sur les services distants.

## Corrections

- **Admission du compte** : une erreur ou une réponse invalide du contrôle d’accès ne donne plus accès par défaut. Le profil est retiré jusqu’à une vérification réussie.
- **Connexion et retour** : conservation de la destination pour le suivi, les réactions, les commentaires et les pronostics. Les conversations avec identifiant UUID, la date d’un match et l’ouverture des commentaires d’un short sont préservées avec validation stricte des paramètres.
- **Retour sans historique** : destinations de repli sur les shorts et l’annulation de suppression du compte.
- **Documents légaux** : accessibles aux comptes restreints, y compris leurs redirections. Un document inconnu affiche un état explicite au lieu d’un autre document.
- **Sections inconnues** : les espaces membre et d’administration du club ne présentent plus un contenu arbitraire pour une section inexistante.
- **Pied de page** : erreur lisible si un lien ne peut pas être ouvert, texte secondaire plus contrasté et cibles tactiles agrandies.
- **Contrôle des liens internes** : analyse des destinations dans `app` et `src`, y compris les liens JSX et les configurations. Les routes génériques ne masquent plus les destinations inexistantes.
- **Inscription** : lien des conditions séparé de la case à cocher, avec une cible interactive indépendante.
- **Vidéo et Reels** : gestion des promesses de lecture Web, pause/reprise stable, nettoyage du lecteur natif, remise à zéro au changement de fichier, bande sonore et bouton de nouvelle tentative accessibles.
- **Coordonnées des clubs** : les sites sans préfixe HTTPS restent ouvrables ; les échecs d'ouverture du site et de l'email sont présentés dans l'interface.
- **Clubs en mode sombre** : couleurs des liens/filtres adaptées aux fonds, noms de commentaires repliables et cibles de profils agrandies.
- **Traduction** : découpage borné après un rejet explicite de longueur, conservation des paragraphes/emojis, aucun affichage partiel ni libellé de succès après une erreur. Le service distant reste à valider.

## Couverture et limites

L’[inventaire des 155 routes](parcours-routes.json) indique les rôles et scénarios restant à parcourir. « Inventoriée » signifie que le fichier et les destinations statiques sont contrôlés, pas que l’écran a été parcouru dans un navigateur.

| Parcours | Preuve automatisée | Vérification restante |
| --- | --- | --- |
| Connexion, admission, compte restreint, retour | `authAdmission`, `authReturn`, `memberAccess`, `logout`, `accountDeletion` | Saisie, focus, session expirée et redirections visibles |
| Navigation, notifications, liens directs | `navigationRoutes`, `incomingPath`, `notificationPath`, `pushResponse` | Tous les clics, historique et liens depuis un téléphone |
| Publications, actus, réactions, commentaires | Suites de publication/commentaires ; commentaire fictif via le vrai client Supabase | Interface complète et disponibilité des services distants |
| Traduction | `postTranslation` | Traduction réelle de bout en bout : fournisseur non certifié par cet audit |
| Shorts et amis | `shortComments`, `shortFriends` | Lecture jusqu’au bout, pause, cadrage, audio et permissions sur appareil |
| Recherche, matching, opportunités | Suites `matching`, filtres, chargement, découverte | Gestes, filtres visibles, retour sur une carte |
| Clubs, identité, installations, suivi | Suites clubs ; suivi puis retrait sur fixtures ; conservation des trois installations de Drumettaz | Onglets, fenêtres, profils, votes, commentaires, QR et Maps dans l’interface |
| Matchs | `featuredMatches`, `todayMatches`, `espnMatchDetails`, calendrier | Ordre visible, pronostics et fenêtre de captation sur appareil |
| Messages et appels | Suites messages/appels et destinations de conversations | Temps réel, TURN, capture et permissions réelles |
| Liens publics | 12 réponses HTTP 200, redirections suivies | Une réponse 200 ne garantit pas l’absence d’un écran de consentement ou de connexion |
| Présentation et accessibilité | Types, structure et compilation | 360/390/768/1280 px, deux thèmes, noms longs, clavier et lecteur d’écran |

Les tests existants sont des régressions de logique et de services ; leur réussite n’équivaut pas à une recette de chaque écran. Les statuts de la [recette physique](../release/device-acceptance.csv) ne sont pas transformés en validations.

## Recette locale sans écritures réelles

Depuis `mobile-expo` :

```sh
npm run audit:ui
```

Ouvrir `http://localhost:8081`. Le lanceur crée une copie temporaire de l’application, sans fichiers `.env`, avec une clé de session distincte et un serveur de données sur `127.0.0.1:7082`. Les requêtes fetch/XHR/WebSocket sont limitées aux deux ports locaux dans cette copie. Aucun code de simulation n’est ajouté à l’entrée de l’application livrée.

Comptes fictifs : `player@fixture.test`, `coach@fixture.test`, `club@fixture.test`, `admin@fixture.test`, `new@fixture.test`, `underage@fixture.test` et `parent@fixture.test`. Utiliser un mot de passe fictif non vide. Le responsable du club est autorisé uniquement sur le premier club de recette.

Le serveur simule notamment les publications, deux clubs aux couleurs différentes, trois installations, les profils de communauté, les pronostics, un vote MVP et les opérations de suivi/commentaire. Un short utilise la vidéo de présentation déjà présente dans le dépôt, servie localement avec prise en charge des requêtes partielles. Il ne reproduit pas toute l’API, les jointures, les politiques RLS ou les intégrations externes : une opération non implémentée retourne **501**, jamais un faux succès. Les tests n’autorisent pas l’envoi de messages réels.

Changer le scénario local :

```sh
curl http://127.0.0.1:7082/__fixture -H 'Content-Type: application/json' -d '{"scenario":"error"}'
```

Scénarios : `normal`, `empty`, `error`, `unauthorized`, `forbidden`, `slow`. Le dernier ajoute 1,5 seconde de délai. Arrêter avec Ctrl+C ; relancer pour réinitialiser les données et recopier les dernières modifications du code. Cette copie ne suit pas les modifications du projet d’origine à chaud. Les liens externes ouverts volontairement ne sont pas une partie du serveur simulé.

## Commandes de validation

```sh
npm run typecheck
npm test
npm run audit:inventory
CI=1 ./node_modules/.bin/expo export --platform all --max-workers 2 --output-dir /tmp/footnation-parcours-export
```

Les exports Android/iOS vérifient les bundles JavaScript/Hermes ; ils ne remplacent ni une compilation native APK/Xcode, ni une exécution sur appareil. Les résultats finaux sont consignés dans `resultats.md`.

## Audit de l’administration des clubs

[Recette Expo et Web du 24 septembre 2026](admin-club-2026-09-24.md) : corrections, preuves et limites sur appareils.
