# Comparaison de l’espace club FootNation avec SportEasy — 4 novembre 2026

## Méthode et limites

Comparaison des fonctionnalités publiquement décrites par SportEasy, notamment ses pages [fonctionnalités club](https://www.sporteasy.net/fr/clubs/features/), [fonctionnalités équipe](https://www.sporteasy.net/fr/teams-2/), [offres club](https://www.sporteasy.net/fr/clubs/plans/) et [gestion d’un club](https://www.sporteasy.net/fr/clubs/), avec le code Expo et les tests examinés dans FootNation. Il ne s’agit pas d’une comparaison exhaustive de tous les écrans ou de toutes les offres SportEasy, ni d’une recette de la version distribuée. « Local » désigne des changements non déployés ; une fonctionnalité existant dans le code n’est pas automatiquement vérifiée en production.

| Fonction SportEasy | État relevé dans FootNation | Écart ou vérification |
| --- | --- | --- |
| Multi-équipes, catégories, effectifs et rôles | Gestion d’équipes, membres, staff, liens d’invitation et approbation dans Expo. | Droits de coach et réapprobation corrigés localement ; parcours déployé complet à vérifier. Les profils de joueurs et comptes liés ne coïncident pas toujours. |
| Calendrier club et équipe, matchs, entraînements, autres événements | Écrans matchs et séances ; calendrier filtré par équipe préparé localement. | Migration locale nécessaire ; les convocations de séance et les pointages sont distincts, dates non synchronisées automatiquement après modification. Pas de synchronisation avec calendrier personnel repérée dans les parcours examinés. |
| Convocations ciblées, réponse et notifications | Création et réponse joueur existantes ; choix de membres par coach, lien depuis match/séance et notification à la réponse préparés localement. | Tests SQL locaux et sur copie de schéma, sans test authentifié de l’interface ni réception push. Seuls les joueurs actifs et approuvés avec profil lié sont éligibles dans le nouveau parcours. |
| Relances et suivi des non-réponses | État des réponses visible dans le parcours d’administration ; pas de relance ciblée trouvée dans les écrans de convocation examinés. | Vérifier et concevoir une relance manuelle ou planifiée sans doublons, ainsi que les préférences de notification. |
| Pointage et bilan d’assiduité | Présent, absent, retard, excusé et blessé ; bilan côté administration ; accès coach aux pointages préparé localement. | Le nouveau pointage coach ne propose que présent/absent ; convocation et séance ne partagent pas automatiquement le même relevé ; bilan par équipe et saison à vérifier. |
| Messagerie club et groupes, médias, commentaires | Groupes et messages de club existent ; médias affichés dans le code ; parcours simulés et contrôles SQL ont été effectués. | Gestion par équipe/coach, partage de fichiers, discussions attachées à chaque événement et livraison réelle restent à vérifier. |
| Résultats, classements, statistiques équipe et joueurs | Matchs et scores, totaux du club, statistiques individuelles et vote MVP existent dans le code ; certaines fonctions ont des tests SQL. | Saisie de statistiques encore réservée aux admins ; persistance et droits réels à vérifier. Pas d’équivalent complet Live Stats identifié pour les matchs du club. |
| Tactique et compositions | Pas d’éditeur de composition tactique lié aux convocations trouvé dans les écrans club examinés. | À vérifier plus largement ; envisager formations, placement, remplaçants et visibilité aux coachs ou à l’équipe. SportEasy décrit ces options [ici](https://www.sporteasy.net/fr/teams/features/lineup/). |
| Notes et votes après match | Vote MVP présent dans le code et testé isolément. | Notes des joueurs, notes de match, commentaires et photos associés à la feuille de match non établis par les contrôles réalisés. |
| Inscriptions, cotisations, collectes et paiements | Invitations et demandes d’adhésion existent. | Aucun parcours complet de paiement de cotisations et de suivi des règlements trouvé dans les écrans club examinés. La présence de fonctions de paiement ailleurs dans le projet ne prouve pas une gestion financière de club. |
| Documents et autorisations des adhérents | Profils et consentement parental existent dans l’application. | Pas de parcours club complet vérifié pour licences, certificats, autorisations, échéances et documents de mineurs. |
| Comptes parents et gestion de plusieurs enfants | Consentement parental trouvé. | Un consentement n’équivaut pas à un compte parent pouvant gérer plusieurs enfants et leurs convocations ; aucun tel parcours n’a été validé. |
| Sponsoring club | Pas de gestion club de sponsors comparable trouvée dans les écrans examinés. | Vérifier les autres modules ; les champs professionnels de profil ne démontrent pas une gestion des sponsors du club. |
| Tâches, bénévolat et covoiturage | Aucune affectation de tâches par événement ou organisation de covoiturage trouvée dans les parcours club examinés. | Vérifier plus largement et définir les besoins avant réalisation. |
| Championnats et données fédérales | Consultation de compétitions, classements et import d’équipes présents dans le code. | Couverture, exactitude, mises à jour et correspondance avec les équipes créées par le club restent à vérifier. |

## Priorités proposées

1. Finaliser et tester de bout en bout les droits d’équipe, les convocations, les réponses, le pointage, les notifications, et relier correctement les événements aux relevés.
2. Ajouter suivi des non-réponses, relances, bilan d’assiduité par équipe et saison, et cohérence lors du report ou de l’annulation d’un événement.
3. Étudier composition tactique, suivi sportif et statistiques accessibles aux coachs.
4. Définir séparément les parcours parents, documents et paiements, dont les règles métier et les autorisations restent à préciser.

## Notification des réponses aux coachs

La migration locale `20261104110000_notify_coaches_convocation_response.sql` notifie les coachs actifs et approuvés de l’équipe quand le joueur répond présent ou absent à une convocation. Pour une convocation sans équipe, elle cible les coachs des équipes actives et approuvées auxquelles le joueur appartient ; elle déduplique les destinataires. Une répétition de réponse identique ne produit pas de nouvelle notification. Les tests locaux vérifient les réponses et changements, l’équipe, le retrait et l’absence de doublon. Sur une branche temporaire reconstruite depuis le schéma cible, une réponse d’un joueur fictif a créé une notification pour son coach mais pas pour celui d’une autre équipe. Les identités étaient simulées en SQL ; ni l’interface authentifiée ni la réception push sur appareil n’ont été testées. La branche et les exports ont été supprimés. La migration n’est pas déployée.


## Relances et composition tactique — ajout local

Les coachs approuvés et administrateurs autorisés disposent localement d’une action de relance des membres convoqués sans réponse, avec un maximum d’une notification par membre sur 24 heures. Une composition privée liée au match permet de choisir l’une de six formations et d’affecter onze postes à des joueurs actifs approuvés de l’équipe. Les versions évitent les écrasements concurrents ; le changement d’équipe d’un match est refusé tant qu’une composition contient des joueurs. Cette première version ne propose pas de terrain graphique, de remplaçants, de partage aux joueurs ou plusieurs compositions.

Les tests SQL synthétiques vérifient le ciblage, l’absence de doublon sur 24 heures, les droits, le retrait du coach, les joueurs d’une autre équipe, les doublons de joueurs, les conflits et le changement d’équipe ; le contrôle TypeScript réussit. Sur une branche temporaire reconstruite à partir du schéma cible, un coach fictif a créé une relance, une deuxième immédiate a été refusée, et une composition 4-3-3 a été enregistrée et relue ; la notification et la composition ont été constatées en base. Les requêtes utilisaient une identité SQL simulée. La branche et l’export ont été supprimés. Les écrans n’ont pas été vérifiés avec une connexion réelle, la réception push n’a pas été testée et les changements ne sont pas déployés.


## Terrain et publication de la composition — ajout local

L’éditeur Expo affiche maintenant un terrain graphique avec onze postes, six formations et jusqu’à douze remplaçants. Deux options indépendantes permettent de publier aux joueurs approuvés de l’équipe ou au public ; elles sont désactivées par défaut. Une vue en lecture a été ajoutée dans le calendrier membre et sur les rencontres de la fiche publique. Les contrôles de visibilité sont appliqués par une fonction serveur ; les enregistrements directs restent interdits.

Sur une branche temporaire reconstruite depuis le schéma cible, des comptes fictifs ont vérifié la composition privée, la publication aux joueurs de l’équipe, le refus d’un joueur d’une autre équipe et d’un visiteur anonyme, la publication publique, son retrait, le refus d’un coach révoqué et les doublons de joueurs. La branche et les exports ont été supprimés. Le contrôle TypeScript Expo a réussi. Le test SQL local séparé n’a pas pu démarrer faute d’espace disque ; les requêtes de recette utilisaient des identités SQL simulées. Les écrans et le rendu visuel sur téléphone ou navigateur avec une vraie connexion n’ont pas été validés, et les migrations ainsi que les écrans ne sont pas déployés.


## Synchronisation des dates et des pointages — ajout local

Lorsqu’une convocation est liée à une séance ou à un match, sa date suit désormais celle de l’événement. Une modification directe de la date de la convocation liée est refusée : il faut modifier l’événement. Pour une convocation liée à une séance, l’écran de la convocation et celui de la séance consultent et modifient le même relevé de présence. La réponse du joueur reste distincte et les notes du relevé sont conservées. Les relevés existants sont rapprochés par la migration ; en cas de contradiction elle s’interrompt sans choisir une valeur. La modification du lien d’une convocation déjà pointée est également bloquée pour éviter de perdre des données.

Sur une branche temporaire reconstruite depuis le schéma cible, les changements de date d’une séance et d’un match ont été répercutés sur leurs convocations. Un coach fictif a pointé depuis la convocation puis corrigé depuis la séance ; les deux écrans SQL voyaient le même statut, les notes et la réponse étaient conservées, une modification périmée et un accès non autorisé étaient refusés. Les garde-fous de date et de changement de lien ont été exercés. Un premier essai a révélé une erreur du déclencheur, corrigée puis retestée. La branche et les exports ont été supprimés. Le contrôle TypeScript Expo réussit. Les identités ont été simulées en SQL ; l’interface et le cas de migration avec données contradictoires existantes restent à tester. Les modifications sont locales et non déployées.
