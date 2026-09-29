# Support, profil et CV — 27 septembre 2026

## Réalisé localement

- Conversations privées d’aide accessibles depuis Contact, le centre d’aide, Messages et l’administration. Statuts En cours, Résolu et Terminé, historique, réouverture, pagination et réponse du superadmin (`profiles.is_admin`). Un nouveau message rouvre une demande résolue ; un ticket terminé doit être rouvert explicitement.
- Bulles facultatives de stories : jusqu’à 12 collections de 20 stories, titre, couverture, modification et suppression par le propriétaire. Une copie explicitement épinglée reste consultable après expiration de la story. Une modération de la story source retire aussi la copie épinglée. La modération ultérieure d’une publication issue d’une conversion de story ne modère pas automatiquement cette copie.
- Présence au premier plan : bail de 75 secondes par session, renouvelé toutes les 25 secondes, lecture toutes les 15 secondes. Pas d’historique d’activité, pas de présence présumée en cas d’erreur. Les sessions fermées brutalement expirent ; quitter un appareil ne masque pas les autres sessions actives. Confidentialité du profil, suspensions et blocages contrôlés côté serveur.
- Anneau/bouton bleu-violet-rouge pour les stories non vues, indicateur vert de présence.
- QR personnalisé par profil, avec photo au centre ou logo FootNation incluant la Bosnie. Correction d’erreurs élevée et quatre modules de marge. Même QR dans l’aperçu et le PDF du CV.
- CV A4 sur une page : mise en page commune à l’aperçu et à l’impression, PDF web vectoriel. Les longs parcours sont synthétisés avec renvoi explicite au profil complet. Le fichier Word reste éditable ; sa pagination dépend du logiciel qui l’ouvre.
- Globe bleu-violet-rouge conservant les trois tours initiaux et la séquence de drapeaux. Actualités éditoriales retirées de Mon réseau et conservées dans Pour vous.

## Activation serveur effectuée

Les deux migrations ont été appliquées le 27 septembre 2026 au projet Supabase FOOTNATION (`zkvwqywtlkkkxmapehwe`), après accord explicite de l’utilisateur :

1. `supabase/migrations/20260927110924_support_conversations.sql`
2. `supabase/migrations/20260927110938_profile_story_collections_presence.sql`

Les noms locaux sont alignés sur les versions réellement enregistrées par Supabase afin d’éviter une nouvelle application accidentelle. Les contenus SQL sont ceux testés et approuvés, initialement datés `20260927095903` et `20260927100910`.

Les prérequis ont été confirmés sur la cible avant application. Vérification après application : quatre tables protégées par RLS, aucun accès direct pour anon/authenticated, onze RPC publics réservés aux comptes authentifiés, quatre fonctions internes inaccessibles aux clients, déclencheur de modération actif et contrat de suppression de compte mis à jour. Trois appels sans identité ont été refusés par les contrôles serveur. Les demandes d’aide et les sources de stories chargent sur l’application connectée au serveur réel ; l’indicateur En ligne est visible sur le profil connecté.

Les nouvelles observations du contrôleur Supabase sont attendues pour cette architecture : [RLS sans politique](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) sur des tables sans accès direct, et [fonctions SECURITY DEFINER authentifiées](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) contrôlant l’identité et les permissions avant chaque accès. Aucun nouveau signalement d’accès anonyme ni d’absence de RLS. Les alertes antérieures hors périmètre n’ont pas été modifiées.

Les clients n’ont pas d’accès direct aux nouvelles tables : accès via RPC authentifiés, contrôle du compte, permissions du demandeur/admin, limites et révisions. Aucun e-mail ni notification push n’est envoyé par ce dispositif. Les conversations se mettent à jour par interrogation tant que l’écran est ouvert.

## Sélecteur de lieu des stories

Le champ Lieu utilise le sélecteur existant des villes (recherche par nom ou code postal). La sélection conserve le nom de la ville et le département, avec la limite existante de 150 caractères. Le champ reste facultatif ; les tentatives de publication déjà conservées restent verrouillées.

## Vérifications

- Tests SQL isolés : `tests/support-backend.sql` et `tests/profile-social-backend.sql`, dans un PostgreSQL jetable, sans réseau et sans données réelles : réussis.
- Tests CV/exports, QR sans photo et contrôle de session des RPC : 20 tests réussis.
- PDF synthétique long rendu puis inspecté : une page, QR avec logo décodé vers le profil attendu.
- Recette d’interface via `scripts/audit/start-ui.mjs`, comptes et données fictifs, réseau limité aux ports locaux. Création/réponse/statuts des tickets et création/modification de bulle vérifiés, saisie caractère par caractère sans perte de focus. QR sans avatar inspecté dans le navigateur.

- Compilation TypeScript, contrôle JSX natif et exports Expo Web/iOS/Android réussis. Le contrôle Git global signale des défauts préexistants hors périmètre (sitemap et import Scorenco) ; ces fichiers n’ont pas été modifiés.

Les builds installés sur appareils et la réception effective d’une nouvelle demande réelle restent à valider sur l’environnement cible. Aucun ticket de test n’a été créé sur le serveur réel.
