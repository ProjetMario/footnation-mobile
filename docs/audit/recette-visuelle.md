# Recette visuelle — 23 septembre 2026

## Périmètre effectivement exécuté

Chrome, application Expo Web locale copiée par `npm run audit:ui`, serveur fictif en mémoire. Aucun service distant n’a reçu de commentaire ou de suivi. Les largeurs de navigateur ci-dessous ne sont **pas** des essais sur téléphone physique.

| Vérification | Observation |
| --- | --- |
| Accueil visiteur, 390 px | Deux défauts trouvés : badge gratuit écrasé et libellé `{copy.communityKicker}` affiché littéralement |
| Corrections accueil | Libellé remplacé par « Communauté football » ; badge protégé du rétrécissement et conteneur autorisant le retour à la ligne. Après rechargement, capture à 360 px : « GRATUIT » reste entier. Le libellé de communauté n’a pas pu être relu dans le DOM après correction, du fait des délais du contrôleur |
| Connexion, 390 px | Formulaire visible ; saisie d’un compte fictif ; bouton Voir devient Masquer ; connexion confirmée par l’arrivée sur le fil |
| Accueil connecté | Publications fictives et navigation visibles. Services actus/matchs non simulés : erreurs explicites, sans faux succès |
| Liste des clubs | Deux clubs affichés, ouverture d’une fiche et retour vers la liste confirmés |
| Fiche rouge, 390 px | Couverture, logo de repli, boutons, compteurs, onglets et prochain match visibles |
| Commentaires du match, 360 px | Ouverture du formulaire ; saisie progressive ; publication fictive ; commentaire affiché sous « Recette player » avec bouton de profil ; champ vidé et bouton désactivé après succès |
| Suivi club | Bouton Suivi et compteur FootLovers à 1 ; retrait puis compteur à 0, vérifiés dans le DOM |
| Fenêtre FootLovers | Ouverture et fermeture confirmées. Liste vide malgré un suivi : limitation de la simulation des jointures ; contenu des profils non certifié |
| Onglets du club | Les huit états de sélection sont atteints. Matchs affiche une rencontre ; QR affiche un code. Les autres sections ont été observées au chargement, pas certifiées de bout en bout |
| QR, 768 et 1280 px | Carte et QR lisibles, mise en page centrée sur ordinateur ; partage et lecture du QR par appareil non exécutés |
| Club bleu au nom long, 360 px | Nom complet réparti sur trois lignes ; couleurs bleues, logo de repli et compteurs visibles sans débordement observé |
| Identité, adresse, installations | Trois installations et liens Maps présents dans le DOM ; navigation externe Maps non exécutée |
| Déconnexion | Menu du compte ouvert, déconnexion du compte fictif, retour à l’accueil visiteur confirmé par capture |

## Corrections supplémentaires et contrôles

- `src/screens/Home.tsx` : texte français et comportement du badge.
- `scripts/ux-fixture-server.mjs` : prise en charge explicite de `club_followers` avec propriétaire `profile_id`. L’erreur de suivi initiale provenait du serveur de recette et non du service de production.
- `tests/uiFixture.test.ts` : scénario du suivi utilisant désormais la table réelle de cette fonctionnalité (`club_followers`). **8 tests réussis**, contrôle TypeScript réussi après ces changements.

## Points ouverts

Le contrôleur Chrome a subi plusieurs délais sur les clics, touches et lectures de page, parfois avec réinitialisation de sa session. Les actions dont le résultat a ensuite été observé sont distinguées ci-dessus des actions non certifiées. La taille temporaire du navigateur a été réinitialisée à la fin.

Ne sont pas validés par cette passe : mode sombre, tous les parcours d’inscription, recherche filtrée, vidéo/audio et shorts, votes, paiement, messages/appels, partage natif, permissions matérielles, toutes les variantes de rôle/erreur et l’ensemble des 155 routes.

**Téléphone physique : non exécuté.** Aucun appareil pilotable n’est exposé ; `adb` est absent et `xcrun simctl` indisponible. Une question sur le téléphone disponible a été adressée à l’utilisateur. Les captures responsive de Chrome ne remplacent pas ce contrôle. Le serveur de recette est lié à la boucle locale : ne pas proposer `localhost:8081` comme une adresse accessible depuis le téléphone.

## Poursuite de la recette

- Inscription à 390 px : adresse invalide et mot de passe trop court signalés ; critères de mot de passe mis à jour et bouton Continuer désactivé. Aucun compte ni acceptation des conditions créés.
- Lien des conditions : l’ancien lien était imbriqué dans la case à cocher et n’ouvrait pas la page au clavier. Il est désormais un élément indépendant. L’arbre d’accessibilité de la nouvelle version confirme la séparation. La navigation après Entrée n’a pas pu être certifiée : le contrôleur a expiré puis Chrome s’est déconnecté.
- Polices de recette : la copie temporaire réutilisait des chemins de polices d’une ancienne copie supprimée. Le lanceur utilise désormais une version de cache propre à chaque copie. Compilation de la nouvelle copie réussie ; rendu des polices après correction non certifié avant la déconnexion.
- Une largeur de 360 px a été demandée sur la nouvelle session, sans capture exploitable. Le navigateur a ensuite disparu de l’inventaire ; la réinitialisation de cette dernière taille n’a pas pu être confirmée.

### Corrections issues de la revue complémentaire

