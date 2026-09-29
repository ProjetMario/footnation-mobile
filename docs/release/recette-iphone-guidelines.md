# Recette iPhone — confidentialité, accessibilité et sécurité

Préparée le 24 septembre 2026 à la demande du propriétaire de FootNation. **À exécuter : aucun test sur iPhone n’a été effectué.** Cette recette ne lance aucune soumission App Store.

## Matériel et préparation

- Un iPhone avec une version iOS prise en charge, une installation native signée de FootNation et sa version/build notée. Expo Go et le navigateur ne suffisent pas pour Apple, les autorisations ou VoiceOver natif.
- Refaire les cas de présentation sur le plus petit iPhone pris en charge. Si l’app reste compatible iPad, prévoir aussi un iPad en portrait, paysage et Split View.
- Une connexion Wi-Fi et une connexion mobile ; accès au mode avion. Un second appareil pour les appels, si cette fonction est activée.
- Des comptes de recette dédiés : A membre adulte, B autre membre, C administrateur de modération, D propriétaire d’un groupe/page avec une contribution de B. Comptes Apple et Google de test distincts. Ne pas utiliser le compte principal du club.
- Le backend doit correspondre au build. Le projet lié FOOTNATION a Google activé et Apple désactivé. Le lot de conservation des espaces partagés, de modération et de filtrage de textes a été installé après approbation le 24 septembre ; l’admission sociale et la révocation Apple restent à installer. Les nouveaux écrans ne sont pas encore distribués. La liste détaillée est dans [l’audit](app-store-review-2026-09-24.md).
- Les créations/suppressions et signalements doivent viser des données synthétiques dans un environnement de recette isolé. Aucun commentaire, signalement ou appel à un vrai membre pour tester. Ne jamais importer de contenu illégal ; un texte neutre suffit pour exercer une décision de modération.

Pour chaque cas, relever : identifiant, résultat `PASS` / `FAIL` / `BLOCKED` / `NOT_EXECUTED`, appareil, iOS, version/build, compte de recette (alias), réseau, thème, réglage de texte, date, preuve et anomalie. Utiliser [la grille iPhone](recette-iphone-resultats.csv). Une capture doit masquer emails, identifiants de connexion, messages privés et notifications personnelles.

## 1. Premier lancement et permissions

| ID | Manipulations | Résultat attendu |
| --- | --- | --- |
| IP-01 | Installer le build, lancer puis parcourir accueil, club et aide sans se connecter. | Aucun crash. Aucune demande caméra, micro, contacts ou localisation avant une action liée à ce besoin. Les refus futurs ne bloquent pas la consultation. |
| IP-02 | Publication → appareil photo → refuser la caméra. Réessayer puis ouvrir les réglages proposés. | Le refus est expliqué sans boucle de prompts. Aucun témoin caméra actif. « Ouvrir les réglages de FootNation » ouvre les réglages de l’app. Le brouillon est conservé. |
| IP-03 | Autoriser la caméra depuis Réglages, revenir puis prendre une photo ; annuler une seconde capture. | La capture réussit après une nouvelle action. L’annulation ne publie rien et ne remplace pas le brouillon. Aucun témoin caméra après fermeture. |
| IP-04 | Importer une photo avec accès Photos limité, puis avec accès complet refusé, sur Publication et la page pro. | Le sélecteur système permet de choisir uniquement les images autorisées. Une image est prévisualisée ; aucune exigence injustifiée d’accès à toute la photothèque. Annuler laisse le formulaire intact. |
| IP-05 | Importer une vidéo locale puis iCloud ; annuler la sélection et recommencer. | Chargement/erreur lisible, aucune attente infinie. Si iOS réclame un accès pour exporter la vidéo originale, le refus est récupérable et ne publie rien. Vérifier son et durée complète. |
| IP-06 | Message → vocal → refuser le micro, puis autoriser dans Réglages et enregistrer une seconde fois. | Aucune capture avant accord ; explication après refus. Le second essai fonctionne. Annuler supprime l’enregistrement local et n’envoie aucun message. |
| IP-07 | Pendant une capture/vocal/appel de recette, verrouiller l’écran, quitter l’écran puis passer l’app en arrière-plan. | Comportement explicite, absence de capture cachée. Les ressources sont libérées à la fermeture/fin. L’app ne prétend pas recevoir/répondre aux appels fermée si ce service n’est pas implémenté. |
| IP-08 | Compte et confidentialité → activer les notifications → refuser, puis revenir aux réglages et réessayer après autorisation. | Aucun faux état « activé ». L’opt-in est explicite et la désactivation arrête les nouveaux envois. Un changement de A vers B ne laisse pas arriver les notifications de A. Si push non configuré : `BLOCKED`, jamais `PASS`. |
| IP-09 | Ouvrir la carte du club et choisir un département. | L’app n’exige pas la position GPS ni le carnet d’adresses. Un lien Google Maps correspond à l’adresse affichée et peut être annulé. |

