# Audit des règles Apple — FootNation — 24 septembre 2026

## Périmètre et conclusion

Vérification demandée, **sans soumission ni distribution**. Corrections locales réalisées sur Expo, les services SQL associés et les éléments Web partageant ces services. Après inspection du projet Supabase **FOOTNATION**, le propriétaire a explicitement approuvé les trois migrations du lot A : elles ont été appliquées et vérifiées le 24 septembre à 10:22 UTC. Aucun compte réel, contenu, signalement ou fichier utilisateur n’a été supprimé ; aucun secret ou formulaire App Store Connect n’a été modifié. [Compte rendu d’activation](guidelines-lot-a-activation-2026-09-24.md).

La conformité complète reste **non démontrée** : le backend de suppression partagée/modération est installé, mais les nouveaux écrans restent locaux et l’admission sociale n’est pas activée ; Apple est désactivé ; les parcours fournisseurs, l’exploitation de modération et le binaire iPhone ne sont pas validés. Ce rapport distingue les tests passés de ce qui reste réellement à faire, sans promettre une approbation Apple.

Le propriétaire ne dispose pas d’iPhone et a demandé de préparer la recette. Livrables : [31 cas iPhone détaillés](recette-iphone-guidelines.md), [grille des résultats](recette-iphone-resultats.csv), [matrice des données](app-privacy-matrix.md), [procédure de modération](moderation-runbook.md) et [ordre d’activation](guidelines-activation.md).

## Résultats par sujet

| Sujet | Correction locale vérifiée | État réel / condition restante |
| --- | --- | --- |
| Suppression de compte, propriétaires de groupes/pages | La migration conserve l’espace partagé et les contributions des tiers ; le propriétaire devient NULL, sans promotion d’un autre membre. L’interface explique les conséquences. Tests SQL de suppression, rollback, autorité, espaces privés et dérive CASCADE passés. | Migration installée : propriétaires nullables, `ON DELETE SET NULL`, ancien blocage global remplacé par le contrôle de conservation. Droits et définitions relus sur le serveur. Storage, facturation et révocation doivent faire l’objet de leur recette réelle. |
| Connexion Google/Apple | Boutons Expo, PKCE, nonce/state Apple, finalisation du profil, consentement/âge et révocation serveur préparés. Le Web comprend désormais les états sociaux et un formulaire compatible ; activation coordonnée par `VITE_MEMBER_ACCESS_ENABLED`. | Google activé, Apple désactivé, fonctions d’admission sociale et reçu Apple absents du projet réel. Apple Developer et signatures non confirmés. Aucun vrai aller-retour fournisseur validé. |
| Contenu communautaire | File Expo/Web priorisée, décisions motivées avec révision et contrôle admin non suspendu, retrait par RLS, protection des copies dans le fil du club. Statuts consultables dans Mes signalements. Filtre serveur limité sur certains textes, sans suppression automatique des contributions de tiers. | Workflow et filtre installés sur FOOTNATION, droits et disponibilité API vérifiés. Nouveaux écrans non distribués. L’équipe, les permanences, la réception du contact et le retrait des médias/caches doivent être confirmés. Aucun classificateur multimédia ni surveillance humaine continue ne sont prouvés. |
| Confidentialité | Site et Expo utilisent la même politique locale ; collecte liée au compte, diagnostics conditionnels, notifications, appels et traduction expliqués. Correction du rendu Web par tableaux de traduction positionnels. Matrice des catégories Apple préparée. | Le texte local n’est pas encore publié sur le site ; déclaration App Store non consultée/modifiée. Fournisseurs réellement actifs, contrats/transferts, durées des logs/caches/sauvegardes et purges à rapprocher. |
| Permissions / accessibilité | Sélection d’images pro sans exigence d’accès à toute la photothèque ; lien vers les réglages après refus caméra sur Publication. Composants communs avec libellés/états et erreurs accessibles. | TypeScript, tests et export JavaScript passent sur Expo. Aucun iPhone, aucune archive signée, aucun VoiceOver natif testé. Les 31 cas restent `NOT_EXECUTED`. |

## Preuves de l’inspection distante

Contrôle après activation via Supabase CLI puis transaction PostgreSQL en lecture seule, sans lignes utilisateurs. Paramètres publics Auth lus séparément. Preuve reproductible : `mobile-expo/backend/audit-app-guidelines.py` ; [état actuel expurgé de secrets](guidelines-backend-observations.json), [état initial](guidelines-backend-before-lot-a.json) et [preuve d’installation](guidelines-lot-a-activation-2026-09-24.json).

