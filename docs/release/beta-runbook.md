# FootNation — préparation et conduite de la bêta

Point du 10 septembre 2026. L’utilisateur réalise lui-même l’installation sur iPhone et Android. Aucun résultat sur appareil, inscription de club pilote ou réception push n’est attesté par les tests locaux.

## Commandes reproductibles

Depuis `mobile-expo`, avec les dépendances déjà installées :

```sh
npm run release:verify
npm run release:verify -- --code-only
npm run release:preflight -- --profile=production
node scripts/release-preflight.cjs --json
npm run pilot-launch
```

- `release:verify` lance TypeScript, la garde des composants natifs, les tests cœur, les tests applicatifs, les tests du contrôle de préparation, puis le contrôle de configuration. Il poursuit les contrôles indépendants après un échec et renvoie un code non nul si l’un échoue.
- `--code-only` permet de distinguer la qualité du code des services et identifiants manquants. Un résultat positif ne valide pas la bêta.
- `release:preflight` lit silencieusement la configuration Expo effective et les fichiers `.env` avec la priorité Expo de production ; les variables déjà injectées par EAS ou le shell restent prioritaires. Le profil par défaut est `preview`. Il ne récupère pas les variables EAS distantes : le lancer avec l’environnement de build concerné.
- Le rapport ne contient que des états et des messages contrôlés. Il détecte certains noms/formats de secrets mal placés dans `EXPO_PUBLIC_`, sans remplacer un audit des fichiers/bundles. Ne pas joindre les `.env`, les sorties brutes de configuration ou les journaux des consoles aux retours testeurs.
- Ces commandes n’installent rien, ne génèrent pas de projet natif ni d’export et ne font aucun déploiement, migration, appel métier ou envoi de notification. Les tests existants utilisent leurs données synthétiques.

Les états sont `PASS` (contrôle local satisfait), `FAIL` (correction nécessaire), `MANUAL` (preuve externe requise). Même avec tous les contrôles locaux verts, `releaseDecision` reste `MANUAL_VALIDATION_REQUIRED` ; les tests ne prétendent jamais installer l’application ni certifier sa mise en production.

`npm run pilot-launch` génère le carnet d’actions opérationnelles dans `mobile-expo/docs/pilot-launch-plan.txt`. Ce fichier rappelle l’ordre exact pour sortir un build preview iOS/Android, activer la chaîne push native et lancer les premiers tests compte réel.

## État vérifié et points d’activation

| Élément                                                    | État au 10 septembre                                                                                                                    | Preuve nécessaire avant ouverture aux clubs                                                                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Expo 57, identifiants `com.footnation.app`, plugins natifs | Déclarés, contrôle local positif                                                                                                        | Builds signées installées sur les deux plateformes                                                                                 |
| Configuration Supabase publique                            | Présente, formats validés localement                                                                                                    | Parcours authentifiés de recette contre la cible retenue                                                                           |
| Projet EAS                                                 | `extra.eas.projectId` absent de la configuration effective                                                                              | Relier le projet existant et vérifier son identité dans le build                                                                   |
| Migrations                                                 | Session précédente : lot appliqué jusqu’à `20260911073000`, dry-run à jour                                                              | Refaire l’inventaire si la cible ou le lot change ; ne pas réappliquer les fichiers de conflits archivés                           |
| Push                                                       | Registre, file et worker présents dans les sources ; `native-push` absent du listing distant vérifié ce 10 septembre ; client désactivé | Déploiement gardé, APNs/FCM, scheduler, puis réception et clic sur appareils                                                       |
| Suppression de compte                                      | Parcours et handler présents ; `account-deletion` absent du listing distant                                                             | Audit du schéma, Storage et facturation, services Checkout cohérents, compte jetable réellement supprimé                           |
| Nettoyage des pièces jointes                               | Worker local ; `message-attachment-cleanup` absent du listing distant                                                                   | Déploiement, secret dédié, scheduler et contrôle de reprise                                                                        |
| Appels                                                     | `call-ice-config` apparaît ACTIVE dans le listing distant                                                                               | Vérifier version/configuration réellement servie et relais sur deux réseaux ; aucun appel entrant avec app fermée n’est implémenté |
| Erreurs                                                    | Intégration Sentry présente ; activation locale désactivée                                                                              | DSN et build configurés, erreur reçue, source symboliquée et alerte testée                                                         |
| Appareils, restauration, charge et coûts médias            | NON EXÉCUTÉS dans ce contrôle                                                                                                           | Remplir la recette, éprouver une restauration isolée et mesurer une charge représentative                                          |

