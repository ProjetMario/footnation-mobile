# Qualité mobile — 9 septembre 2026

## Dernier lot — préparation de distribution, 10 septembre

Voir le [checkpoint des six étapes](release/checkpoint-2026-09-10.md) pour les ajouts de cette nuit et leurs preuves. Tests automatisés, bases SQL jetables, petites tailles Web et exports sont distingués de la recette iOS/Android. Les 36 cas de [recette sur appareils](release/device-acceptance.csv) restent marqués non exécutés ; aucun test sur téléphone n’a été déduit des contrôles Web.

Les contrôles Web complémentaires couvrent les filtres matching/opportunités, le catalogue de musique, la lecture d’un extrait synthétique, la géographie en arabe/anglais et le parcours sportif après correction de la colonne historique absente. Les copies privées de fichiers, interruptions audio, reprises hors ligne et changements de compte ont reçu des tests et revues dédiés. Aucun message, parcours ou média réel publié pour ces vérifications.

## Contrôle du 10 septembre — thèmes et contenu d’abord

La dernière référence « DO / DON’T » prime sur les étapes historiques ci-dessous : deux filtres seulement (Pour vous / Mon réseau), stories compactes sur une rangée, première publication dès l’ouverture, scores après elle. Les icônes existantes et les destinations du menu sont conservées. Couleurs claires/sombres et Inter embarquée ; sélection Automatique / Clair / Sombre persistée sur cet appareil, sans remontage de l’authentification.

Vérifié dans l’aperçu Web : clair à 320 × 568, sombre à 390 × 844, mode naturel en paysage à 640 × 360, menu et paramètres. À 320 px : aucun débordement horizontal, auteur du premier post à y≈203 ; les deux passages PageDown isolés s’arrêtent successivement à 568 et 1 136 px. Le bandeau de scores commence à y=8 de la deuxième page, avec logos réels et défilement. L’aperçu de QA séparé a permis ce contrôle sans interférer avec le navigateur principal. Le thème sombre reste sélectionné après rechargement ; le choix automatique a été rétabli après les essais. La saisie séquentielle « foot » conserve la valeur et le focus.

Le nouveau modèle d’ancrage couvre aussi la publication placée dans l’entête : insertion avant elle, promotion d’une ligne en premier post, suppression, footer, actualisation pendant un geste et changement de mode à la rotation. Les vidéos utilisent la couverture du viewport en mode naturel et restent exclusives. Les petites hauteurs/grandes polices désactivent le snap lorsque la place nécessaire aux commandes n’est plus disponible.

Checkpoint design : **473 tests passent** (8 cœur + 465 Vitest dans 71 fichiers), TypeScript, garde JSX natif et formatage validés. Les exports Web, Android et iOS sont produits dans `dist-native`. Le test géométrique du ballon a dépassé sa limite pendant un premier passage chargé ; il a ensuite passé en isolation et dans la suite complète sans changement du timeout. Plist iOS et ressources XML Android valides. Ces exports ne sont pas des applications signées ; les essais sur téléphones et les validations des stores restent à réaliser.


## Matchs, profils et stories de l’accueil

Scores réels des grands clubs via les scoreboards ESPN de Ligue 1, Premier League, Liga, Serie A, Bundesliga et Ligue des champions. Le service FootNation sert de secours ; son paramètre date utilise maintenant la query string GET attendue. Les valeurs absentes restent des tirets. Les statuts terminaux priment sur une minute persistée ; un résultat déjà final ne régresse pas à un ancien LIVE provenant d’une autre plage de cache. Son horodatage initial reste conservé. Les réponses d’erreur HTTP 200 du service sont traitées comme des indisponibilités.

L’accueil interroge la fenêtre aujourd’hui/hier pour les matchs passant minuit : une minute en présence d’un direct, cinq minutes autrement. L’historique de quatorze jours est séparé, conservé trente minutes et sans polling. Six ligues maximum, trois requêtes simultanées, délai limite et annulation. Les jours UTC voisins sont inclus avant filtrage sur le jour local. L’activité cesse lorsque l’écran ou l’introduction n’est plus visible ; le gestionnaire de connexion suspend les lectures hors ligne. La disponibilité et les délais restent ceux des fournisseurs publics, sans garantie de score instantané.

