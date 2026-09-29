# Fil vidéo Expo — 27 septembre 2026

L’onglet Shorts lit les vidéos de `posts.video_url` et celles de `shorts`.
Aucune vidéo ni publication n’est copiée. Les photos et publications sans vidéo
restent hors de cet onglet. Les contenus masqués, les comptes suspendus et les
blocages sont filtrés par `get_video_repost_feed`, avec les droits du lecteur.

Chaque entrée conserve un identifiant composé de sa source et de son UUID.
Les likes, commentaires, signalements et republications ciblent la source
originale. Les créations/modifications locales invalident aussi le fil Shorts.
Le suivi utilise le badge de l’avatar ; le bouton rectangulaire est retiré.

La migration `supabase/migrations/20260926215215_short_reposts.sql` a été
activée sur FootNation le 27 septembre 2026 après autorisation explicite.
Elle ajoute `short_reposts` et les fonctions de republication/classement commun.
Les fonctions sont SECURITY INVOKER et réservées aux utilisateurs authentifiés.
La table applique RLS, n’autorise pas UPDATE et impose l’identité de l’auteur.
Un déploiement Expo précédant l’activation utilise une fusion des deux tables,
avec des curseurs indépendants pour ne pas sauter les vidéos plus anciennes.

Vérification : TypeScript, 59 tests ciblés (traduction, republication, pagination),
tests SQL dans une base PostgreSQL jetable (propriété, blocages, suspension,
modération, profils privés, pagination, annulation et idempotence). Contrôle du
preview web : vidéos Adams Sanut/Louis Helch, badge de suivi, bouton republier,
accès au commentaire existant sur la publication d’origine. Aucun commentaire,
like ou repost réel n’a été créé pour ces tests. Les droits déployés ont été relus.
La lecture vidéo et les interactions natives iOS/Android restent à recetter sur appareils.
