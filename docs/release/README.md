# FootNation — dossier de bêta, 10 septembre 2026

Ce dossier prépare une distribution ; aucune version installée, invitation à des testeurs ou soumission aux stores n’est confirmée.

## Livrables

- [Audit de conformité du 24 septembre](app-store-review-2026-09-24.md), [recette iPhone détaillée](recette-iphone-guidelines.md) et [grille de résultats](recette-iphone-resultats.csv) : vérification demandée sans soumission aux stores.
- [Correspondance des données](app-privacy-matrix.md) et [traitement des signalements](moderation-runbook.md).
- [Activation approuvée du lot A, 24 septembre](guidelines-lot-a-activation-2026-09-24.md) : trois migrations installées sur FOOTNATION, contrôles serveur et limites de la recette.

- [Livraison fiabilité et pilote](delivery-2026-09-10.md) : migrations 740/750/760 appliquées, nouvelles fonctions de suivi, contrôles et limites de lancement.

- [Mode d’emploi de la bêta](beta-runbook.md) : commandes de vérification, état actualisé des services et relais d’installation iOS/Android au propriétaire.
- [Contrôle local du 10 septembre](preflight-2026-09-10.json) : résultat reproductible et valeurs masquées ; EAS, suivi d’erreurs et push restent à configurer.
- [Kit des 10 clubs pilotes](pilot-kit.md) : déroulement sur quatre semaines, critères d’élargissement et tableaux de suivi sans données inventées.
- [Checkpoint du 10 septembre](checkpoint-2026-09-10.md) : avancement des six étapes, preuves et limites.
- [Textes des fiches stores](store-copy.fr.md) : copie française prête à relire, limitée aux fonctions présentes.
- [Recette sur appareils](device-acceptance.csv) : cas à exécuter sur une version identifiée, avec des comptes réservés aux essais.
- [Données et permissions](privacy-inventory.md) : inventaire technique pour remplir les déclarations des stores ; les réponses finales dépendent de la configuration déployée.
- [Préparation de compilation](../build-readiness-2026-09-10.md) : outils réellement vérifiés et blocages d’installation.
- [Notifications](../native-push-implementation.md) et [suivi des erreurs](../error-monitoring.md) : activation et contrôles serveur.
- [Audit final du suivi d’erreurs](error-monitoring.md) : filtrage de sortie testé, données exclues et limites de couverture.

## Ordre de distribution

1. Confirmer le compte/organisation Expo et les comptes Apple Developer/Play Console ; conserver les identifiants `com.footnation.app` et vérifier les applications déjà enregistrées.
2. Examiner le schéma cible et valider les nouvelles migrations/fonctions en environnement de recette. Configurer les variables serveur hors du dépôt. Approuver séparément leur déploiement.
3. Relier le projet EAS, vérifier les variables publiques dans les environnements development/preview, configurer les signatures en réutilisant les certificats existants quand ils conviennent.
4. Produire la development build pour les modules natifs, puis une preview autonome. Installer sur iPhone et Android ; renseigner la version, le numéro de build et l’appareil dans chaque résultat de recette.
5. Corriger les blocages de connexion, fuite de compte, perte de données, crash ou paiement ; les tests automatisés seuls ne valident pas les appareils.
6. Capturer les écrans de cette version avec des contenus de recette autorisés, finaliser les informations de confidentialité et les accès de revue, puis distribuer la bêta à un groupe explicitement choisi.
7. Après retour de la bêta, générer les versions production signées et préparer la soumission. Les invitations et la soumission n’ont pas été envoyées.

## Captures à produire depuis la version installée

| Ordre | Écran réel                                             | Texte de présentation proposé     |
| ----- | ------------------------------------------------------ | --------------------------------- |
| 1     | Fil clair : publication, stories compactes, navigation | Ta passion, ton réseau            |
| 2     | Même fil sombre                                        | Le football, à ton rythme         |
| 3     | Profil et parcours sportif de recette                  | Fais découvrir ton parcours       |
| 4     | Opportunités avec une offre de recette                 | Explore de nouvelles opportunités |
| 5     | Conversation de recette, sans coordonnées privées      | Garde le contact avec ton réseau  |
| 6     | Clubs et événements disponibles                        | Vis le football ensemble          |

Les captures doivent montrer le produit livré. Les dimensions demandées sont à sélectionner dans les consoles pour les appareils pris en charge ; l’iPad est actuellement activé dans la configuration. [Documentation Apple sur les captures](https://developer.apple.com/help/app-store-connect/manage-app-information/upload-app-previews-and-screenshots).

## Informations encore nécessaires

Organisation Expo, accès de signature et consoles stores, téléphones de test, comptes de recette (joueur/club/admin et compte jetable pour suppression), environnement serveur cible, fournisseur TURN effectivement configuré, projet Sentry, interlocuteur et accès de revue des stores. Ne pas mettre de mots de passe, jetons ou codes à usage unique dans ces documents.
