# Activation, invitations et retour après connexion

## Parcours disponible

- Un lien coach `login?mode=signup&teamInvite=CODE` conserve son code pendant la connexion, l’inscription, la confirmation email, Google et la création du profil. Il ouvre la confirmation d’invitation d’équipe avec le code rempli. L’utilisateur doit appuyer sur « Rejoindre l’équipe » ; ouvrir un lien ne crée aucune adhésion.
- Si un compte est déjà connecté, l’écran propose directement d’ouvrir l’invitation. Après acceptation, le calendrier du club est accessible immédiatement.
- Les contenus partagés et destinations connues sont conservés par AuthGate. Les retours sont validés par une liste de routes ; les URL externes, actions d’édition et paramètres d’acceptation automatique sont refusés.
- Le retour OAuth est échangé une seule fois et ne peut provoquer qu’une navigation pour le compte effectivement authentifié. Un changement de compte invalide le retour de l’ancien compte.
- Le guide de première utilisation et la demande de partage utilisent un état commun par utilisateur. Le guide met l’équipe, le calendrier et les convocations en avant. Il défile sur petit écran.
- Aucun de ces deux messages ne recouvre un lien partagé, une invitation, une convocation ou un appel. Ils s’affichent uniquement sur l’accueil ou « Mon profil ». Fermer le guide ou la demande de partage espace les sollicitations de sept jours ; l’accès manuel au partage reste disponible.

## Cohérence des invitations

La migration `20260911076000_native_team_invitation_idempotency.sql` ajoute des reçus privés par invitation et membre. L’acceptation approuve explicitement le membre, ce qui lui donne accès aux écrans calendrier/effectif existants. Elle ne dépend pas de `profiles.updated_at`, absent du schéma vérifié.

Deux envois simultanés du même code par le même membre consomment une seule place. Le rejeu après épuisement ou révocation confirme une acceptation déjà effectuée sans modifier le profil ni l’adhésion. Un membre retiré ne peut pas se réinscrire à l’aide de son ancien reçu. Une équipe archivée ou déplacée vers un autre club est refusée. Les nouveaux reçus et les liens du coach sont intégrés au contrôle de suppression de compte ; supprimer un reçu ne supprime pas une adhésion.

## Vérification

- `npm run typecheck`
- `npx vitest run tests/authReturn.test.ts tests/authCodeExchange.test.ts tests/networkInvite.test.ts tests/incomingPath.test.ts tests/referral.test.ts tests/referralBackend.test.ts`
- `tests/team-invitations-backend.sql`, exclusivement dans une base PostgreSQL vide `team_test_*`, avec `-v team_test_disposable=1` : autorisations, doublons, statut approuvé, épuisement, suspension, comptes distincts, équipe déplacée, membre retiré, dépendances de suppression.
- Deux tests de concurrence ont également été exécutés sur PostgreSQL 16 jetable : répétition simultanée du même membre et course entre deux membres pour la dernière place.

## Recette sur les appareils à installer

1. Ouvrir un lien coach sans session ; s’inscrire, confirmer l’email et compléter le profil ; vérifier que le code est conservé sans acceptation automatique.
2. Répéter avec Google, un compte existant, un mot de passe oublié et un changement de compte.
3. Accepter, vérifier le calendrier et l’effectif, puis couper le réseau juste après l’envoi et réessayer : une seule place doit être consommée.
4. Ouvrir un profil, club ou post partagé avec connexion requise : retrouver la bonne destination et aucun message marketing superposé.
5. Fermer le guide ; vérifier l’absence d’invitation immédiate, puis reconnecter le même compte durant la période de sept jours.

Les liens HTTPS dépendent des associations de domaines et du comportement de la version web publiée. Cette évolution ne fournit pas de suivi différé d’un lien à travers une installation depuis les stores. La réception des liens sur les builds signés reste à valider sur iOS et Android.