La rangée de stories utilise uniquement des profils lisibles, une bulle par auteur, une story non expirée et des noms/photos réels. Elle filtre les blocages dans les deux sens, les profils privés et les suspensions. Deux échantillons de membres (général et avec photo) évitent de mettre les anciens identifiants techniques en première position. L’avatar ouvre la story active ou le profil ; le nom ouvre le profil ; l’ajout personnel conserve une cible de 44 points. La découverte reste bornée et respecte les règles de lecture existantes, avec leur exception administrateur.

Contrôles Web : scores et logos chargés depuis ESPN, fiches datées avec le même match et son stade, calendrier européen depuis « Tous », profil depuis sa bulle. À 320 × 568 : largeur du document de 320 px, commandes du haut de 44 × 44 px, cartes de score de 196 × 60 px avant agrandissement pour les logos, pages du fil de 568 px. Les tests de statuts, cache, calendrier/fuseaux, délais réseau, confidentialité et regroupement utilisent des données synthétiques. Aucun profil, message, pronostic ou story créé pour ces contrôles.

Recette à faire sur appareils : gestes du bandeau et du pager, reprises réseau, VoiceOver/TalkBack, préférences Réduire les animations et grande police. L’aperçu Web et les exports JavaScript ne remplacent pas des essais iOS/Android.

Logos des équipes chargés avec Expo Image, repli sur l’abréviation si une image manque ou échoue. Boucle Reanimated à 22 points/seconde, glissement manuel, pause/reprise de 52 × 60 points minimum. La copie visuelle est masquée pour l’accessibilité et exclue du parcours clavier. Le Web respecte Réduire les animations et le focus : son API de lecteur d’écran renvoie une constante, elle ne permet pas de détecter réellement VoiceOver. À 320 px, progression mesurée de 264,5 à 592 px ; après pause, position stable à 594,5 px sur plusieurs contrôles. Les cibles et les noms complets des équipes restent disponibles.

Validation finale : 454 tests passent (8 cœur + 446 Vitest, 69 fichiers), TypeScript, garde native et formatage validés. Export Web/Android/iOS réussi dans `dist-native`. Un onglet de QA a interrompu son rendu pendant l’export ; l’aperçu principal est resté disponible. Aucun APK ni archive iOS signé, ni essai sur téléphone physique réalisé.

## Fil plein écran et panneau du compte

Chaque publication du fil connecté reçoit la hauteur réelle du conteneur de liste. Le bandeau épuré et les stories forment une introduction mesurée qui défile hors écran. Android/iOS utilisent des offsets explicites avec décélération rapide ; le Web applique le snap aux vraies cellules, sans accrocher les espaces de virtualisation. La réserve de navigation est interne à chaque publication. Le footer de chargement/erreur possède un arrêt uniquement lorsqu’il existe.

Une ancre par identifiant conserve le post pendant les rotations et les réordres après actualisation ; un refetch au même index n’interrompt pas le défilement. L’ajout d’une page depuis le footer affiche sa première nouvelle publication. Le changement de compte/fil repart de l’introduction. Le seuil vidéo du pager est de 70 %, avec un seul lecteur visible ; menus et feuilles de lecture suspendent le média. Le composant vidéo conserve ses protections de focus/arrière-plan et sa mémoire de position. Le rendu standard de PostCard reste utilisé ailleurs.

Photos et vidéos restent sans recadrage ; erreurs photo avec relance, réactions, commentaires, favoris et partage sont disponibles. Une feuille bornée garde le texte complet, les hashtags et les métadonnées. Le paysage ou une grande police déclenchent une disposition compacte, sans désactiver l’agrandissement du texte.

Contrôles Web : cellules de 844 px à 390 × 844 ; arrêts vérifiés sur photos et textes, puis jusqu’à la vingtième publication. Même identifiant conservé du portrait (offset 1934, hauteur 844) au paysage 740 × 320 (offset 886, hauteur 320), aligné à y=0. Lecture complète et fermeture conservent la position. Les gestes et la lecture vidéo sur iPhone/Android physiques restent à confirmer ; aucune nouvelle vidéo de démonstration n’a été publiée pour les essais.