Le listing distant établit la présence d’une fonction, pas sa version source, ses secrets, ses schedulers ni le bon fonctionnement de ses dépendances. Les notes historiques mentionnant « migration non appliquée » sont à lire avec le point ci-dessus ; les fonctions et signatures ne sont pas activées par une migration.

L’inventaire distant des **noms de secrets uniquement** indique que `NATIVE_PUSH_PROJECT_ID`, `NATIVE_PUSH_WORKER_SECRET`, `NATIVE_PUSH_DELIVERY_ENABLED`, `ACCOUNT_DELETION_ENABLED` et `ACCOUNT_DELETION_BILLING_AUDITED` sont absents. `TURN_SHARED_SECRET`, `METERED_DOMAIN` et `METERED_SECRET_KEY` sont présents ; le chemin Metered peut donc être configuré et l’absence de `TURN_URLS` ne suffit pas à conclure à une panne de relais. Aucun de ces secrets n’a été lu ni recopié. Le projet de suivi Sentry reste à raccorder.

### Variables à configurer dans leur environnement approprié

| Environnement              | Noms                                                                                                                                                                                | Contrôle                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Build public               | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`                                                                                                                         | HTTPS + clé anon/publishable, jamais service role                                                                              |
| Build public suivi erreurs | `EXPO_PUBLIC_ERROR_REPORTING_ENABLED`, `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_APP_ENV`                                                                                              | Activation explicite, DSN public valide, environnement preview/production                                                      |
| Build privé source maps    | `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`                                                                                                                                 | Accès d’upload vérifié ; aucun jeton dans le bundle                                                                            |
| Build public push          | `EXPO_PUBLIC_NATIVE_PUSH_ENABLED`                                                                                                                                                   | Activer seulement après preuve de livraison ; projet EAS UUID dans la config                                                   |
| Serveur push               | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NATIVE_PUSH_PROJECT_ID`, `NATIVE_PUSH_DELIVERY_ENABLED`, `NATIVE_PUSH_WORKER_SECRET` ; `EXPO_ACCESS_TOKEN` si sécurité améliorée Expo | UUID EAS concordant ; secret dédié >= 32 caractères ; vérifier les reçus                                                       |
| Serveur suppression        | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ACCOUNT_DELETION_ENABLED`, `ACCOUNT_DELETION_BILLING_AUDITED`, `STRIPE_SECRET_KEY`                                                    | Activation après audits du schéma, médias et facturation ; Stripe test pour recette                                            |
| Serveur pièces jointes     | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MESSAGE_ATTACHMENT_CLEANUP_ENABLED`, `MESSAGE_ATTACHMENT_CLEANUP_SECRET`                                                              | Worker fermé par défaut, secret et planification dédiés                                                                        |
| Serveur appels             | `SUPABASE_URL`, `SUPABASE_ANON_KEY` ; `METERED_DOMAIN` + `METERED_SECRET_KEY` **ou** `TURN_SHARED_SECRET` + `TURN_URLS`                                                             | Le handler courant choisit Metered si les deux variables sont présentes ; sinon TURN REST. Vérifier le relais réellement servi |

Les valeurs ne sont ni stockées ni rapportées ici. La présence locale ne prouve pas la configuration distante. Ne pas mettre les variables serveur dans les fichiers `.env` publics ou les options `extra` Expo.

