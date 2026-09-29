# Super admin Expo — implémentation et recette du 24 septembre 2026

## Livraison locale

Les rubriques du Super admin Web sont reprises dans Expo, avec des composants React Native communs au Web, à iOS et à Android. Les listes deviennent des cartes sur téléphone ; les sélecteurs et confirmations utilisent un panneau inférieur. Sur grand écran, les rubriques sont visibles et les fenêtres sont centrées. Thèmes, Inter, zones tactiles et états de chargement/erreur réutilisent les composants de l’application.

Référence fonctionnelle : `src/pages/Admin.tsx`, `src/pages/AdminUserEdit.tsx`, leurs composants et hooks Web. L’accès Web de production a redirigé vers la connexion : le parcours authentifié de production n’a pas été validé. Aucun contenu, compte, e-mail, justificatif ou secret réel n’a été modifié pour cette recette.

| Rubrique | Fonctionnalités reprises |
| --- | --- |
| Vue d’ensemble | Comptages globaux, inscriptions, activité, répartitions et classements, liens vers les listes et profils |
| Performances | Jour/semaine/mois, inscriptions, séries GA4, valeurs accessibles des graphiques, tendances, complétude, densité du réseau, activité et installations iOS/Android |
| Utilisateurs | Recherche, filtres et tri serveur, pagination, accès à la fiche, Premium et suspension |
| Profils incomplets | Sept champs réellement renseignés, filtres Tous/Complets/Incomplets, tri, relances et historique, dérogation explicite sans inventer de données |
| Clubs | Recherche et pagination, édition des champs autorisés, suspension, suppression confirmée, profil public |
| Données sportives | Suivi de la collecte existante, volumes, files, erreurs récentes et liens clubs |
| Revendications | Filtres, recherche, justificatifs à durée limitée et décision atomique du circuit existant |
| Premium | Liste des bénéficiaires, attribution/retrait confirmé |
| Publications | Recherche, accès au contenu et à l’auteur, suppression confirmée |
| Modération | Signalements utilisateurs/contenus, messages signalés et blocage atomique du message avec sa décision |
| PostHog | Tableau partagé configurable ; intégration Web et ouverture externe sur mobile, sans ajout de collecte |

Les huit rubriques d’une fiche utilisateur sont : **Profil, Contenu, Réseau, Favoris, Annonces, Activité, Complétude, Administration**. Elles couvrent les publications/vidéos/photos, connexions/abonnements/blocages/signalements, clubs et éléments enregistrés, candidatures/événements, sessions/vues/interactions/évaluations/réactions, ainsi que l’administration du compte Auth.

L’édition conserve un brouillon et une version de référence. Une modification concurrente provoque un conflit explicite ; « Recharger et annuler le brouillon » permet de repartir de la fiche actuelle. L’association à un club utilise son identifiant et son nom canonique, avec suivi atomique. Les tableaux sont paginés côté serveur, sans plafond silencieux de 1 000 profils.

Les MRR/ARR sont des **simulations** reprenant le tarif de référence de l’écran Web (9,99 € × membres Premium), pas des revenus encaissés. Les sources de rétention et de coût d’acquisition restent signalées comme indisponibles. Aucune mesure manquante n’est remplacée par un zéro inventé.

## Backend activé après approbation — 24 septembre 2026

La migration `supabase/migrations/20260924123723_admin_console.sql` est appliquée au projet **FOOTNATION** (`zkvwqywtlkkkxmapehwe`). Elle ajoute le contrat paginé, les agrégats, les mutations autorisées, les versions de lignes, le journal des motifs et les reçus d’opérations. Les droits sont vérifiés côté serveur : un membre, un anonyme ou un administrateur suspendu ne peut pas utiliser ces RPC. Les champs sensibles non prévus, notamment `is_admin`, ne sont pas modifiables par l’éditeur.

La fonction `supabase/functions/admin-console-account/` prend en charge les opérations Auth, les relances et l’autorisation d’envoi d’avatars. Elle valide le bearer auprès d’Auth, le profil administrateur actif et une authentification récente pour les changements sensibles. Les mots de passe/adresses ne sont pas journalisés. Une opération externe à l’issue incertaine n’est pas rejouée automatiquement. La suppression réutilise le circuit existant (facturation, Apple, médias et finalisation).

Les fonctions `admin-console-account` **v2**, `ga4-analytics` **v7** et `get-mobile-stats` **v7** sont actives. La validation JWT du gateway est activée pour les trois ; le handler vérifie aussi le bearer auprès d’Auth et le statut d’administrateur actif. Le garde-fou commun est dans `supabase/functions/_shared/admin-profile.ts`. Les sources récupérées après déploiement correspondent au paquet contrôlé.

