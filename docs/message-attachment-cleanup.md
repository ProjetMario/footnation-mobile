# Purge locale des pièces jointes abandonnées

La migration `supabase/migrations/20260911062000_private_message_attachments.sql` et la fonction `supabase/functions/message-attachment-cleanup/` sont préparées localement. Aucun déploiement, planificateur, appel distant Storage ou suppression réelle n’a été exécuté.

## Contrat et protection de la course purge/envoi

Un fichier du bucket privé `message-attachments` est candidat uniquement s’il a plus de 48 heures et qu’aucun message ne référence son chemin. La RPC service-only `claim_native_message_attachment_cleanup(limit)` réserve au plus 100 chemins ; le worker en réclame 25. Une reservation crée un tombstone permanent dans `native_message_attachment_cleanup` et un `claim_id`.

L’autorisation d’upload, le trigger d’insertion du message et la réservation de purge utilisent le même verrou transactionnel calculé sur le bucket et le chemin. La purge revérifie l’absence de message après obtention du verrou. Si le message gagne la course, son fichier est conservé. Si la purge gagne, le tombstone interdit l’upload, la lecture et tout INSERT tardif du message. Le tombstone reste présent après suppression et interdit la réutilisation du chemin. Le service role ne doit pas recréer manuellement un objet sous un chemin réservé.

La suppression passe exclusivement par `storage.from('message-attachments').remove([path])`, qui supprime le blob et sa métadonnée ensemble. Aucune requête SQL ne supprime `storage.objects`. La RPC `finish_native_message_attachment_cleanup(path, claim_id, deleted)` acquitte seulement le claim courant. Un reçu ancien ne peut acquitter une nouvelle tentative.

Un timeout de suppression ou une confirmation DB perdue peut être repris : le chemin réservé ne peut être réutilisé entre deux tentatives, donc une nouvelle suppression Storage reste idempotente. Trois suppressions au maximum sont simultanées, avec un timeout HTTP de dix secondes. Les échecs reculent exponentiellement et s’arrêtent après dix tentatives, en état `failed` pour examen serveur. Un claim interrompu est repris après cinq minutes. Les tombstones ne sont pas purgés automatiquement.

## Paramètres à valider avant une activation ultérieure

- `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` : uniquement dans l’edge runtime, jamais dans le client, les logs ou les réponses.
- `MESSAGE_ATTACHMENT_CLEANUP_ENABLED=true` : absent ou autre valeur, le worker reste fermé.
- `MESSAGE_ATTACHMENT_CLEANUP_SECRET` : secret dédié aléatoire d’au moins 32 caractères, envoyé comme Bearer par un planificateur de confiance. Ne pas réutiliser le secret du worker push.

Le POST ignore tout bucket/chemin fourni dans son corps : il ne traite que les réservations de la base. La section locale `[functions.message-attachment-cleanup]` de `supabase/config.toml` désactive la vérification JWT de la passerelle pour cette seule fonction : l’authentification est le Bearer dédié du handler. Ce réglage ne déploie ni n’active le worker. La comparaison utilise des condensats de taille fixe. Aucun CORS navigateur ni endpoint client n’est prévu.

Un passage horaire peut servir de point de départ, à adapter au volume des uploads et au backlog. Aucun cron n’est créé par la migration. Le worker retourne seulement `processed`, `deleted`, `failed`, jamais les chemins ou détails des erreurs. Les objets devenus référencés après un upload normal sont exclus. Les URL signées déjà émises ne peuvent pas être rappelées ; leur durée doit rester courte côté client.

## Audit et tests

La migration interdit aussi d’effacer/remplacer une pièce jointe existante ou d’en changer le message, l’expéditeur et le destinataire. Les métadonnées, le chemin, le MIME, la taille et les contraintes audio sont contrôlés avant insertion. Les politiques restrictives protègent le bucket malgré d’anciennes politiques permissives ; les buckets sans rapport restent accessibles selon leurs propres règles.

`tests/attachmentCleanup.test.ts` teste le worker avec un faux Storage API, notamment timeout, lots, échecs partiels, authentification et absence de fuite. `backend/tests/private-message-attachments.sql` teste la migration dans une base PostgreSQL en mémoire avec RLS et politiques historiques volontairement trop larges. Exécution locale : `FOOTNATION_PGLITE_MODULE=/chemin/vers/pglite/dist/index.js node backend/test-private-message-attachments.mjs`.

La suite couvre les deux ordres logiques de la course (message existant avant claim ; claim avant INSERT tardif), les confirmations périmées et la persistance du tombstone. PGlite n’émule pas plusieurs connexions serveur concurrentes : compléter par cette vérification sur PostgreSQL jetable et une vérification Storage réelle avant toute activation.

## Vérification PostgreSQL à deux connexions

Le script `backend/test-release-concurrency.py` crée ses propres clusters PostgreSQL 16 temporaires, avec socket privé et TCP désactivé, exécute les fixtures puis les arrête. Il confirme les deux ordres réellement simultanés : une insertion de message conserve son fichier pendant la tentative de purge ; une purge ayant réservé le chemin fait attendre puis refuser l’insertion tardive avec `42501`. Ces essais passent. Aucune suppression via Storage distant n’est exécutée.
