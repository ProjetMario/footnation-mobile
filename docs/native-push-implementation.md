# Notifications natives — audit et travail restant

Audit distant du 8 septembre 2026, sans lecture de contenu membre ni écriture.

## État de l'audit initial

- Seule table publique correspondante : `notifications`. Champs : id, sender_id, receiver_id, type, content, link, metadata, read, email_sent_at, created_at.
- Aucun trigger utilisateur sur cette table ; aucune fonction publique dont le nom contient push ou notif.
- Aucun registre push/device n'était présent lors de cet audit. Les migrations 55 et 56 décrites plus bas ont depuis ajouté le registre privé et le journal des intentions. Extensions `pg_cron` et `pg_net` installées ; leur présence ne prouve pas qu'un ordonnanceur applicatif est configuré.
- Recherche dans le code source : fonction connection-notifications orientée email Resend, pas Expo/APNs/FCM. Aucun transport push trouvé dans les sources inspectées.
- Application Expo au moment de l'audit : préférence push sauvegardée mais texte indiquant l'indisponibilité. Le module et son plugin ont depuis été ajoutés ; aucun projectId EAS ni aucune configuration de certificats push n'est toutefois disponible. EAS n'était pas connecté lors du dernier contrôle.

## Mise en œuvre à poursuivre

1. Registre privé des installations, lié au compte courant : token Expo, plateforme, projet, date de renouvellement, révocation. RLS et mutations serveur testées contre accès intercomptes ; traitement explicite de la déconnexion, changement de compte et token périmé. Ne pas publier les tokens dans les journaux ou les profils.
2. Client Expo Notifications : permission seulement à la demande de l'utilisateur, canal Android avant demande, projet EAS vérifié avant obtention du token, état réel de permission et du registre affiché. Séparer le code natif du web. Ne pas afficher « activé » tant que l'inscription serveur n'a pas réussi.
3. File serveur issue des nouvelles notifications internes, sans envoi rétrospectif des données historiques. Destination issue de receiver_id, préférence contrôlée au moment de l'envoi, contenu discret pour écran verrouillé. Aucun endpoint permettant de choisir librement un destinataire et un contenu.
4. Worker d'envoi authentifié, taille des lots bornée, tickets et reçus Expo, reprises bornées, révocation DeviceNotRegistered. Tester les échecs réseau et réponses partielles avec un transport simulé avant activation.
5. Réception et clic : vérifier le compte destinataire, normaliser la route interne, éviter les navigations répétées au redémarrage. Ne pas marquer une conversation lue à la simple réception d'une alerte.
6. Raccorder les paramètres existants, puis vérifier sur Android/iOS installés : accord/refus, arrière-plan, application arrêtée, clic, déconnexion/changement de compte, révocation, erreurs de transport. Vérifier les credentials APNs/FCM et le projet EAS avant tout envoi réel.

Cette liste décrit du travail restant ; aucun push n'est envoyé ou présenté comme opérationnel.

Référence SDK exact : https://docs.expo.dev/versions/v57.0.0/sdk/notifications/

## Registre serveur installé (migration 55)

`native_push_installations` et RPC `register_native_push_installation` / `revoke_native_push_installation` sont déployés. Aucune lecture ni écriture directe autorisée aux clients. Le token reste une capacité secrète obtenue d'Expo : sa possession permet le transfert vers une nouvelle installation/compte ; ce mécanisme n'est pas une attestation matérielle. L'identifiant d'une installation seul ne permet pas de remplacer le token d'un autre compte.

Enregistrement : installation UUID, projet UUID, token Expo et plateforme ios/android ; retourne un lease UUID neuf. Le client devra conserver installation et lease dans le stockage sécurisé. Révocation : installation et lease exact du compte courant, pour qu'un ancien logout ne supprime pas une inscription plus récente. Expiration serveur à 30 jours, dix installations par compte ; renouvellement au focus à prévoir. Le worker devra exclure les lignes expirées au moment d'envoyer. Un compte supprimé perd ses installations par cascade.