La vérification du schéma réel a également permis de corriger le stockage des avatars : le bucket existant est **avatars**, pas public. Le frontend et l’edge utilisent maintenant ce bucket. La migration complémentaire `20260924124200_admin_console_avatar_bucket.sql` autorise ce rattachement en conservant la compatibilité du nettoyage des anciens chemins. Aucun fichier utilisateur n’a été envoyé ou supprimé pour cette vérification.

L’endpoint des statistiques mobiles accepte maintenant les en-têtes CORS réellement envoyés par Expo Web. Il distingue une mesure égale à zéro d’une erreur de lecture, renvoie une erreur neutre si les données sont indisponibles et désactive la mise en cache.

Les versions de migration ont été alignées sur l’historique effectivement enregistré par Supabase. Le déploiement a utilisé un paquet isolé : le `memberAgeGate` présent dans deux sources locales appartient à un autre lot dont les RPC ne sont pas encore installées. Ce garde n’a pas été activé ici ; ses modifications locales ont été conservées. **Ne pas redéployer directement tout le répertoire des fonctions sans traiter ce lot séparé.** Aucun autre ensemble de migrations ni paramètre Auth n’a été appliqué.

Contrôles après activation :

- **34 ressources paginées** lues avec succès sur le schéma réel, sans afficher leurs données personnelles dans le rapport ; vue d’ensemble jour/semaine/mois et pagination des clubs validées.
- Transactions de vérification **en lecture seule** : accès administrateur actif accepté ; lectures et mutation refusées à un membre ; identité absente et rôle anonyme refusés. Aucune mutation autorisée sur un profil réel n’a été tentée. Le refus d’un administrateur suspendu est testé localement ; aucun compte réel n’a été suspendu pour la recette.
- RLS active sur les quatre tables internes et aucun droit direct de lecture/écriture pour anon/authenticated.
- **9 vérifications HTTP réussies** : préflight CORS, token absent, token invalide pour chacune des trois fonctions. Ces contrôles confirment leur démarrage et leurs refus d’accès, pas les appels externes avec une vraie session administrateur.
- **68 tests ciblés** sur cinq fichiers, contrat SQL jetable et TypeScript réussis après les dernières corrections.

La sauvegarde privée du schéma public et des fonctions remplacées, le paquet et ses empreintes sont dans `/tmp/footnation-super-admin-activation/` (fichiers réservés au propriétaire). Les versions et contrôles sont consignés dans [super-admin-activation-2026-09-24.json](./super-admin-activation-2026-09-24.json). Les sauvegardes sont locales et temporaires ; aucune donnée de compte ni clé serveur n’est ajoutée au dépôt.

Restent à configurer ou valider :

1. **Suppression de compte non activée** : les paramètres `ACCOUNT_DELETION_ENABLED`, `ACCOUNT_DELETION_BILLING_AUDITED`, `STRIPE_SECRET_KEY` et les RPC de révocation Apple nécessaires sont absents. Le service refuse la suppression ; les contrôles de facturation et de révocation ne sont pas contournés. La simple présence du bouton ne signifie pas que ce parcours est opérationnel.
2. Les noms des secrets GA4, Resend et SITE_URL sont présents ; leurs valeurs n’ont pas été affichées. L’envoi réel de relance/réinitialisation, les changements Auth, l’upload signé et les statistiques GA4 doivent être testés avec une session autorisée et des comptes de recette. Aucun e-mail réel n’a été envoyé ici.
3. Configurer facultativement `EXPO_PUBLIC_POSTHOG_DASHBOARD_URL` avec un tableau partagé destiné à cette exposition, jamais une clé privée. Aucun SDK de suivi PostHog n’est ajouté.
4. Terminer la recette visuelle et sur appareils indiquée ci-dessous. Les bundles exportés précédemment ne sont pas des builds natifs signés installés.

L’activation a été approuvée explicitement par l’utilisateur, conformément à l’autorisation séparée demandée dans `AGENTS.md`.

## Avis de sécurité après activation

La comparaison avant/après ajoute quatre avis informatifs [RLS sans politique](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) : ces tables sont volontairement internes, sans droits clients directs. Les trois nouvelles RPC accessibles aux sessions authentifiées déclenchent l’avis [SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) ; elles vérifient toutes l’identité et le profil administrateur actif avant toute lecture ou mutation. Les contrôles réels de refus passent. Les trois index ajoutés sont encore signalés [non utilisés](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), ce qui est attendu immédiatement après création de tables vides.

Les autres avis préexistaient, notamment [RLS désactivée](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public), fonctions exposées et chemins de recherche non fixés, protection contre les mots de passe compromis désactivée et version PostgreSQL à mettre à jour. Ils ne constituent pas une validation globale de sécurité du projet et ne sont pas corrigés par ce lot Super admin.