Le burger ouvre un Modal natif latéral depuis Accueil et Mon profil. Contrôle à 390 et 320 px : identité réelle, compteurs réels, grille adaptée et bas défilable ; cibles de raccourcis de 256 × 49 px et fermeture 44 × 44 px à 320. Mon CV ouvre sa route et ferme le panneau ; ouverture depuis le profil confirmée. Série lue dans `user_streaks.current_streak`, vues dans `profile_views`, non-lues dans `notifications`, toujours filtrées par l’utilisateur. Le badge de série n’est pas présenté comme un solde FootLover. Aucun avantage ou gain d’invitation non raccordé n’est promis.

Le partage du profil utilise `/qr/{id}` et la feuille système ; sur Web, un succès sans objet retourné est reconnu, une annulation reste silencieuse et un échec permet la copie locale du message/lien. Les callbacks après fermeture et doubles clics sont protégés. Aucun partage, message, déconnexion, réaction ni autre écriture distante déclenché pendant la recette.

Suite complète : 382 tests passent (8 cœur + 374 Vitest, 66 fichiers), avec 8 nouveaux tests de géométrie de pagination. TypeScript, garde native et formatage validés. Revues ciblées complémentaires des ancres et du partage, sans compte ni donnée de test créés sur le service.

Exports finaux Android/iOS/Web réussis dans `dist-native` après intégration du panneau et du pager. Aucun nouveau module natif ajouté ; aucune compilation/signature d’application ni publication distante. La recette sur appareils physiques reste distincte de ces exports.

## Raccourcis en haut de l’accueil

« Opportunité » ouvre `/opportunities` à gauche ; l’avion des messages, le cœur des notifications et le burger sont réunis à droite sur la même ligne. Le texte visible « Messagerie » est retiré, mais son libellé accessible est conservé. Les trois icônes font 24 points, chacune dans une cible de 44 × 44 ; le point rouge des notifications et le compteur accessible restent réels. Le fil est centré seul sur la ligne suivante. Le menu du fil suit la hauteur mesurée du bandeau, se décale vers le haut sur écran court et défile si ses options dépassent l’espace disponible.

Dernière retouche contrôlée sur Web à 390 × 844 et 320 × 740 : les quatre boutons partagent y=6 et une hauteur de 44 px ; aucun débordement horizontal. Opportunité mesure environ 108 px de large, chaque icône 44 px. Messages, notifications et Mon espace s’ouvrent depuis leurs boutons. Le menu du fil s’ancre à y=98, sous le bandeau réduit, et se ferme normalement. TypeScript et garde native validés. Aucun message, publication ni état de lecture de notification modifié pour ces contrôles. Grandes polices système et lecteurs d’écran restent à confirmer sur appareils.

Le contrôle précédent en paysage à 740 × 320 a validé le menu borné et la sélection du fil ; les exports Android/iOS/Web avaient réussi à cette étape. Cette dernière retouche de présentation est vérifiée avec Metro Web et les contrôles statiques, sans refaire les exports. Aucun nouveau module natif ; aucun binaire compilé, signé ou déployé.

## Menu avec publication centrale — 22 h 03

La barre conserve le ballon d’accueil, Shorts, Recherche et le profil personnel ; la troisième place devient un bouton « + » de 48 points aux couleurs FootNation, qui ouvre `/compose`. Il s’agit d’une action annoncée comme bouton, sans créer d’onglet de publication vide. La route Messages est conservée, masquée de cette barre et accessible dans Mon espace.

Mon profil utilise toujours l’identifiant de session même si un paramètre `id` tiers est présent dans l’URL. La photo est prise uniquement sur le profil du compte courant, affichée dans un cercle avec repère de sélection et masquée comme décoration aux lecteurs d’écran ; le bouton garde son nom Mon profil. Une photo absente ou en erreur conserve l’icône de profil. L’état d’erreur de l’image est réinitialisé au changement de compte ou d’URL.

Vérification Web à 390 × 844 et 320 × 740 : ordre des cinq commandes, ouverture de l’éditeur et retour sans publier, accès à son propre profil, Recherche et Shorts. À 320 px, chaque cible mesure environ 52 × 49 px. Le compte de contrôle n’a pas de photo, ce qui confirme le repli visible ; aucune photo réelle n’a été ajoutée ou modifiée pour tester l’autre branche. TypeScript, garde native et formatage validés.