Tests PostgreSQL jetables passés et métadonnées distantes vérifiées. Table distante vide. Permission système, inscription client, préférences, déconnexion et transport serveur restent à raccorder ; aucune notification push n'est opérationnelle à ce stade.

## Tentatives durables et code natif — 9 septembre 2026

Migration 56 déployée : `native_push_intents` conserve les inscriptions et les révocations par UUID d'opération fourni par le client avant l'appel. Les nouvelles RPC `register_native_push_device` / `revoke_native_push_device` rendent les reprises idempotentes. Une révocation crée son enregistrement même si l'inscription n'est pas encore arrivée ; une inscription tardive avec cet UUID est refusée. L'ancienne RPC d'inscription n'est plus exécutable directement par les clients. Ne pas purger ces traces sans mécanisme serveur interdisant définitivement les anciennes tentatives.

`pushRegistration.ts` sérialise les actions, sauvegarde pending/active/revoking, refuse d'écraser le journal d'un autre compte, retire une ancienne inscription avant remplacement et ne réinscrit jamais pendant un retrait. `pushDevice.native.ts` utilise le stockage sécurisé existant, le projet EAS validé avant la permission, le canal Android, un JWT vérifié puis figé pour chaque RPC et une confirmation explicite avant suppression du journal. Le fichier web ne demande aucune permission native. Expo Notifications 57.0.17 et son plugin sont ajoutés.

L'interface de confidentialité appelle maintenant le module. Une désactivation sauvegarde d'abord la préférence serveur puis révoque l'installation ; une activation inscrit d'abord l'appareil puis ne marque la préférence active qu'après réussite complète. Si cette dernière sauvegarde échoue, le client tente de révoquer l'inscription. La déconnexion explicite révoque l'appareil avant de fermer la session et reste relançable si la révocation échoue. Une suspension impose toujours la déconnexion après une tentative de révocation, car un futur worker devra également exclure les comptes suspendus au moment de l'envoi.

L'activation reste fermée par `EXPO_PUBLIC_NATIVE_PUSH_ENABLED=false` tant que le transport serveur, les reçus Expo et les credentials ne sont pas validés. Le Web ne demande aucune permission native ; une préférence déjà active peut encore y être désactivée. Le pont natif traite le dernier clic et les réponses reçues en cours d'exécution. Il n'accepte qu'un UUID de notification, revalide la session puis relit la notification avec `receiver_id` avant d'appliquer `notificationPath` au lien stocké. Aucune route fournie directement par le payload n'est ouverte et le clic ne marque pas la notification ou une conversation comme lue. Une erreur réseau conserve la réponse pour une reprise au prochain passage au premier plan ; une réponse traitée est effacée pour éviter une seconde navigation au redémarrage.

Il reste à intégrer la récupération après retour sur un ancien compte/session expirée, le renouvellement avant expiration, l'observation des permissions et le service d'envoi. Le journal d'un ancien compte n'est volontairement pas écrasé.

270 tests applicatifs passent (8 cœur et 262 Vitest), dont les tests du journal, des séquences de préférence, de la déconnexion et du clic push. Fixture PostgreSQL des intentions passée. Expo et Expo Router sont alignés avec SDK 57 et `expo install --check` passe. Export Android/iOS/Web réussi après le raccordement au layout racine. Prebuild isolé sans installation CocoaPods/Gradle réussi : entitlement iOS `development`, canal Android `footnation` et couleur `#E91E8C` présents. Cela ne prouve pas la compilation, la signature APNs/FCM ni la livraison. Les deux tables distantes sont vides ; aucune permission réelle demandée et aucun jeton réel inscrit.