- Projet lié : `zkvwqywtlkkkxmapehwe`, nom **FOOTNATION**.
- Auth : `google=true`, `apple=false`, `email=true`.
- Présents : `account_deletion_check`, `account_deletion_shared_spaces_check`, `is_site_admin`, `prune_native_growth_activity`, `can_review_content`, `review_content_report`, `community_text_rejected` et `guard_community_text`.
- Absents : `get_member_access_status`, `get_social_signup_status`, `apple_deletion_receipt`.
- `groups.created_by` et `pro_pages.owner_id` : nullables, `ON DELETE SET NULL`. Le contrôle de suppression vérifie la conservation des espaces ; les fonctions d’autorité refusent qu’un autre membre s’attribue un propriétaire absent.
- `user_reports` : colonnes admin, revue, cible, révision et priorité ajoutées ; décisions via la procédure autorisée. Les modifications directes des anciens écrans sont désormais refusées.
- RLS activée sur posts, shorts, stories et user_reports. Cela ne prouve pas la sûreté de toutes les fonctions à clé de service, des vues, des buckets ou des caches.
- Versions `20260924120000`, `20260924130000` et `20260924131000` enregistrées ; empreintes des sources relues et identiques au lot approuvé. Les versions d’admission sociale et Apple restent absentes.

## Validation locale

- Expo : `npm test` réussi, **142 fichiers / 1 234 tests Vitest**, plus **12 tests core et 6 tests release** ; contrôle des interfaces natives réussi.
- Expo : `npm run typecheck` réussi.
- Export Expo iOS, Android et Web réussi dans `/tmp/footnation-guidelines-export-20260924`. Ce sont des bundles, pas une archive iPhone signée.
- Base PostgreSQL jetable : suppression partagée, modération et filtre texte testés avec rôles anon/authenticated/service et comptes synthétiques. Cluster arrêté après test. Aucun SQL de fixture exécuté sur FOOTNATION.
- Web : **4 fichiers / 25 tests ciblés réussis** pour la garde d’accès, le formulaire social et les retours d’authentification. Compilation Vite réussie dans `/tmp/footnation-guidelines-web-20260924`, avec copie des fichiers publics désactivée pour cette vérification : ce dossier n’est pas un site complet à distribuer. Le contrôle TypeScript global reste en échec sur des fichiers hors du présent lot, notamment ProfileDemo, ClubAdminDashboard et les types de pages pro ; aucune certification globale du site n’est donnée.
- Diff du périmètre contrôlé : pas d’erreur d’espacement signalée.
- Le navigateur de contrôle n’a pas permis de reprendre les onglets (délais dépassés). Aucune nouvelle validation visuelle manuelle n’est revendiquée pour ces écrans.

## Limites à fermer

### Suppression

La protection de la propriété partagée est corrigée sans supprimer les données d’autrui. Les dépendances inconnues, anciennes copies de données sans clé étrangère, achats non attribués, fichiers sans propriétaire et services externes nécessitent encore la revue prévue dans le README du service. Un échec partiel ne doit jamais être présenté comme une suppression réussie. Confirmer aussi le cas Apple ancien sans jeton, sa révocation et la conservation des reçus.

### Admission et connexion

Ne pas déployer isolément le contrôle d’âge sur le backend commun : les clients Web/Expo doivent proposer l’écran approprié, y compris pour les comptes existants sans date. Le consentement déclaré par email ne vérifie pas l’identité ou l’autorité parentale. Les liens d’aide et de suppression restent accessibles aux comptes restreints. Le seuil d’inscription n’est pas automatiquement la classification d’âge App Store.

### Modération

Le filtre serveur est une défense supplémentaire contre quelques menaces/injures explicites ; il ne couvre pas toutes les langues ni les médias. Le retrait d’une ligne du fil ne révoque pas une URL publique déjà diffusée. Une procédure adaptée aux fichiers, aux caches et aux contenus illicites doit compléter le workflow. Un signalement sans cible vérifiée peut être examiné/classé, mais ne doit pas permettre un retrait arbitraire.

### Données, droits et paiements

Rapprocher le document commun, la version publique et les réponses App Store avec les données et tiers actifs. Vérifier que les nettoyages annoncés tournent réellement ; la présence de la fonction de purge d’activité ne prouve pas l’exécution du cron. Ne pas déclarer « aucune collecte » ou « anonyme » pour des données associées à un compte.

Aucun checkout numérique n’a été ajouté à Expo. Les CGV et droits Premium du site restent à rapprocher du modèle réellement distribué. Les licences des musiques/images/vidéos/actualités incorporées ne sont pas prouvées par une simple attribution ; réunir les justificatifs ou retirer les assets concernés.

### iPhone et déclarations App Store

Le Mac ne dispose pas de Xcode complet/simulateur et le propriétaire n’a pas d’iPhone de test. La recette préparée doit être exécutée sur un build signé ; prévoir aussi iPad si le support est conservé. Les déclarations de confidentialité, d’accessibilité, les manifestes SDK et les informations publiques doivent suivre les résultats du binaire réel. Aucun test automatisé local ne remplace cette étape.

## Références officielles

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) : 1.2, 1.5, 2.1, 2.3, 3.1, 4.8, 5.1, 5.2.
- [Suppression du compte dans l’application](https://developer.apple.com/support/offering-account-deletion-in-your-app/).
- [Confidentialité et partenaires](https://developer.apple.com/app-store/app-privacy-details/) et [manifestes de confidentialité](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files).
- [Déclarations d’accessibilité](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels).
- [Expo SDK 57 ImagePicker](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/) ; [Expo Apple Authentication](https://docs.expo.dev/versions/v57.0.0/sdk/apple-authentication/) ; [Supabase Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple).