Depuis Shorts : un lecteur prêt, en lecture et muet ; le bouton central ouvre l’éditeur avec zéro lecteur restant ; Retour retrouve Shorts avec un seul lecteur en lecture et muet. Aucun contenu n’a été publié pendant ce contrôle.

Exports Android/iOS/Web réussis après les modifications de navigation. Aucune dépendance native ajoutée, aucun binaire compilé ou signé. Photo réelle, VoiceOver/TalkBack et interaction sur appareils restent à confirmer.

## Ballon sphérique dans la navigation — 21 h 23

La dernière consigne restreint les motifs à sept drapeaux : France, Bosnie, Algérie, Europe, Angleterre, Brésil et Argentine. La France reste sur le panneau central initial et reçoit le plus de panneaux. L’Angleterre utilise la croix de Saint-Georges et la Bosnie son fond bleu, son triangle jaune et sa diagonale d’étoiles blanches.

La maison est remplacée par un ballon vectoriel de 34 points : 12 pentagones et 20 hexagones, drapeaux inspirés du logo FootNation, projection orthographique autour de l’axe vertical. Les motifs traversent la face visible et sont masqués à l’arrière. Les arcs de découpe suivent l’horizon ; l’ombre portée, le reflet et la silhouette restent fixes. Une révolution dure 14 secondes. Reanimated calcule les positions sur le thread UI natif, en 30 étapes géométriques par seconde, avec onze tracés de couleur et un tracé de coutures. La préférence de réduction des animations est attendue avant de démarrer ; l’arrière-plan et le démontage interrompent l’animation.

Dix tests de géométrie vérifient la topologie, l’ensemble exact des sept drapeaux et la priorité française, les motifs Angleterre/Bosnie, le confinement des emblèmes à leurs panneaux, la rotation sur l’axe vertical, le masquage arrière, la continuité d’un tour et les coordonnées sur 60 angles. Suite complète : 374 tests réussis (8 cœur + 366 Vitest, 65 fichiers), TypeScript, formatage et garde native validés. Contrôle Web à taille réelle : chemins SVG qui évoluent, éclairage fixe et aucun aplatissement ou rotation du conteneur. L’onglet reste nommé Accueil, sélectionnable et d’au moins 49 points de haut. La mesure des performances en build release, la reprise AppState et les préférences système restent à confirmer sur appareils.

L’export final Android/iOS/Web réussit après le contrôle visuel et la suppression d’une propriété SVG non compatible Web. Les bundles Hermes et Web sont générés dans `dist-native`. Le prebuild local et la résolution d’autolinking confirment Expo Clipboard 57.0.1 sur les deux plateformes. Aucun APK ni archive iOS compilé ou signé ; aucun envoi d’invitation ni déploiement réalisé.

## Invitation après connexion et inscription — 21 h 16

Invitation native présentée une fois par connexion explicite réussie, après vérification et complétion du profil. La demande attend la fin des formulaires d’authentification et des appels. Un renouvellement de jeton, un retour au premier plan ou une restauration de session ne déclenche pas de nouvelle invitation. Le double retour OAuth est dédoublonné même après fermeture ; la récupération du mot de passe annule une invitation encore différée. Le retour vers un profil public partagé est conservé.

Le lien UUID reprend le contrat de parrainage du site, sans écriture de code ni nouvelle migration. Copier utilise Expo Clipboard ; WhatsApp et Facebook ouvrent leur interface de partage, SMS utilise le compositeur natif et les autres options passent par la feuille système. Le Web copie le message si sa feuille de partage est indisponible ; une annulation n’est pas annoncée comme un envoi. Aucun crédit ou badge non raccordé n’est promis.

Contrôles Web : écran à 390 × 844 et 320 × 568, deux colonnes sur petit écran, aucun débordement horizontal, bouton Fermer de 44 × 44 px, autres actions de 48 px minimum, lien sélectionnable, retour « Lien copié », fermeture et « Continuer sans inviter » vers l’accueil. Aucun compte créé, connexion réelle soumise ni invitation envoyée pour ces contrôles. Les tests de file d’attente et de partage s’ajoutent aux contrôles existants : 364 tests passent (8 cœur + 356 Vitest, 64 fichiers), ainsi que TypeScript et le contrôle JSX natif. Le prebuild local iOS/Android avec Expo Clipboard 57.0.1 réussit sans installation ni compilation.

