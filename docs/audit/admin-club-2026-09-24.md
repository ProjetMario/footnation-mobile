# Recette de l’espace administrateur club — 24 septembre 2026

## Périmètre et méthode

Application Expo et espace Web local. Comptes fictifs de responsable, coach limité à une équipe, joueur et administrateur ; deux clubs isolés. Les modifications de données restent dans un serveur HTTP en mémoire sur `127.0.0.1:7082`. Aucune invitation, publication, notification ou modification n’a été envoyée en production.

Les lanceurs `scripts/audit/start-ui.mjs` (Expo 8081) et `scripts/audit/start-web-ui.mjs` (Web 8083) créent des copies temporaires sans environnement distant. Sessions distinctes, garde réseau et, sur Web, CSP et télémétrie désactivée. Les requêtes non simulées échouent explicitement en 501. Les tests de contrat ne prouvent pas que les migrations/RLS sont appliquées au serveur réel.

## Corrections réalisées

- Accès Web fondé sur les autorisations serveur, sans déduction depuis le nom du club ou le rôle modifiable du profil. Cache privé isolé par club et compte ; contrôle d’identité avant modification ; accès revérifié.
- Navigation admin mobile et retour déterministe vers le club. Dashboard coach Expo limité aux fonctions de ses équipes ; actions d’effectif/pointage/statistiques selon leur permission réelle.
- Présences Expo : pagination complète, joueurs homonymes distingués par identifiant, séances distinctes même à date identique, bilan séparé du filtre de recherche, actualisation après modification.
- Présences Web : remplacement de l’ancien historique et du bouton inactif par les séances/pointages réels, création, modification, suppression de pointage, reprise de création sans doublon, conflits de modification conservant les données saisies.
- Invitations d’équipe : nombre d’utilisations strictement entier, contrôle du compte, erreurs de partage/copie visibles, disparition du chargement permanent de l’onglet.
- Matchs/convocations Web : dates locales préservées, bons champs de scores, compétition/journée conservées, joueurs identifiés par leur ligne d’effectif ; matchs liés à `club_matches` ; reprise sans créer un second match.
- Équipes : suppression des écritures automatiques à l’ouverture et de la saison figée ; invalidation des calendriers, sélecteurs et vues membres après modification.
- Identité, contact et présentation : contrôles d’identité, synchronisation après sauvegarde, mutations vérifiées et conflits explicites.
- Chat Web : groupes et messages réels, gestion des membres, erreurs récupérables, suppression des groupes fictifs et des actions inactives.
- Actualités et contenus : contenu complet conservé lors de l’édition, mises à jour/suppressions avec instantané de référence ; brouillon conservé en cas de conflit.
- Compétitions Web : gestion des compétitions et classements à partir des tables existantes ; aucun schéma ajouté.
- Staff Web : fiches explicites dans `club_staff`, pagination, conflits détectés et archivage confirmé. Aucun import FFF ni changement des informations personnelles d’un profil à l’ouverture.
- Membres d’équipe : jointure du profil corrigée, noms/recherche rétablis, abandon de la création d’un profil sans compte. Les erreurs conservent le formulaire ; ajout/réactivation approuvent uniquement un compte déjà rattaché au club.
- Invitations et administrateurs : recherche serveur paginée par nom, pseudo ou UUID ; suppression de l’utilisation de `profiles.email` et du plafond des 500 profils. Droits revérifiés et retrait du dernier responsable protégé.
- Organigramme : affectation atomique via les RPC existantes. Migration corrective locale de `set_native_primary_team` : vraie unicité équipe/profil/rôle, adhésion approuvée, réactivation et rôle existant conservé.
- Paramètres sensibles : contrôle administrateur site, valeur attendue et résultat RPC vérifiés ; aucune réécriture globale des métadonnées.
- Shorts : vidéo obligatoire, URL/fichier et réponse de transfert validés, formulaire verrouillé pendant l’upload, fichier effacé à l’annulation. Un transfert déjà réussi est conservé si l’enregistrement doit être retenté.
- Résultats des équipes : sans identifiant Scorenco, recours aux matchs locaux liés exactement au club et à l’équipe. Classement non raccordé expliqué, aucun rapprochement déduit du nom.
- Ressource graphique `/grid-pattern.svg` manquante ajoutée pour les matchs et la recherche Web.

## Preuves automatiques

| Vérification | Résultat |
| --- | --- |
| Suite Vitest Expo complète | **1 116 tests, 134 fichiers : réussis** (`/tmp/admin-expo-tests-final.log`). |
| Tests Node Expo et préparation de livraison | **18 tests réussis** (`/tmp/admin-core-tests.log`). |
| Tests Web ciblés de l’audit club | **212 tests, 23 fichiers : réussis** (`/tmp/admin-web-tests-complete.log`). |
| Contrat SQL d’affectation et calendrier | **38 assertions réussies**, PostgreSQL 16 jetable, socket privé sans TCP ; cluster arrêté. |
| TypeScript Expo | Réussi (`/tmp/admin-expo-tsc-final.log`). |
| TypeScript Web | **0 erreur dans le périmètre audité** ; 132 diagnostics préexistants hors périmètre, aucun nouveau (`/tmp/admin-web-tsc-review-summary.json`). |
| Vérification des composants natifs Expo | Réussie (`/tmp/admin-native-check.log`). |
| Exports Expo Web, iOS et Android | Réussis, artefacts dans `/tmp/footnation-admin-export-final`. Ce sont des exports JavaScript, pas des applications signées installées sur téléphone. |
| Build Web et génération PWA | Réussis en mode `audit`, sans scripts de génération SEO ni déploiement (`/tmp/admin-web-build.log`, sortie `/tmp/footnation-admin-web-build`). |
| Vérification des diffs | `git diff --check` réussi sur le périmètre de l’audit. |