## 2. VoiceOver et lisibilité

Activer **Réglages → Accessibilité → VoiceOver**. Balayer à droite/gauche avec un doigt pour déplacer le focus, toucher deux fois pour activer. Parcourir chaque écran sans aide visuelle. Utiliser le bouton Fermer/Retour pour chaque fenêtre ; essayer également le geste d’échappement VoiceOver quand il est applicable.

| ID | Manipulations | Résultat attendu |
| --- | --- | --- |
| IP-10 | Lire Connexion/Inscription puis les boutons Google et Apple. | Le nom, le rôle et l’état de chaque commande sont annoncés une fois. Les logos décoratifs ne créent pas de focus inutile. Le bouton Apple système reste utilisable. |
| IP-11 | Saisir un email invalide, afficher/masquer le mot de passe puis corriger caractère par caractère. | Les champs sont nommés ; le focus/clavier restent stables. L’état afficher/masquer est compréhensible et le mot de passe masqué n’est pas annoncé à voix haute. L’erreur est découvrable/annoncée. |
| IP-12 | Finir un profil social, lire les conditions, choisir rôle/date, laisser un champ invalide et soumettre. | Les contrôles sont accessibles ; aucune case CGU cochée automatiquement. L’erreur indique le champ à corriger, les valeurs restent saisies, le bouton occupé ne provoque pas deux requêtes. |
| IP-13 | Fil → publication → réaction, commentaires, partager, menu → signaler ; puis Mes signalements. | Tous les boutons ont un libellé précis. Les icônes seules ne sont pas annoncées comme « bouton » sans nom. Le statut du signalement est lisible et le retour fonctionne. |
| IP-14 | Club → compteurs → votes → profil ; fermer les panneaux puis revenir. | Ordre de focus logique, fermeture accessible, aucun accès au contenu derrière une fenêtre modale, focus rétabli à un endroit pertinent. |
| IP-15 | Shorts → pause/reprise, amis/reels, options ; ouvrir et fermer les commentaires. | La pause reste possible sans geste visuel obligatoire. Les onglets et leur sélection sont annoncés. Les vidéos hors écran ne continuent pas à parler/jouer. |
| IP-16 | Suppression de compte : parcourir avertissements et confirmations jusqu’avant l’action finale. | Conséquences, éléments conservés et confirmation destructive sont explicites. Le bouton final est atteignable ; le champ de confirmation est nommé. Annuler ne supprime rien. |
| IP-17 | Réglages → Accessibilité → Affichage et taille du texte → Police plus grande, au maximum ; refaire connexion, club, paramètres et panneaux. | Pas de texte/action essentielle coupée ou superposée. Le contenu défile verticalement ; les zones tactiles restent suffisantes. Répéter en paysage et au clavier ouvert. |
| IP-18 | Tester thème clair/sombre, Augmenter le contraste, Réduire la transparence et Réduire les animations. | Texte et icônes lisibles, état jamais indiqué uniquement par couleur. Animations non essentielles réduites, absence de clignotement gênant. Mesurer le contraste des commandes si doute ; ne pas conclure sur une capture seule. |

## 3. Connexion Apple et Google

Exécuter seulement lorsque les prérequis de [social-auth.md](social-auth.md) sont satisfaits. Utiliser le même build signé et le même projet ; ne pas activer simplement un bouton caché pour forcer un test.