À valider sur appareils : connexion mot de passe/Google, confirmation e-mail, profil incomplet puis sauvegarde, VoiceOver/TalkBack dans la modale, grande police, retour Android, partage et annulation avec/sans chaque application sociale installée. Les tests unitaires et l’aperçu Web ne remplacent pas ces essais.

## Mise à jour après la capture Instagram de 20 h 37

La référence la plus récente remplace la palette sombre décrite dans le premier contrôle ci-dessous. Shell blanc, textes noirs, accents FootNation bleu-violet-rouge, stories de 90 points, auteur sur le média et barre flottante à cinq onglets. Les destinations Réseau, Clubs et Opportunités restent accessibles depuis Explorer et le menu du profil ; les URL sont conservées.

Contrôle Web à 390 × 844 et 320 × 740 : fil, sélecteur Pour vous / Mon réseau, Explorer, Messages, profil, Mon espace, Opportunités et Shorts. Aucun débordement horizontal constaté sur Explorer à 320 px ; les onglets mesurent environ 52 × 49 px. Leur nom et leur sélection sont exposés dans l’arbre d’accessibilité. La saisie séquentielle de « football » dans la recherche des messages conserve le focus. Les menus et la navigation fonctionnent sans modifier de contenu membre.

Le layout et la barre partagent la visibilité du clavier ; la réserve inférieure disparaît quand le clavier masque la barre. Le bas sécurisé déjà consommé par `Screen` est déduit de cette réserve. Le flou s’appuie sur une cible par écran ; Android antérieur à 12 utilise une surface translucide, et l’option iOS de réduction de transparence impose un fond opaque. Ces comportements natifs restent à vérifier sur appareils.

L'essai des Shorts a révélé une course du lecteur Web entre le remplacement de source et la lecture automatique. Le Web reçoit maintenant sa source initiale directement ; iOS et Android gardent le remplacement asynchrone. La restauration et la lecture attendent l'état React `readyToPlay`. Après correction : un seul lecteur, `readyState = 4`, `paused = false`, son coupé et temps de lecture qui progresse ; zéro lecteur en revenant à l'accueil. Les 11 tests ciblés de pagination/médias/position passent.

Les 318 tests passent (8 cœur + 310 Vitest), ainsi que TypeScript, le contrôle JSX natif, le formatage et l’export Android/iOS/Web. Un prebuild isolé sans installation confirme les fonds blancs et le style clair iOS/Android, ainsi que l’autolinking d’Expo Blur 57.0.2. Aucun APK, archive iOS ou déploiement n’a été produit.

## Premier contrôle, avant la capture de 20 h 37

- Identité commune : bleu nuit, surfaces sombres, dégradé bleu–violet–rouge, titres lisibles, boutons arrondis. Le fil et les stories reprennent les codes Instagram ; le réseau et les opportunités gardent leur contenu professionnel.
- Clavier : défilement iOS ajusté au clavier dans `Screen` et les listes avec recherche ; suppression de la double compensation de connexion. Passage email → mot de passe et soumission clavier contrôlée. Les sélecteurs ferment le clavier avant ouverture.
- Accessibilité : libellé des boutons conservé pendant le chargement, états occupé/désactivé/coché/sélectionné, titres annoncés comme titres, choix annoncés avec le nom du champ et sa valeur, erreurs annoncées. Boutons partagés et actions du fil d'au moins 44 points ; formulaire et recherche peuvent s'étirer en hauteur.
- Petits écrans : champs qui rétrécissent correctement, titres complets, filtres défilants, largeur de contenu limitée sur grand écran, libellés de navigation ajustés en dessous de 360 points.
- Médias : un lecteur visible maximum dans le fil et les profils ; seul Short visible chargé. Lecteur libéré hors écran, à la sortie de la page et en arrière-plan. Position conservée tant que le composant parent reste en mémoire. Chargement asynchrone, progression visuelle, erreur et réessai ; avertissement après 15 secondes d'attente.
- Fil : virtualisation, déduplication des pages, protection contre les chargements concurrents et les reprises automatiques répétées après échec. Bouton de chargement supplémentaire et reprise manuelle.
- Hors ligne : bannière de connexion et état sans chargement infini, cache en mémoire conservé, lectures reprises après reconnexion. Une mutation refusée hors ligne nécessite une nouvelle action ; elle n'est pas envoyée automatiquement plus tard. Les opérations déjà parties ne peuvent pas être annulées par ce garde-fou.
- Session : profil déjà vérifié réutilisé uniquement pour le même compte pendant la coupure. Un profil non chargé est distingué d'un profil confirmé absent. Reconnexion, changement de compte et suspension traités sans réutiliser une réponse ancienne.