`npm audit --omit=dev` signale 16 dépendances transitives de sévérité modérée, sans alerte haute ou critique. Les corrections automatiques proposées rétrograderaient Expo ou Expo Router vers des versions incompatibles avec SDK 57 ; aucun `audit fix --force` n'est appliqué. Les avis directs concernent notamment le décodage d'URI via Expo Router et `uuid` via les outils de génération Xcode. Ils devront être réévalués lors des prochaines versions compatibles d'Expo.

## Transport et renouvellement implémentés localement — 11 septembre 2026

Le code ci-dessous complète les étapes de transport décrites plus haut. **La migration 57 et l’edge function ne sont pas déployées ; aucun envoi réel, token réel ou secret de production n’a été utilisé pour ces tests.** Les validations sur appareils signés restent nécessaires.

### Contrat serveur

Source : `supabase/migrations/20260911057000_native_push_delivery.sql` et `supabase/functions/native-push/`.

- `native_push_deliveries` est une file privée sans accès client. Le trigger ne concerne que les nouvelles notifications, sans reprise de l’historique. Une notification ne peut être mise en file qu’une fois par installation. Le cap de 100 notifications par destinataire et par heure limite le fan-out, sans modifier les notifications internes.
- L’ajout et le claim contrôlent la préférence `user_preferences.push_notifications IS TRUE`, les notifications non lues et récentes, la suspension et les blocages dans les deux sens. Le claim vérifie encore le destinataire, le projet et le lease actif. Les changements intervenant après ce contrôle ne peuvent rappeler un push déjà transmis au prestataire.
- `claim_native_push_deliveries(project_id, phase, limit)` est réservé au service role ; `phase` vaut `send` ou `receipt`, et le maximum est 100. `FOR UPDATE SKIP LOCKED` empêche deux workers de réclamer le même lot. Les confirmations sont également liées à un `claim_id` unique et enregistrées avec au plus cinq requêtes simultanées.
- `finish_native_push_delivery(id, claim_id, outcome, ticket_id, error_code)` conserve uniquement les états, identifiants et codes d’erreur autorisés. Ni corps de réponse Expo ni token ne sont dupliqués dans la file. `DeviceNotRegistered` révoque seulement l’installation et le lease exacts concernés ; un reçu ancien ne supprime jamais une inscription plus récente.
- Reçus demandés après 15 minutes, puis repris jusqu’à 23 heures. Le succès d’un reçu signifie remise au service Apple/Google, pas lecture par la personne. HTTP 429/5xx et `MessageRateExceeded` entraînent un recul exponentiel plafonné, avec cinq tentatives d’envoi au maximum. Les erreurs de credentials ne révoquent pas les appareils.
- Un timeout réseau, une réponse d’envoi malformée ou un worker interrompu après envoi sont marqués `unknown`, sans renvoi automatique susceptible de créer un doublon. Expo ne fournit pas une transaction atomique avec PostgreSQL : une acceptation dont le ticket n’a pas pu être sauvegardé reste ambiguë. Un claim de reçu interrompu peut être repris sans renvoyer la notification.
- Les métadonnées terminales de la file sont purgées après sept jours, par lots de 1 000 lors des claims. Les tombstones `native_push_intents` ne sont jamais purgées. Aucun cron ni extension n’est installé.

Le POST `native-push` n’accepte ni destinataire ni contenu. Le payload sortant contient un titre FootNation, un texte générique et uniquement `data.notificationId`; pas de message privé, lien fourni par le client ou identité d’expéditeur. La réponse HTTP contient les nombres `sendProcessed` et `receiptProcessed` : ce sont des éléments traités, pas une garantie de réception.

### Paramètres de déploiement à valider ultérieurement