### Contrats de sécurité à conserver lors du déploiement

- `native-push` et `message-attachment-cleanup` utilisent un Bearer de worker vérifié dans le handler ; leur `verify_jwt=false` est limité à ces fonctions. Aucun destinataire/contenu arbitraire n’est accepté par le push.
- `account-deletion` vérifie `auth.getUser()` sur le bearer exact, confirmation explicite et authentification récente/MFA pour supprimer. Seul le reçu de statut reste lisible après suppression sans session vivante. Ne pas retirer les contrôles de facturation pour « débloquer » l’écran.
- `call-ice-config` revalide l’utilisateur et `can_call` avec son bearer avant toute fourniture de credentials ; jamais de secret TURN côté app. La présence du code Metered ne prouve pas son déploiement.
- Les changements de services et flags doivent être groupés par fonctionnalité et vérifiés en recette avant activation. Un flag activé sans worker fonctionnel n’est pas un correctif.

## Installation et recette à remettre au propriétaire

1. Conserver les identifiants existants, relier EAS et vérifier signatures/APNs/FCM. Produire la version preview autonome avec l’environnement retenu ; Expo Go et l’aperçu navigateur ne suffisent pas pour les modules natifs.
2. Installer sur un iPhone et un Android physiques. Noter version, numéro de build, modèle, version OS et réseau ; conserver les mêmes versions pendant la campagne de tests.
3. Créer uniquement des comptes de recette autorisés : coach A, joueur A dans son équipe, joueur B extérieur, admin et compte jetable de suppression. Aucun compte personnel ne doit servir au test de suppression.
4. Exécuter [la recette sur appareils](device-acceptance.csv). Chaque plateforme a une ligne distincte, initialement `NOT_EXECUTED`. Remplacer par `PASS`, `FAIL` ou `BLOCKED`, avec preuve datée sans donnée sensible. Tester la saisie caractère par caractère, pas seulement le remplissage automatique.
5. Priorité : connexion et retour de lien ; coach invite → inscription → rattachement → convocation → push → réponse ; publications et médias ; isolation des comptes ; suppression ; accès clavier et lecteur d’écran. Refaire les cas touchés après chaque correction.

Toute fuite entre comptes, suppression d’un tiers, perte de publication, crash au démarrage, absence de notification de convocation ou impossibilité de connexion bloque l’ouverture de la bêta club. Un défaut visuel mineur peut être suivi avec une solution connue. Ne pas transformer une limite non implémentée (appels entrants app fermée) en résultat de test « réussi ».

## Exploitation et élargissement

- Utiliser [le kit des clubs pilotes](pilot-kit.md) et les CSV fournis. Ne pas inviter automatiquement des clubs ou leurs membres : les invitations sont envoyées par les responsables autorisés dans le parcours normal.
- Chaque jour de bêta : lire les erreurs JS symboliquées, les tickets bloquants, le backlog push/reçus et la disponibilité des parcours principaux. Vérifier qu’une erreur crée une alerte reçue, sans identité ni contenu de messages.
- Chaque semaine : rapprocher invitations, inscriptions, premières actions utiles et retours J7/J30 ; revoir les erreurs médias et les usages coach/joueurs. N’élargir que si les équipes reviennent et que les problèmes bloquants sont résolus.
- Avant une campagne publique : restaurer une sauvegarde dans une cible isolée, tester la charge sur une recette séparée (jamais contre la production sans préparation), mesurer les volumes et les coûts vidéo/stockage/push. Aucune capacité d’un million d’utilisateurs n’est certifiée par ces commandes.
- En incident : stopper l’élargissement, identifier la version et le parcours, préserver les preuves anonymisées, corriger puis retester. Désactiver une fonctionnalité par son garde existant si nécessaire ; ne jamais effacer les journaux de reprise pour masquer un échec. Toute migration corrective doit préserver les données et être relue séparément.

Référence lue pour les prérequis SDK : [Expo 57](https://docs.expo.dev/versions/v57.0.0/).
