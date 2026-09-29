# FootNation — kit de suivi des 10 clubs pilotes

Objectif de la première campagne : vérifier que l’application aide réellement une équipe chaque semaine. Les objectifs chiffrés ci-dessous sont des seuils de travail proposés, pas des résultats observés ni une prévision d’inscriptions.

## Recrutement et déroulement sur quatre semaines

Choisir dix clubs d’un même territoire, avec un éducateur référent volontaire et une équipe réelle par club. Le premier groupe peut commencer avec deux clubs pour corriger les problèmes avant l’arrivée des huit suivants. Le responsable prépare les rencontres sans envoyer automatiquement de messages aux clubs. Le dépôt ne doit contenir ni liste nominative de joueurs, ni coordonnées des éducateurs.

| Période        | Action du référent                                                                        | Preuve attendue                                                                   |
| -------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Avant l’entrée | Accord du club, version installée, comptes et calendrier de recette vérifiés              | Identifiant club dans `pilot-clubs.csv`, aucun blocage de la recette critique     |
| Semaine 1      | Le coach crée son équipe et invite ses membres ; ceux-ci s’inscrivent puis rejoignent     | Nombre d’invités, inscrits et rattachés ; premier événement planifié              |
| Semaine 2      | Convocation réelle autorisée et réponse des joueurs ; première publication d’équipe       | Présences cohérentes, notifications confirmées, une action utile par joueur actif |
| Semaine 3      | Résultat/vidéo autorisée partagé avec les proches via un lien qui conserve sa destination | Ouvertures et nouveaux utilisateurs activés attribuables, difficultés relevées    |
| Semaine 4      | Entretien court du coach et bilan de chaque équipe                                        | Retours J7/J30 observables, erreurs restantes, décision motivée d’élargissement   |

Le formulaire `pilot-clubs.csv` est une trame de dix places **NOT_CONTACTED**, sans club fictif présenté comme inscrit. Utiliser des codes stables (P01…P10), un rôle de responsable et une preuve agrégée. Les communications restent hors dépôt, dans les outils habituels autorisés.

## Tableau de bord hebdomadaire

Remplir une ligne de `pilot-weekly.csv` par club et semaine ; une case vide signifie « non mesuré », jamais zéro. Conserver les dénominateurs. Compter des comptes uniques et exclure les comptes de recette/équipe produit du bilan public.

| Indicateur                    | Définition                                                                                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conversion d’inscription      | Inscriptions terminées / inscriptions commencées dans une même période/cohorte                                                                                          |
| Première action utile         | Dans les sept jours après inscription : rejoindre son équipe et répondre à une convocation, publier ou envoyer un premier message ; compter une personne une seule fois |
| Retour J7 / J30               | Compte ayant une activité utile le 7e / 30e jour après son inscription ; n’inclure au dénominateur que les cohortes assez anciennes                                     |
| Équipe active dans la semaine | Au moins une action de gestion du coach et trois membres distincts réalisant une action utile pendant la semaine                                                        |
| Efficacité des invitations    | Invités distincts → inscrits → rattachés → première action utile ; ne pas assimiler le bouton Partager à une invitation effectivement reçue                             |
| Fiabilité                     | Échecs bloquants ouverts, échecs médias, erreurs JS observées ; le Sentry actuel ne couvre pas tous les crashs natifs                                                   |

Le dashboard de produit peut fournir une partie des comptes. Comparer ses définitions/périodes avec ce tableau avant de les fusionner ; une donnée non instrumentée reste à recueillir par observation de recette, avec son origine explicite. Le nombre d’inscrits seul ne décide pas de la réussite.

Dans le dashboard V1, « Équipes actives » signifie deux membres approuvés ayant ouvert l’application dans les sept derniers jours. Ce signal d’ouverture est distinct du critère pilote ci-dessus (action du coach et trois membres réalisant une action utile). Le dashboard mesure la première action via les publications et réponses aux convocations, et J7/J30 via les ouvertures ; les messages et actions utiles du bilan pilote nécessitent donc une observation complémentaire. Ne pas recopier ces taux comme s’ils utilisaient les mêmes événements.

## Critères proposés pour passer de 10 à 100 clubs

- Aucun incident ouvert de fuite intercompte, suppression incorrecte, perte de données ou démarrage/connexion bloqué ; correctifs validés sur iOS et Android.
- Au moins huit des dix équipes actives pendant deux semaines successives selon la définition ci-dessus.
- Au moins 60 % des membres inscrits du pilote ont accompli leur première action utile en sept jours ; dénominateur et date de cohorte connus.
- Chaque coach sait inviter, planifier et consulter les réponses sans assistance pendant une session observée ; les notifications de convocation sont reçues sur les appareils consentants de test.
- Retour J7 mesuré sur toutes les cohortes éligibles et causes d’abandon expliquées ; retour J30 évalué dès que la cohorte existe. Aucun taux J30 ne doit être inventé avant trente jours.
- Coûts vidéo/stockage suivis et capacité de support identifiée. Le passage national se décide après la validation des 100 clubs, pas automatiquement.

Ces seuils sont révisables après les premières observations. Ne pas acheter une campagne d’acquisition pour compenser un parcours bloquant.

## Recueil des retours

Consigner dans `pilot-issues.csv` : code du club, rôle, plateforme, build, parcours, étapes anonymisées, résultat attendu/observé, sévérité, statut et référence du correctif. Ne joindre ni mot de passe, URL privée de média, nom d’enfant, contenu de conversation, jeton ou export complet de compte.

Le référent peut poser après une semaine : « Pour quelle action as-tu rouvert FootNation ? », « Où as-tu eu besoin d’aide ? », « Quelle tâche du club continues-tu de faire ailleurs et pourquoi ? ». S’appuyer sur des exemples observés ; ne pas demander une note de satisfaction à la place du test des parcours.
