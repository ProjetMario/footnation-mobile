# FootNation — simplicité, cohérence et fiabilité

État au 12 septembre 2026. Les changements décrits sont dans la copie de travail. Aucune migration distante, publication de version, configuration de secret ou délivrance d’e-mail réel n’a été effectuée. Ce rapport distingue le code testé localement de la validation d’un service déployé.

## Changements réalisés

- Profil : onglets Publications, Vidéos, Statistiques, Clubs et À propos fonctionnels ; identité, expériences, palmarès et meilleur niveau réutilisés. Suppression des compteurs et scores fixes. Compteurs exacts indépendants de la pagination, listes d’abonnés/abonnements ouvrables, visites réservées au propriétaire. Le QR code s’ouvre par une action dédiée.
- Club : compteurs des actualités publiées, membres actifs et abonnés calculés côté serveur ; actions vers les sections et listes correspondantes.
- Messagerie : identité du membre connecté, Tous/Non lues filtrés avant pagination, commandes factices retirées, demande de connexion depuis le profil lorsque nécessaire. États sélectionnés explicitement annoncés.
- Publication : menu Créer défilable, retour fixe ; enregistrement, arrêt du suivi et masquage raccordés ; destination de modification corrigée vers `/posts/[id]`.
- Brouillons : texte, média et identifiant conservés par compte, doubles appuis empêchés, vérification de l’identifiant envoyé après réponse perdue. La suppression effective du compte nettoie aussi ses données locales.
- Opportunités : champ serveur `listing_kind` distinct de la catégorie ; Offres/Demandes avant pagination ; création avec choix offre/demande et catégories communes. Les valeurs historiques reconnues sont reprises prudemment. Une donnée de date ou de lieu absente n’est pas inventée.
- Navigation : liens Shorts historiques convertis, destination conservée après connexion ; langue accessible dans le menu et les paramètres ; notifications ouvertes indépendamment de l’écriture « lu » ; masquages persistants sans cellule vide dans le fil.
- Équipes : invitation, attente et équipe approuvée distinguées ; démarrage vers le calendrier de l’équipe approuvée. Calendrier futur croissant et historique décroissant, pagination, séparation des équipes et événements du club.
- Événements : `team_id` facultatif sur matchs et séances, contrôle serveur équipe/club/droits, formulaires et notifications cohérents. Aucun rattachement approximatif des anciens événements ambigus. Les écritures anciennes ne peuvent pas effacer silencieusement une équipe affectée.
- Accès par âge : inscription avant 13 ans refusée, 13–15 ans soumis à une autorisation parentale, reprise des comptes existants sans suppression. Registre privé, protection des accès serveur et pages de vérification web/Expo. Google reste réservé aux comptes existants ou associés. Les services du compte s’arrêtent pendant une restriction sans remonter le navigateur complet ; ouvrir l’aide ne rend pas publiques les scènes précédentes.
- Cache hors ligne web : le build a révélé un préchargement de 15 670 fichiers, soit environ 208 Mio. La liste est limitée aux fichiers de l’application, polices et icônes : 249 fichiers et environ 25 Mio après correction (−88 %). Le cache des images à la consultation est conservé. Les pages SEO et fichiers publics restent distribués normalement.

## Vérifications automatiques

| Contrôle | Résultat local |
| --- | --- |
| `cd mobile-expo && npm run typecheck` | Réussi |
| `cd mobile-expo && npm test` | 888 tests : 870 Vitest, 12 tests Node de base/calendrier, 6 tests de préparation de version ; tous réussis |
| Vérification des composants natifs | Réussie : aucune WebView, balise HTML ou chaîne JSX hors Text |
| Export Expo iOS, Android et web | Bundles produits dans `/tmp/footnation-ux-export-20260912` ; cela ne constitue pas une application signée ni un test sur téléphone |
| Compilation du site web existant | `SKIP_COMPRESSION=true npx vite build --outDir /tmp/footnation-web-ux-20260912` réussie, service worker généré ; compression de distribution désactivée pour ce contrôle local |
| Tests web `memberAge.test.ts` et `memberAccess.test.ts` | 14 tests de limites d’âge, réponses d’accès et liens ; réussis |
| Tests Node serveur et couverture Edge | 4 tests réussis ; 51 points d’entrée couverts par le garde ou une exception documentée |
| Tests Deno consentement/garde | 7 tests réussis et contrôle TypeScript des points d’entrée ; envois factices uniquement |
| Migrations Opportunités et calendrier | Suites SQL réussies dans PostgreSQL 16 jetable, socket privé, aucune connexion distante |
| Migrations conversations, visibilité sociale et âge | Assertions SQL réussies dans PostgreSQL jetable |
| `git diff --check` | Réussi |
| Préparation de la bêta (`release-preflight.cjs --json`) | **Bloquée** : identifiant de projet EAS absent, Sentry et push non activés/configurés localement. Rapport sans secrets : `preflight-2026-09-12.json` |

Les nouveaux tests couvrent notamment : une demande ancienne après 20 offres, une vidéo après une première page de texte, des compteurs de 45 publications, le cloisonnement des comptes, les brouillons et réponses perdues, les chemins natifs statiquement déclarés, les événements au-delà des premières pages, des équipes de même catégorie, les frontières 13/16 ans, les dates invalides, les métadonnées non fiables, Google, le refus et la réutilisation d’un lien parental, l’expiration et les limites de renvoi. Les tests SQL exercent aussi les règles de blocs et les restrictions serveur ; ils ne remplacent pas un appel HTTP à PostgREST/GoTrue déployé.

