# Pièces jointes et messages vocaux — préparation locale

Les messages texte restent compatibles avec le serveur existant. Les commandes de pièces jointes sont proposées dans les versions natives uniquement lorsque la RPC `native_message_attachments_available()` confirme la migration. Le module `expo-audio ~57.0.4` nécessite une nouvelle compilation native ; l’aperçu Web ne valide pas la capture sur téléphone.

## Parcours

Le membre choisit un fichier (JPEG, PNG, WebP, PDF, MP4 ou audio MP4/MP3/WebM/Ogg), limité à 10 Mo. Le fichier choisi est copié dans un brouillon privé de l’application ; l’upload n’a lieu qu’en touchant Envoyer. La légende est facultative. Les vidéos et images reçues s’ouvrent dans une vue native ; les autres documents utilisent le lecteur système associé.

Le bouton Message vocal demande explicitement le microphone, puis enregistre au maximum deux minutes. Terminer prépare le fichier à envoyer ; Annuler le retire. Quitter l’écran, passer en arrière-plan ou recevoir un appel interrompt la capture sans envoi automatique. Le microphone n’est jamais activé au montage de la conversation. La configuration désactive l’enregistrement et la lecture audio en arrière-plan.

L’envoi fige l’identifiant du message et le chemin du fichier. Une tentative incertaine reste dans le journal du compte et doit être vérifiée ou abandonnée avant un nouveau message. La reprise commence par relire le message déjà enregistré ; elle n’insère pas une seconde fois une réponse réseau perdue. Abandonner ne retire pas un message qui aurait déjà été reçu.

## Confidentialité et serveur

- Bucket `message-attachments` privé, jamais `getPublicUrl`. Chemin lié à expéditeur/destinataire/message/fichier ; aucune URL signée n’est enregistrée dans le message ou le journal.
- Autorisation par participants, relation acceptée ou destinataire administrateur pour l’envoi, blocages bidirectionnels et suspensions. Métadonnées, type, taille et objet uploadé sont contrôlés à l’insertion.
- Les objets et les pièces jointes d’un message sont immuables. Des politiques restrictives protègent le bucket même si une ancienne politique Storage est trop large.
- Le destinataire demande une URL de trois minutes lorsqu’il ouvre le média. Une URL déjà remise reste utilisable jusqu’à son expiration ; un blocage ne rappelle pas des octets déjà téléchargés. Les nouvelles demandes sont recontrôlées par le serveur.
- Une seule lecture vocale est lancée à la fois. Elle s’arrête hors écran, en arrière-plan ou pendant un appel. Les images privées ne sont pas mises dans le cache disque d’Expo Image.
- Les brouillons non envoyés sont retirés à la sortie de la conversation. Ceux d’une tentative incertaine restent pour sa reprise, puis sont nettoyés après confirmation ou abandon.

La migration locale est `supabase/migrations/20260911062000_private_message_attachments.sql`. Le worker de nettoyage associé utilise l’API Storage et des revendications serveur pour les uploads abandonnés. Une tentative dont l’objet a été purgé doit être abandonnée, puis le fichier choisi à nouveau : le chemin retiré n’est pas réutilisable.

## Vérifications et limites

Les tests de contrat vérifient chemins étrangers/traversée, MIME, tailles, durée, ordre JSONB, isolation des brouillons et reprise d’un message texte ancien. Les permissions SQL et la purge ont leurs tests synthétiques séparés. Ils ne remplacent pas l’installation native, les permissions système, la sélection d’un fichier depuis iCloud/Drive, le microphone, le lecteur PDF et les essais entre deux comptes de recette.

Le déploiement exige d’abord la revue du schéma cible et des anciennes politiques Storage, puis une validation séparée des fonctions et du planificateur. Aucun fichier réel ni message de test n’a été envoyé pendant cette préparation.