- Lecture vidéo Web : promesse de lecture traitée, annulations normales différenciées des vraies erreurs et demandes simultanées regroupées.
- Pause/reprise : plus de cycle de pause causé par un simple changement d’état actif ; position conservée pour le même fichier, effacée au remplacement du fichier.
- Nettoyage natif : une pause de nettoyage sur un lecteur déjà libéré ne provoque plus d’exception.
- Reels : musique montée même sans barre d’édition, commande son de 44 px, repli sur le son original si la musique échoue. Le calque de pause laisse accéder au bouton Réessayer en cas d’erreur ou de chargement lent.
- Recherche de club : sites sans préfixe HTTPS normalisés ; erreurs d’ouverture des coordonnées et du site présentées à l’utilisateur.

### Simulation étendue

Le serveur de recette contient maintenant les profils joints des FootLovers/Membres/Fans, les statistiques de pronostics recalculées, deux joueurs et un match terminé pour les MVP. Un clip de présentation FootNation déjà présent dans le dépôt est servi localement avec requêtes partielles HTTP pour les essais vidéo. **14 tests de fixture passent** ; cela valide la simulation, pas les politiques de la base distante ni les interactions visuelles encore bloquées.

La suite ciblée vidéo compte **36 tests réussis** et la revue ciblée navigation/accès/liens **117 tests réussis**. Ces nombres se recoupent avec la suite générale : ne pas les additionner à son total.

La revalidation finale compte **1 066 tests réussis**, TypeScript et contrôle natif réussis, et des exports Web/Android/iOS terminés avec code 0. La recette locale a été relancée avec tous les correctifs et toutes les fixtures. Le navigateur n’étant plus exposé, cette relance n’ajoute aucune validation visuelle au tableau ci-dessus.

## Poursuite du 24 septembre

Chrome est redevenu accessible après des délais de navigation et de saisie. Les premières commandes retournées n’étaient pas toutes appliquées : seuls les résultats ensuite observés sont retenus. Même environnement fictif local, aucune écriture distante.

| Vérification | Résultat observé |
| --- | --- |
| Connexion, 390 × 844 px | Formulaire lisible sur capture ; compte fictif connecté, arrivée sur le fil confirmée. La saisie progressive a expiré ; remplissage ensuite confirmé et connexion réussie |
| Short local de 10 s, 390 × 844 px | Vidéo chargée (`readyState=4`), durée 10 s, lecture active. Capture en pause : vidéo et actions visibles, commande de reprise centrale seulement en pause |
| Pause/reprise du short | Pause observée à 9,080856 s ; reprise à 9,260321 s, sans remise à zéro |
| Son du short | Bouton Activer le son : propriété vidéo `muted=false` confirmée. Cela ne certifie pas la sortie sonore matérielle |
| Fin et boucle | Après reprise près de la fin, lecture active observée à 0,559719 s, durée toujours 10 s : retour au début de la boucle |
| Ami(e)s avant suivi | État « Aucun short de vos amis pour le moment » affiché, retour vers tous les Reels fonctionnel |
| Ami(e)s après suivi fictif | Bouton « Suivi », puis short de Recette coach présent dans Ami(e)s ; état vide absent |
| Club rouge, version corrigée, 360 × 800 px | Couverture graphique, nom, suivi, quatre compteurs et onglets lisibles ; en-tête compact visible après défilement |
| Pronostics, 360 px | Panneau inférieur lisible, noms Recette coach/admin associés à leurs choix ; clic sur Recette coach ouvre son profil et ferme le panneau, retour au club réussi |
| Vote fictif | Match nul choisi par Recette player : compteur de 2 à 3, répartition à 33/33/33 et Recette player sous Match nul dans les détails |
| Compteurs de communauté | FootLovers : coach/admin ; Membres : player/coach ; Fans : coach. Les trois panneaux se chargent et se ferment |
| Matchs en mode sombre, 360 px | Filtres Calendrier/Résultats et À venir/Passés lisibles ; Passés affiche le match terminé 2–1 et sa liste de joueurs MVP. Vote MVP non soumis |
| Actu, Palmarès, Vidéos | États vides chargés et explicites, sans chargement permanent observé |
| Équipes et recherche | Deux joueurs affichés ; saisie progressive `pla` puis `yer` (interruption du contrôleur entre les deux) : seul Recette player reste affiché, champ `player` conservé |
| Top | Deux joueurs, buts et passes affichés. Accords au singulier corrigés après observation |
| QR sombre, 768 et 1280 px | Capture lisible, page centrée avec largeur de 960 px sur grand écran ; partage natif et scan matériel non exécutés |
| Communauté sombre, 1280 px | Fenêtre FootLovers centrée, noms et fermeture visibles |
| Club bleu au nom long, sombre, 360 px | Nom complet sur trois lignes, compteurs et onglets visibles ; aucun débordement observé |

Corrections complémentaires de cette passe : contrastes des clubs en mode sombre, retour à la ligne des noms de commentaires, cibles tactiles des profils, traduction des textes dépassant la limite explicite du fournisseur de secours. Les accords « 1 rencontre », « 1 joueur trouvé » et « 1 passe décisive » ont été corrigés après observation ; leur code est formaté et typé, sans nouvelle certification visuelle de chaque libellé.

Le thème initial **Automatique** a été rétabli (état coché observé) et la taille temporaire du navigateur réinitialisée. Les appels de traduction distante, les contenus de production, les permissions et les interactions sur téléphone physique restent non validés. Les tests de logique ne certifient pas ces intégrations.