Les limites d’âge web, Expo et serveur sont calculées sur la même date UTC. Les assertions serveur ont aussi réussi sous UTC−12 et UTC+14 : changer le fuseau de la session ne change pas l’admissibilité.

## Recette navigateur effectivement exécutée

Un serveur jetable en mémoire (`scripts/ux-fixture-server.mjs`, port 7082) fournit exclusivement des comptes et contenus fictifs. Metro utilise le port 8082 et une isolation explicite de `.env.local` : le module d’environnement de développement d’Expo 57 importe sinon ce fichier même avec des variables shell. Aucun compte de recette n’a été créé sur le service réel.

Pour reproduire, depuis `mobile-expo`, lancer `node scripts/ux-fixture-server.mjs`, puis dans un second terminal :

```sh
FOOTNATION_UI_FIXTURES=1 EXPO_NO_DOTENV=1 EXPO_PUBLIC_SUPABASE_URL=http://localhost:7082 EXPO_PUBLIC_SUPABASE_ANON_KEY=fixture-public-only EXPO_PUBLIC_ERROR_REPORTING_ENABLED=false EXPO_PUBLIC_NATIVE_PUSH_ENABLED=false npm run web -- --port 8082 --clear
```

Identités locales : `player@fixture.test`, `coach@fixture.test`, `admin@fixture.test`, `new@fixture.test` (date absente), `underage@fixture.test` et `parent@fixture.test` (autorisation requise). Le serveur accepte un mot de passe arbitraire non vide pour ces identités fictives uniquement. Il n’envoie aucun message ni e-mail et ne teste pas la persistance d’une base réelle.

- **320 × 568** : menu Créer ouvert depuis le bouton central ; retour visible en haut ; défilement jusqu’à Diffuser un match et Annuler, puis retour au fil. Annuler devient visible à y=436–500 après défilement.
- **375 × 667** : profil et onglet Statistiques. 45 publications, 2 abonnés, 0 abonnement et 1 visite correspondent aux fixtures. L’onglet actif est annoncé et le changement conserve la position de lecture. Le compteur d’abonnés ouvre les deux profils attendus.
- **390 × 844** : messagerie et opportunités. La recherche saisie caractère par caractère conserve le focus et le texte `bonjour`. La sélection Demandes retrouve l’annonce antérieure aux 20 offres. Les valeurs manquantes de date repérées pendant la recette sont désormais masquées.
- **Changement de compte** : le membre fictif de moins de 13 ans atteint l’écran de restriction, sans accès au fil précédent. L’aide s’ouvre et le retour revient à la restriction. La déconnexion revient à l’accueil visiteur. Le membre fictif de 13 à 15 ans voit ensuite le formulaire d’autorisation parentale et l’explication du délai de 48 heures ; aucun mail n’a été envoyé. Les données du compte ne sont pas supprimées.

Les tests de navigation statiques recherchent les routes manquantes, mais ne prouvent pas tous les parcours visuels et droits de chaque persona. Des identités fictives coach/administrateur sont disponibles dans le serveur de recette ; le joueur rattaché est couvert dans les tests de règles. Leur recette visuelle complète reste à effectuer sur l’environnement de test connecté.

## Migrations et mise en service

À appliquer dans l’ordre, après validation du schéma cible et approbation séparée :

1. `20260912075000_opportunity_listing_kind.sql`
2. `20260912080000_native_conversation_filter.sql`
3. `20260912080100_native_social_visibility.sql`
4. `20260912082000_native_team_calendar.sql`
5. `20260912084000_member_age_registry.sql`
6. `20260912084100_member_age_access.sql`

L’âge nécessite un déploiement coordonné des deux fronts, du serveur Node, des fonctions Edge et des configurations Auth/PostgREST/e-mail. Le détail des contrats, exceptions et vérifications se trouve dans `docs/member-age-access.md` à la racine du projet. **Ne pas publier le front seul : les nouvelles RPC absentes provoquent volontairement un accès non autorisé par défaut.**

## Validation encore nécessaire avant publication

- Appareils iPhone/Android : démarrage d’une version native signée, caméra, microphone, vidéo, clavier logiciel, coupure réseau et reprise. Aucun appareil physique n’a été piloté pendant cette recette.
- Texte système à 200 %, VoiceOver et TalkBack : les libellés, états et structures ont été inspectés, mais cela ne vaut pas validation avec les lecteurs d’écran et tailles de police natifs.
- Le build du site existant signale encore une référence décorative `/grid-pattern.svg` non résolue au moment de la compilation. Ce contrôle ne valide pas le rendu de toutes les pages du site publié.
- Environnement de test réellement déployé : Auth/Google, PostgREST, Storage/Realtime, droits coach/admin, convocations et notifications entre comptes. Le sac du coach reprend les droits existants : la gestion complète des invitations et la saisie des présences restent soumises aux permissions admin existantes.
- Consentement parental : délivrabilité du lien de 48 h avec l’expéditeur Resend configuré, réponses sur téléphone et tests du hook Auth par l’API réelle. La date déclarée et l’e-mail ne vérifient pas l’identité du parent.
- Sentry : pipeline existant conservé et tests locaux de filtrage des données privées exécutés dans la suite. La réception d’un événement dans un projet Sentry de test n’a pas été vérifiée ; elle dépend de l’activation et de la configuration de cet environnement.

Le code est prêt pour cette mise en service de recette. L’absence de défaut dans ces contrôles locaux ne constitue pas une certification « sans bug » ni une validation complète des appareils et services externes.
