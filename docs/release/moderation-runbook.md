# Exploiter la modération FootNation

Le code prépare le traitement ; il ne prouve pas qu’une personne surveille actuellement la file. Pour son exploitation, désigner un responsable et un remplaçant disposant du rôle administrateur, vérifier leur accès et faire un exercice sur un environnement isolé. Aucun compte n’a été promu par cet audit.

Le backend de modération a été installé sur FOOTNATION le 24 septembre 2026 après approbation. Les nouveaux écrans restent dans l’espace de travail local ; les anciennes modifications directes des signalements sont désormais refusées côté serveur. L’organisation humaine et la distribution des interfaces doivent encore être confirmées. Voir le [compte rendu d’activation](guidelines-lot-a-activation-2026-09-24.md).

## Traitement

1. Ouvrir Administration → Signalements. Les cas de sécurité des mineurs puis de violence passent en tête ; les autres sont présentés du plus ancien au plus récent. Une alerte visuelle indique les cas de plus de 24 h : c’est un seuil de suivi, pas une promesse de délai déjà tenue.
2. Ouvrir le contenu et le profil concernés. Vérifier le contexte sans contacter le membre automatiquement. Pour un risque impliquant un mineur, limiter l’accès et escalader au responsable suivant la procédure juridique de FootNation ; ne pas télécharger/repartager un contenu illicite pour constituer une recette.
3. Marquer « En cours », puis retirer le contenu ou classer sans suite, avec un motif compréhensible. Une décision périmée est refusée ; actualiser si un autre administrateur a déjà traité le cas.
4. Vérifier avec un compte ordinaire que le contenu retiré n’est plus proposé, y compris dans le flux du club. Le retrait masque la publication ; il ne purge pas automatiquement le fichier public sous-jacent. Une procédure de retrait du média et des caches reste nécessaire pour les contenus illégaux et les URLs déjà diffusées.
5. Le membre voit l’état dans Compte et confidentialité → Mes signalements. Le signalement et son auteur ne sont pas accessibles au profil signalé. Les notes doivent rester factuelles et peuvent être lues par l’auteur du signalement via les données qui lui sont autorisées.

Le filtre serveur ajouté bloque un petit ensemble de menaces explicites et d’injures discriminatoires dans les textes nouveaux/modifiés. Il complète le filtre client et résiste à un appel direct à l’API. Il ne détecte pas toutes les langues, l’obfuscation, les images, le son ou les vidéos ; une organisation humaine et/ou un service de classification adapté restent à établir. Aucun service externe payant ni analyse de médias réels n’a été activé.

## Contrôle d’exploitation

- Au début et à la fin de chaque permanence : contrôler les dossiers prioritaires, le plus ancien dossier ouvert et les cas dépassant le délai interne retenu.
- Relever le nombre reçu/clos, délai médian et maximum, incidents d’autorisation et erreurs de retrait. Ne pas exporter les détails privés dans un tableau public.
- Refaire périodiquement les tests d’un membre simple, d’un administrateur suspendu et de décisions concurrentes. Le rôle d’administrateur ne doit pas contourner un blocage pour contacter un membre.
- Vérifier le formulaire de contact avec un message de recette autorisé, son destinataire, sa boîte de réception et son remplacement en cas d’absence. Cette réception n’a pas été testée par un envoi réel.

## Migration

Les anciens signalements sans cible structurée peuvent être examinés/classés. Le bouton de retrait n’est disponible que pour un contenu identifié et relié à son auteur côté serveur ; ne pas déduire une cible d’un simple texte libre. La migration ne réattribue pas automatiquement les anciens liens.

Fichiers : `20260924130000_content_moderation_workflow.sql`, `20260924131000_community_text_filter.sql`. Prévoir une activation serveur avant publication des nouveaux écrans. La RLS des tables ne suffit pas à protéger un service qui utilise une clé de service : vérifier aussi les fonctions/vues publiques du déploiement, les buckets et les caches.
