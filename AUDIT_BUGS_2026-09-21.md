# Vérification de l’application Expo — 21 septembre 2026

Périmètre : application locale `mobile-expo`, ses 154 fichiers de routes, les liens connus dans le code, les interactions sociales, le matching, les clubs et les formulaires. Corrections locales uniquement ; aucune publication, création de compte, demande de contact, migration ou mise en production.

## Corrections réalisées

| Zone | Problème identifié | Correction |
| --- | --- | --- |
| Notifications | Les liens `/shorts?id=…` ouvraient le fil général. | Ouverture du Short concerné. |
| Messagerie | Les liens web avec `?user=…` ou `?to=…` perdaient le destinataire. | Destination normalisée vers la conversation. |
| Connexion | Plusieurs espaces personnels perdaient la destination après connexion. | Retour conservé pour les destinations autorisées. |
| Inscription | La création et la confirmation du compte perdaient la destination initiale. | Destination transmise dans le lien de confirmation et conservée après inscription. |
| Contact | Le nom était envoyé vide alors que le serveur le rend obligatoire. | Prénom et nom distincts, champs validés avant envoi. |
| Matching | Les erreurs de swipe étaient cachées derrière la carte plein écran. | Messages visibles dans la carte. |
| Matching | La dernière carte ne pouvait plus être revue une fois les suggestions épuisées. | Action Revoir conservée tant qu’il existe un historique. |
| Matching | Les filtres choisis pouvaient être écrasés par la catégorie rapide. | Application cohérente des filtres. |
| Navigation | Retour sans effet après ouverture directe du matching ou des opportunités. | Retour vers l’accueil lorsqu’il n’existe pas d’historique. |
| Communauté du club | Un profil manquant interrompait prématurément la pagination. | Pagination fondée sur les lignes reçues, avec résolution du nom de profil. |
| Shorts | Le bouton de commentaires revenait sur le même écran sans afficher la discussion. | Liste paginée, profils accessibles, saisie de commentaire et pause du lecteur pendant la consultation. |
| Publications et Shorts | Certains boutons Suivre ouvraient seulement le profil. | Véritable suivi, état Suivi, gestion des erreurs et actualisation du fil Amis. Les liens de profils restent distincts. |
| Connexion depuis une vidéo | Le bouton Suivre d’un visiteur pouvait ouvrir la connexion derrière la fenêtre vidéo. | Fermeture de la fenêtre avant la navigation vers la connexion. |
| Traduction | L’erreur ne pouvait pas être refermée ; certaines langues sans espaces étaient ignorées. | Fermeture et réessai séparés, détection améliorée, délai maximal et rejet des réponses erronées. Cela ne certifie pas la disponibilité du fournisseur distant. |
| Première connexion | L’invitation pouvait être proposée avant la fin de l’accueil. | Vérification explicite de la fin de l’accueil. |
| Date de naissance | Une modification partielle effaçait les trois champs. | Brouillon local conservé pendant la saisie, changements externes toujours synchronisés. |
| Dates | Borne d’âge incorrecte le 29 février et raccourcis Hier/Demain fragiles aux changements d’heure. | Calculs calendaires et tests sur les années bissextiles et l’heure de Paris. |
| Calendrier web | Le sélecteur recherchait un champ par libellé dans toute la page. | Référence au champ concerné et repli si l’ouverture du sélecteur n’est pas disponible. |
| Matchs | Les cartes utilisaient le jour UTC pour ouvrir un résultat chargé selon le jour local. | Réutilisation du jour fourni par la source des matchs. |
| Matchs | Bouton imbriqué dans un autre bouton, provoquant un avertissement HTML. | Une seule action interactive par carte. |
| Affichage natif | Certaines conditions pouvaient rendre une chaîne vide ou un nombre hors d’un composant Text. | Conditions explicitement booléennes ; contrôle natif amélioré pour distinguer les vrais problèmes des faux positifs. |

## Liens publics

Les pages FootNation Contact, Mentions légales, Conditions générales de vente, Politique de confidentialité, Sécurité des mineurs et Suppression de compte répondent en HTTP 200. L’ancien chemin de sécurité des mineurs redirige vers le chemin actuel. Un statut HTTP valide ne remplace pas un parcours complet dans le navigateur.

Les liens vers les réseaux sociaux et Google Play n’ont pas pu être certifiés avec les accès disponibles. Ils ne sont pas déclarés morts sur cette seule base.

## Limites de vérification

- Aucun navigateur contrôlable n’était disponible pendant cet audit : les changements de cette session n’ont pas été validés visuellement.
- Les actions d’écriture ont été testées avec des données simulées, sans messages, commentaires ou suivis réels.
- Le fournisseur de traduction distant reste à vérifier. Aucun appel susceptible d’écrire dans son cache n’a été lancé.
- Les appareils physiques, la caméra, le microphone, les notifications natives et les parcours OAuth réels ne sont pas certifiés par les tests locaux.
- Cet audit n’est pas une garantie d’absence de tout bug ni une validation d’une mise en production.

## Résultats des contrôles

- `npm test` : **1 003 tests réussis**, aucun échec — 12 tests du socle, 985 tests Vitest répartis dans 123 fichiers, puis 6 tests du contrôle de livraison.
- Contrôle de structure native : réussi ; prise en compte des variantes `.native` lors de la résolution des imports.
- `npm run typecheck` : réussi après la dernière correction de navigation depuis la vidéo.
- `npx expo export --platform all` : réussi pour **Web, Android et iOS** ; fichiers produits dans `/tmp/footnation-audit-export`. Cet export valide les bundles JavaScript/Hermes, pas une compilation native Xcode/Gradle ni une installation sur téléphone.
- Vérification des routes : incluse dans la suite réussie. Elle contrôle les destinations détectables dans le code ; elle ne certifie pas toutes les données ou pages distantes.
- `git diff --check -- mobile-expo` : réussi sur les fichiers suivis par Git.
