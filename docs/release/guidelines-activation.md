# Activation contrôlée des corrections

Projet : **FOOTNATION**, `zkvwqywtlkkkxmapehwe`. Après l’approbation explicite du propriétaire, les trois migrations du **lot A ont été appliquées ensemble le 24 septembre 2026 à 10:22 UTC**. Leur code exact est enregistré dans le journal Supabase. Le lot B et la distribution des interfaces restent distincts de cette autorisation. Voir le [compte rendu d’activation](guidelines-lot-a-activation-2026-09-24.md).

## Lot A — suppression des propriétaires et modération

| Ordre | Migration locale à relire | Effet concret |
| --- | --- | --- |
| 1 | `supabase/migrations/20260924120000_account_deletion_shared_spaces.sql` | Remplace les cascades de propriétaire par `SET NULL`, conserve les espaces/contributions, autorise la suppression du propriétaire après vérification du contrat. Empêche qu’un membre s’attribue un espace devenu sans propriétaire. |
| 2 | `supabase/migrations/20260924130000_content_moderation_workflow.sql` | Ajoute les colonnes manquantes du projet réel, décisions et révisions, file priorisée, retrait serveur des posts/shorts/stories et de leurs copies dans les actualités du club. Réserve les décisions aux administrateurs non suspendus. |
| 3 | `supabase/migrations/20260924131000_community_text_filter.sql` | Filtre limité de menaces/injures discriminatoires lors des écritures de textes membres, y compris par appel direct à l’API. |

Préconditions : examiner sauvegarde/restauration, la définition actuelle de `account_deletion_check`, les propriétaires et leurs droits dans les groupes/pages, les vues/fonctions/buckets qui exposent les contenus et les contraintes du projet. La première migration refuse une version du contrôle de suppression différente de son ancre attendue. Ne pas supprimer cette protection pour forcer l’installation.

Les tests `tests/account-deletion-shared-spaces.sql` et `tests/content-moderation-workflow.sql` ont de nouveau réussi sur une base PostgreSQL locale jetable avant l’application. Le schéma et les fonctions actuels ont été relus ; une copie du schéma, sans lignes utilisateurs, a été conservée localement. Les préconditions et contrôles de droits ont été exécutés dans la même transaction que les migrations. Ces contrôles ne valent pas recette réelle des fichiers Storage ou de Stripe. Les secrets du service de suppression et ses traitements externes n’ont pas été lus ni modifiés.

Ce lot ne supprime aucun compte, espace, contribution ou fichier lors de son application. Il change le comportement des prochaines suppressions et les droits de traitement des signalements. Publier les écrans de modération après la migration correspondante ; les anciennes actions de modification directe des signalements seront refusées. Aucun secret Apple n’est nécessaire pour ce lot.

Les catalogues ont été relus après validation de la transaction ; les trois versions et leurs empreintes correspondent aux fichiers approuvés. Pour la recette complète, utiliser uniquement des comptes dédiés dans un environnement isolé pour confirmer suppression, conservation des tiers, retrait, confidentialité et conflits de décisions. Examiner l’exploitation humaine selon [le mode opératoire](moderation-runbook.md).

## Lot B — admission sociale et Apple

Ce lot est distinct car la même base dessert le site et Expo. Le projet réel ne contient pas encore `get_member_access_status`, `get_social_signup_status` ni le reçu de révocation Apple.

1. Préparer et tester ensemble les migrations `20260912084000_member_age_registry.sql`, `20260912084100_member_age_access.sql`, `20260924100000_social_signup.sql` et `20260924110000_apple_auth_credentials.sql`. Le contrôle d’âge concerne aussi les comptes existants sans date de naissance : il ne doit pas être activé sans les clients compatibles.
2. Déployer la finalisation Web et Expo, le parseur des nouveaux états et la route d’aide/suppression accessible aux comptes restreints. Activer `VITE_MEMBER_ACCESS_ENABLED=true` avec le backend ; conserver les flags Google/Apple désactivés tant que leur recette complète n’est pas passée.
3. Déployer/configurer `age-consent`, `apple-auth-credentials` et la version associée d’`account-deletion`. Contrôler la délivrance d’emails avec des adresses de recette et la révocation Apple ; ne pas lire ou copier les clés dans une réponse ou un fichier versionné.
4. Dans Apple Developer, contrôler l’App ID `com.footnation.app`, Sign in with Apple, les identifiants/callbacks nécessaires, la clé serveur et la signature. Le titulaire doit fournir/configurer les secrets directement dans les consoles concernées. Le propriétaire n’a pas encore confirmé l’état de ce compte Apple Developer.
5. Google est activé à distance, mais le callback exact du build, le consentement et un vrai aller-retour restent à tester. Apple est désactivé. Suivre [social-auth.md](social-auth.md), y compris relais privé, nom absent, annulation et suppression.

Ne pas lancer `supabase db push` sur toutes les migrations du dépôt : beaucoup de travaux sans rapport coexistent dans l’espace de travail. Préférer un lot explicitement relu avec ses préconditions et un journal de migration, puis relire l’état réellement appliqué.

## Information et appareil

Publier la même politique de confidentialité depuis la source commune Web/Expo après rapprochement avec les services actifs ; valider [la matrice de données](app-privacy-matrix.md) avant de modifier App Store Connect. Aucun formulaire légal/store n’a été envoyé.

Le propriétaire a demandé de préparer la recette faute d’iPhone : [31 cas détaillés](recette-iphone-guidelines.md) et [grille vierge](recette-iphone-resultats.csv). Il reste nécessaire de produire/installer un build signé et de l’exécuter. L’approbation reçue couvrait uniquement les trois migrations du lot A : aucun achat, invitation à des testeurs, déploiement d’interface ou soumission n’a été effectué.