## Vérifications locales

| Vérification | Résultat |
| --- | --- |
| Suite Expo finale | 1 302 tests Vitest, 147 fichiers, tous réussis ; 12 tests Node et 6 tests de préparation à la livraison réussis |
| TypeScript Expo et composants natifs | Réussis après les dernières corrections |
| Contrat SQL PostgreSQL 16 | Réussi dans un cluster jetable, socket privé et réseau désactivé ; 1 005 profils fictifs |
| Handler et adaptateur serveur | Tests d’authentification, réauthentification, révocation, idempotence, Auth, e-mails simulés, suppression et rattachement d’avatars ; vérification TypeScript réussie |
| Exports Web, iOS, Android | Réussis dans `/tmp/footnation-super-admin-export` ; bundles JavaScript/Hermes, pas des applications signées installées |
| Recette visuelle avant déconnexion du navigateur | Vue d’ensemble à 1 280 px ; listes, recherche, navigation et confirmation Premium à 390 px ; attribution fictive confirmée et retour affiché |

Les tests SQL utilisent les colonnes réelles extraites du schéma de référence et des données synthétiques. Ils contrôlent les droits, filtres/pagination, valeurs attendues, compteurs, mutations, reçus et rattachement des avatars. Ils ne reproduisent pas tous les triggers de production ni une suppression de compte réelle de bout en bout.

Les sessions navigateur ont permis de trouver et corriger l’en-tête des noms longs sur téléphone, les filtres internes affichés sans libellé et le filtre « Tous » qui revenait sur « Incomplets ». Le navigateur s’est ensuite déconnecté. **Le contrôle visuel des dernières corrections, de toutes les rubriques, des largeurs 360/768 px et du thème sombre reste à reprendre** ; ne pas le présenter comme terminé.

Journaux locaux :

- `/tmp/footnation-super-admin-tests-final.log`
- `/tmp/footnation-super-admin-export-final.log`
- `/tmp/footnation-admin-pg.Mmhi41/result.log`
- `/tmp/footnation-admin-pg.79Is0t/result.log` (contrat après correction avatars)
- `/tmp/footnation-super-admin-activation/http-checks.json`

## Relancer la recette sans données réelles

Depuis `mobile-expo`, utiliser Node 22 :

```sh
npm run typecheck
npm test
sh scripts/test-admin-console-sql.sh
AUDIT_SUPER_ADMIN=1 AUDIT_WEB_PORT=8083 AUDIT_API_PORT=7083 npm run audit:ui
```

Le lanceur crée une copie temporaire, enlève les variables de production, utilise une session séparée et bloque les requêtes sortantes autres que les deux ports locaux. Ouvrir `http://localhost:8083/admin`, compte `admin@fixture.test`, mot de passe fictif au choix. Les mutations et les e-mails restent simulés en mémoire. Redémarrer le lanceur après une modification des sources. Adapter les deux ports ensemble en cas de conflit.

## Recette sur iPhone et Android à effectuer

L’environnement ne dispose pas d’iPhone, de simulateur iOS ni de chaîne Xcode complète. Aucune validation VoiceOver/TalkBack ou caméra native n’est revendiquée.

1. Installer un build de recette relié à un backend de test activé. Parcourir les 11 rubriques et les 8 rubriques d’une fiche, en portrait/paysage et avec de grands caractères. Vérifier les noms longs et l’absence de logo.
2. Avec VoiceOver puis TalkBack : suivre l’ordre des titres, ouvrir les sélecteurs, vérifier l’annonce de l’onglet choisi, les libellés d’action, la fermeture des fenêtres et les valeurs textuelles des graphiques.
3. Avec le clavier ouvert : chercher un profil caractère par caractère, modifier un champ multiligne et saisir le motif d’une confirmation. Vérifier que la saisie et les boutons restent accessibles. Le retour Android ferme d’abord la fenêtre.
4. Tester les thèmes clair/sombre et la réduction des mouvements. Vérifier la zone sûre en bas d’écran et les gestes système.
5. Autoriser puis refuser l’accès aux photos pour un avatar fictif. Contrôler l’envoi, le chargement, l’erreur réseau et la conservation du brouillon. Ne pas utiliser un justificatif réel.
6. Tester annulation/confirmation Premium et suspension, modification concurrente dans deux sessions, changement de compte et révocation des droits. Aucune donnée admin ne doit rester visible après déconnexion.
7. Tester les liens profils/clubs/publications, les justificatifs temporaires et le tableau PostHog configuré. Vérifier le retour dans l’application.
8. Sur des comptes jetables uniquement, contrôler le circuit réel de réinitialisation, de relance et de suppression. Vérifier l’absence de double envoi après une réponse réseau incertaine.