## Vérifications réalisées

Les tests automatisés couvrent la déconnexion/reconnexion, les réponses réseau périmées, le refus des mutations et l'absence de rejeu, l'isolation des comptes, la pagination, la sélection vidéo, les positions de lecture et le filtrage des rapports d'erreurs. Les tests utilisent des données synthétiques.

Dans l'aperçu Web : opportunités et création de publication vérifiées à 320 × 740 ; réseau à 390 × 844. Les contrôles mesurés du formulaire font 44–50 pixels minimum, les onglets 57 pixels de haut. Champs et actions identifiés dans l'arbre d'accessibilité. La fenêtre de choix place le focus sur Fermer, puis sur Tous / Aucun avec Tab, à l'intérieur d'un dialogue `aria-modal`. Un défilement du fil a montré zéro élément vidéo hors écran, un seul lecteur visible (`readyState = 4`, en pause), puis zéro lecteur après retour en haut. Aucun contenu membre n'a été publié, modifié ou envoyé pour ces vérifications.

Suite finale : **318 tests réussis** (8 cœur, 310 Vitest dans 62 fichiers), TypeScript, formatage et contrôle JSX natif validés. Exports Android/iOS/Web réussis. Deux prebuilds isolés confirment le thème sombre, `adjustResize` Android, l'autolinking d'Expo Network et l'activation conditionnelle des scripts Sentry. Ces générations n'ont ni compilé ni signé une application et n'ont rien envoyé à Sentry.

## Recette restante sur appareils

Ces contrôles ne sont pas remplacés par les exports JavaScript ou le navigateur. Aucun simulateur iOS utilisable ni outil Android `adb` n'est disponible sur cette machine lors du contrôle.

| Parcours                                          | Essai iPhone et Android                                                                 | Résultat attendu                                                                                     |
| ------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Connexion, inscription, publication, conversation | Clavier ouvert, bouton Suivant, retour, rotation                                        | Champ actif et action accessibles ; aucun formulaire soumis deux fois                                |
| Navigation et formulaires                         | Grande police et texte en gras système, écran 320–360 points                            | Texte lisible, contenu défilable, commandes sans chevauchement                                       |
| VoiceOver / TalkBack                              | Parcourir les titres, champs, choix, erreurs et feuille de réactions                    | Ordre cohérent, nom + état annoncés ; focus limité à la fenêtre modale                               |
| Fil et profils                                    | Défilement prolongé avec photos et vidéos, appareil modeste                             | Pas d'accumulation de lecteurs, pas de son hors écran ; mesurer les ralentissements en build release |
| Vidéos / Shorts / Replay                          | Réseau lent, média indisponible, mise en arrière-plan, changement de page, seek         | Attente et réessai visibles ; pause hors page ; seek Replay respecté                                 |
| Hors ligne                                        | Mode avion avant ouverture puis pendant un fil chargé, Wi-Fi sans Internet, reconnexion | État explicite ; cache du compte conservé ; aucune action refusée envoyée automatiquement            |
| Changement de compte                              | Coupure, déconnexion/reconnexion, ancien chargement encore en vol                       | Aucune donnée du compte précédent affichée                                                           |
| Suivi des erreurs                                 | Build preview configurée Sentry et erreur synthétique contrôlée                         | Événement reçu, source retrouvée avec Debug ID, absence de contenu personnel                         |

Le cache n'est pas persistant entre redémarrages. L'état du réseau fourni par iOS/Web ne prouve pas que le serveur est accessible ; les erreurs de requêtes et de médias restent nécessaires. Les crashs du processus natif ne sont pas couverts par le suivi JavaScript actuel.
