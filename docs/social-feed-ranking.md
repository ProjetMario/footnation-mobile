# Flux « Pour toi » équilibré — balanced-v1

Le flux de l’application Expo, partagé par le web membre et les apps natives, classe des fenêtres de 40 publications accessibles. Les pages de profil, vidéos, visiteurs et le filtre Réseau conservent leur comportement. Aucun appel OpenAI n’est effectué pendant la lecture du flux.

Le score combine : fraîcheur (35 points, décroissance exponentielle sur 48 h), réseau suivi/connexions acceptées (28 points, décroissance sur 7 jours), affinités football explicitement renseignées (20 points maximum : club, clubs favoris, poste), département (8 points), engagement plafonné (7 points maximum, réactions uniques par utilisateur, commentaires plafonnés et décroissance sur 72 h). Une publication personnelle récente bénéficie d’un bonus temporaire ; les anciennes ne restent pas systématiquement en tête. Aucun bonus lié au format vidéo/image, à la longueur de texte, au premium ou à des attributs sensibles.

La sélection réserve les positions 3, 8, 13… à une découverte récente lorsqu’une candidate existe. Elle essaie de ne pas répéter l’auteur des deux dernières publications et de ne pas dépasser deux publications du même auteur dans dix positions. Ces limites sont souples si le stock ne contient qu’un auteur ; aucun contenu n’est supprimé pour forcer la diversité. Ces règles et poids constituent une hypothèse produit initiale, pas des paramètres déjà validés par une expérience.

Les candidates proviennent d’une RPC SECURITY INVOKER qui conserve RLS, masquage de modération, suspension et blocages dans les deux sens. Les contenus masqués personnellement sont exclus avant le classement. Les relations sont lues seulement pour les auteurs de la fenêtre courante. Le classement ne peut pas rendre accessible un contenu privé.

Pagination : curseur `(created_at,id)` descendant, instant de référence fixé pour la navigation, progression à partir des candidates brutes même si elles ont été masquées/supprimées avant l’affichage. L’ajout d’une fenêtre ne reclasse pas les fenêtres précédentes. Le contexte de diversité passe entre fenêtres. Un rafraîchissement explicite/rechargement du cache peut produire un nouvel ordre. Les égalités sont déterministes.

Limite de cette première version : personnalisation parmi les 40 candidates chronologiques de chaque fenêtre, et non une recherche sémantique sur tout l’historique. Un très gros volume pourrait nécessiter un prélèvement distinct réseau/intérêts/découverte côté serveur. Pas encore de score basé sur le temps de visionnage ou l’historique comportemental. L’évaluation suivante devrait mesurer diversité des auteurs, publications masquées/signalées, interactions utiles et ouverture d’opportunités, plutôt que seulement le temps passé.

Activation : appliquer, après approbation, uniquement `20261028230116_personalized_social_feed.sql`, puis publier le frontend. Si cette RPC n’existe pas encore, le flux existant reste disponible. Les erreurs d’autorisation et réseau ne déclenchent jamais cette compatibilité. Un flux déjà paginé avec l’ancien moteur le conserve jusqu’au rafraîchissement.

Tests : `tests/socialFeedRanking.test.ts`, `tests/feedAccess.test.ts`, vérification TypeScript Expo et `../tests/social-feed-ranking.sql` (dans le cluster jetable créé par `../scripts/test-opportunity-decisions-sql.sh`).

La recette `node scripts/audit/social-feed-ui.mjs`, après démarrage du serveur isolé `AUDIT_SUPER_ADMIN=1 AUDIT_WEB_PORT=8097 AUDIT_API_PORT=7097 node scripts/audit/start-ui.mjs`, vérifie aussi le branchement réel de l’écran sur les candidates, la lecture des publications et l’explication « Dans votre réseau ». Elle utilise uniquement des données fictives et bloque les requêtes externes.