Les tests couvrent notamment révocation, changement de compte, accès croisés entre clubs/équipes, pagination au-delà de 500 lignes, dates, homonymes, conflits et reprise après réponse perdue. Le test SQL reproduit d’abord l’erreur de l’ancienne fonction avec la contrainte réelle à trois colonnes, puis vérifie le correctif. Les préconditions d’autorisation y sont synthétiques : il ne valide pas les politiques de la base distante.

## Recette visuelle

| Parcours | Résultat constaté |
| --- | --- |
| Expo, connexion responsable | Connexion au compte fictif et tableau de bord club ouverts. |
| Expo, lien équipe, 390 px | Choix Seniors A, code créé et lien affiché ; liste récente sans chargement permanent. |
| Expo, séance | Modification des notes enregistrée et affichée au retour à la liste. |
| Web, accès direct admin | Redirection connexion puis ouverture du tableau de bord du bon club. |
| Web, 390 px | En-tête et menu admin accessibles, tableau de bord sans débordement horizontal visible. |
| Web, présences → Expo, bilan | Pointage « En retard » enregistré côté Web puis retrouvé dans le bilan Expo ; un pointage, une séance, aucun doublon. |
| Web, chat | Discussion ouverte, message fictif enregistré et affiché ; champ vidé après succès. |
| Web, compétition | Modification des points de 4 à 5 enregistrée et affichée au classement. |
| Web, 360 / 768 / 1280 px | Formulaire de classement et page compétition lisibles ; présentation sur une colonne à 360 px. |
| Web, informations / contact / matchs / statistiques / palmarès | Sections ouvertes ; valeurs de fixture présentes, calculs de résultat cohérents, état vide du palmarès explicite. |
| Expo, accès croisé | Un responsable du club rouge reçoit un refus en ouvrant l’administration du club bleu. |

Les 21 entrées Web ont été inventoriées et leurs sources relues. Ce tableau liste uniquement les parcours réellement observés dans le navigateur ; il ne prétend pas que toutes les mutations ont été essayées visuellement.

La simulation de taille d’écran ne remplace pas une recette sur appareil physique. Les essais de saisie Playwright ont rencontré une instabilité de focus de l’outil ; la saisie par l’API d’accessibilité a permis de poursuivre. Ne pas compter ces essais comme preuve de frappe séquentielle sur téléphone. La connexion du navigateur s’est ensuite interrompue : la dernière passe visuelle du compte coach, du thème sombre et des sélecteurs de profils modifiés reste à reprendre. La demande de reconnexion a été transmise à l’utilisateur.

## Limites et préparation des appareils

- Aucun iPhone/Android physique validé : applications non installées, outils locaux de lancement natif non disponibles. La matrice `../release/device-acceptance.csv` reste `NOT_EXECUTED` tant qu’un appareil/build réel n’a pas été testé.
- Contrôle local du profil preview : `../release/preflight-admin-2026-09-24.json`. Projet EAS non lié ; supervision et push natif non configurés. Ce contrôle ne contacte aucun service distant.
- Aucun build distant, signature, configuration de secret ou migration appliqué. Ces opérations nécessitent une autorisation séparée selon les instructions du projet.
- La correction serveur `supabase/migrations/20260924090000_club_primary_team_approval.sql` est préparée et testée localement. Tant qu’elle n’est pas appliquée à la base cible après vérification de son schéma, l’ancien défaut d’affectation peut encore exister sur cette base.
- Le serveur de recette ne simule pas `news-feed` et certains filtres de stories de l’accueil : leurs erreurs explicites dans cette copie ne sont pas attribuées au produit.
- La vérification TypeScript globale du Web rencontre aussi des erreurs hors de l’espace admin ; ne pas annoncer un typecheck global réussi.
- L’outil navigateur est indisponible à la fin de la recette. La dernière taille temporaire utilisée était 1280 × 900 ; il faudra réinitialiser cette simulation lors de la reconnexion. Aucune fenêtre n’a été modifiée via un outil de contournement.

## Relancer

Depuis `mobile-expo`, lancer `npm run audit:ui`, puis dans un autre terminal `node scripts/audit/start-web-ui.mjs`. Comptes `club@fixture.test`, `coach@fixture.test`, `player@fixture.test`, mot de passe fictif non vide. Club rouge : `30000000-0000-4000-8000-000000000001`. Toute modification de code/fixture nécessite une nouvelle copie ; redémarrer les lanceurs et recharger les onglets.

Tests reproductibles :

```sh
# Depuis mobile-expo (Node 22)
node node_modules/vitest/vitest.mjs run --maxWorkers=1
node node_modules/typescript/bin/tsc --noEmit
node scripts/check-native.cjs
EXPO_NO_DOTENV=1 CI=1 node node_modules/expo/bin/cli export --platform all --output-dir /tmp/footnation-admin-export

# Depuis la racine Web
node node_modules/vitest/vitest.mjs run src/components/club/admin src/hooks/__tests__/useClubAdmin.test.tsx src/hooks/__tests__/useTeamMembers.test.tsx src/lib/__tests__/clubAttendance.test.ts src/lib/__tests__/clubCompetitionManagement.test.ts src/lib/__tests__/clubStaffManagement.test.ts src/lib/__tests__/clubShortInput.test.ts src/lib/__tests__/clubTeamDetails.test.ts --maxWorkers=1 --minWorkers=1
```

Pour le SQL, suivre les préconditions de `tests/club-primary-team-backend.sql` dans une base vide jetable uniquement. La fixture HTTP ne remplace pas ce test : elle ne reproduisait pas la contrainte PostgreSQL qui causait l’erreur.