| Variable serveur | Usage |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Accès privé aux RPC depuis l’edge runtime uniquement |
| `NATIVE_PUSH_PROJECT_ID` | UUID EAS exact de l’application signée ; un worker ne traite que ce projet |
| `NATIVE_PUSH_DELIVERY_ENABLED` | Doit valoir `true` pour autoriser le traitement ; absent ou autre valeur ferme le worker |
| `NATIVE_PUSH_WORKER_SECRET` | Secret aléatoire indépendant d’au moins 32 caractères, transmis comme Bearer par le planificateur de confiance |
| `EXPO_ACCESS_TOKEN` | Jeton serveur à configurer si la sécurité améliorée Expo Push est activée |

Le Bearer de l’endpoint est le secret dédié du worker, pas un JWT utilisateur. La section locale `[functions.native-push]` de `supabase/config.toml` désactive la vérification JWT de la passerelle pour cette seule fonction, en conservant la vérification constante du secret dans le handler. Ce réglage ne déploie ni n’active le worker. Ne jamais désactiver globalement la vérification JWT d’autres fonctions. Aucun appel navigateur/CORS n’est prévu. Une invocation POST par minute est le point de départ ; surveiller le backlog et les erreurs avant d’augmenter la cadence. Les journaux du planificateur doivent masquer les en-têtes d’authentification.

Ordre à valider : schéma cible et migration 57, déploiement de la fonction initialement fermée, credentials APNs/FCM et projet EAS, secret et planificateur de confiance, test sur appareils consentants, puis activation serveur et du build `EXPO_PUBLIC_NATIVE_PUSH_ENABLED`. Ce document ne lance aucune de ces opérations.

### Maintien de l’inscription et clics

Le pont natif effectue une maintenance au retour au premier plan et observe la rotation du token. Il n’inscrit jamais automatiquement un appareil sans journal existant, ne demande jamais la permission et respecte la préférence serveur. Une permission système retirée déclenche la révocation ; une intention `revoking` est seulement terminée. Une inscription active est renouvelée après sept jours via `renew_native_push_device(installation_id, lease_id)`, RPC authentifiée conservant le même lease. Elle refuse tout autre compte, ancien lease ou préférence désactivée. La rotation du token utilise le protocole durable existant et un nouveau lease. Les échecs réseau conservent le journal pour la prochaine reprise ; le journal d’un ancien compte n’est pas écrasé.

Les clics revalident la session après lecture de la notification ; le contrôleur vérifie aussi le compte courant avant navigation. Les doubles événements sont dédupliqués, un résultat lent ne remplace pas un clic plus récent et l’ancien clic n’efface pas la dernière réponse système. Les conversations ne sont jamais marquées lues par cette mécanique.

### Vérifications locales

`tests/pushDelivery.test.ts`, `pushDevice.test.ts`, `pushResponse.test.ts`, `pushRegistration.test.ts` et `pushPreference.test.ts` utilisent uniquement des mocks. Le test natif couvre permission, opt-out, rotation, renouvellement, reprise d’intention et isolation de compte.

`backend/tests/native-push-delivery.sql` a été exécuté dans PostgreSQL en mémoire avec PGlite : restrictions anon/authenticated, éligibilité, claim exclusif, confirmations périmées, délai des reçus, ancienne invalidation contre nouveau lease, timeout ambigu, backoff limité et révocation exacte. Le test est reproductible avec `FOOTNATION_PGLITE_MODULE=/chemin/vers/pglite/dist/index.js node backend/test-native-push-delivery.mjs` depuis `mobile-expo`. Le module peut aussi être fourni par le runtime local ; aucune dépendance de production n’a été ajoutée. Les tests en mémoire ne remplacent pas une vérification concurrente multi-connexion et des essais APNs/FCM sur vrais appareils avant activation.

La fixture a également passé sur PostgreSQL 16 isolé avec deux connexions simultanées : pendant qu’un premier worker réserve une notification dans sa transaction, le second ne reçoit aucun doublon. Script : `backend/test-release-concurrency.py`, qui démarre et arrête lui-même ses clusters avec TCP désactivé. Aucun appel Expo/APNs/FCM n’est effectué.