| ID | Manipulations | Résultat attendu |
| --- | --- | --- |
| IP-19 | Premier compte Apple, choisir Masquer mon email ; compléter le profil puis se déconnecter/reconnecter. | Feuille système, retour unique vers l’app, profil unique. Adresse relais acceptée. Le nom absent au second login n’efface pas celui déjà saisi. |
| IP-20 | Premier compte Google puis compte existant, via les boutons Connexion et Inscription. | Retour dans FootNation, profil existant conservé. Nouveau profil : âge, CGU et rôle requis. Aucun droit d’administration accordé par le fournisseur. |
| IP-21 | Annuler Apple, fermer le navigateur Google, passer hors ligne pendant le retour ; réessayer. | Retour propre ou erreur récupérable. Pas de faux succès, de boucle ni de compte inattendu. Un second callback n’effectue pas deux échanges. |
| IP-22 | Utiliser des dates synthétiques correspondant à moins de 13 ans, 13–15 ans, 16 ans et plus. | Restrictions côté serveur : pas d’accès communautaire sans admission. Accord parental requis à 13–15 ans. Aide, juridique, déconnexion et suppression restent disponibles. Ne pas envoyer d’invitation à un parent réel. |
| IP-23 | Ouvrir un lien de club/invitation avant la connexion, puis changer de compte pendant une requête lente. | Destination sûre conservée, aucune adhésion automatique ; pas de profil, message ou droit provenant du compte précédent. |

## 4. Modération et blocage

| ID | Manipulations | Résultat attendu |
| --- | --- | --- |
| IP-24 | A signale un contenu neutre de B créé pour la recette ; C ouvre Signalements, examine puis retire avec un motif. | Un seul signalement, bon auteur/contenu, priorité lisible. Décision datée attribuée à C ; contenu retiré des lectures ordinaires et de sa copie éventuelle dans les actualités du club. Les autres contributions restent intactes. |
| IP-25 | Deux administrateurs ouvrent le même signalement ; le premier décide, le second essaie avec l’ancienne version. | La deuxième décision est refusée avec actualisation, sans écraser la première. Un membre simple ne peut pas décider ni lire les signalements des autres. |
| IP-26 | A consulte Mes signalements après retrait puis après un classement sans suite sur un second cas. | États cohérents après actualisation. Aucun signalement privé de B n’apparaît. Le classement sans suite ne retire pas le contenu. |
| IP-27 | A bloque B ; vérifier recherche, fil, messages et tentative d’appel des deux côtés ; redémarrer l’app. | Le blocage persiste, messages/appels refusés conformément aux règles serveur. Débloquer demande une action explicite de A. |

## 5. Suppression et confidentialité

| ID | Manipulations | Résultat attendu |
| --- | --- | --- |
| IP-28 | D possède un groupe/page de recette avec une contribution de B. Supprimer D depuis Compte et confidentialité. | Réauthentification et confirmation explicite ; reçu de suppression confirmé ; D ne peut plus se connecter. Espaces et contributions de B conservés, pas de promotion automatique. Aucun passage obligatoire au support pour cette seule propriété partagée. |
| IP-29 | Répéter sur un compte Apple de recette, puis en coupant le réseau après confirmation. | Révocation Apple exécutée ou reprise explicite ; jamais de succès fictif. Au retour réseau, reçu récupéré, pas de double traitement. Contrôler côté serveur sans afficher de jetons. |
| IP-30 | Consulter confidentialité/contact/suppression déconnecté, connecté et avec accès mineur restreint. | Documents et aide accessibles ; texte identique sur Web et Expo, liens fonctionnels, aucune injonction à acheter. Les données déclarées correspondent aux services réellement actifs. |
| IP-31 | Vérifier le rapport de confidentialité du binaire et une erreur synthétique si Sentry est activé. | SDK/API requis justifiés, aucun jeton/message/capture privée dans le diagnostic. Les données d’usage liées au compte ne sont pas déclarées anonymes. Les durées annoncées ont des purges effectivement vérifiées. |

## Clôture

Un cas bloqué par Apple, les secrets serveur, une absence de build ou un service non déployé reste `BLOCKED`. Un test local ne le remplace pas. Consigner chaque anomalie avec les étapes minimales, le résultat observé et la preuve ; refaire le cas après correction sur le nouveau build. Les fonctionnalités d’accessibilité déclarées dans App Store Connect doivent suivre les résultats réels, pas cette liste d’intentions.

Références : [règles App Review](https://developer.apple.com/app-store/review/guidelines/), [suppression de compte](https://developer.apple.com/support/offering-account-deletion-in-your-app/), [déclarations de confidentialité](https://developer.apple.com/app-store/app-privacy-details/), [déclarations d’accessibilité](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels), [permissions du sélecteur Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/).
