# Activation du lot A — FOOTNATION — 24 septembre 2026

Après l’approbation explicite du propriétaire, les trois migrations prévues ont été appliquées au projet **FOOTNATION** (`zkvwqywtlkkkxmapehwe`). La transaction unique a été validée le **24 septembre 2026 à 10:22:34 UTC**. Aucun compte réel, contenu, signalement ou fichier utilisateur n’a été supprimé pour cette opération.

| Version enregistrée | Fonction activée |
| --- | --- |
| `20260924120000` | Suppression d’un propriétaire en conservant groupes/pages et contributions des tiers ; aucune réattribution ou promotion automatique. |
| `20260924130000` | Traitement des signalements réservé aux administrateurs autorisés, décisions motivées et versionnées, retrait des publications/shorts/stories et de leurs copies dans les actualités de club. |
| `20260924131000` | Filtrage serveur limité de menaces et injures explicites lors des créations/modifications de textes membres. |

## Vérifications effectuées

- Projet lié, schéma des propriétaires et définitions des fonctions relus avant écriture ; correspondance exacte des préconditions de suppression confirmée.
- Copie du schéma public et du journal de migrations conservée localement, sans lignes utilisateurs. C’est une copie de schéma, pas une sauvegarde complète des données ni un test de restauration Storage.
- Les deux suites SQL ont de nouveau réussi sur un PostgreSQL local jetable : conservation des contributions tierces, autorisations, transactions annulées, conflits de décisions, confidentialité et filtre texte.
- Les trois fichiers ont été exécutés dans une seule transaction, avec délais de verrouillage, préconditions et postconditions. Leur code a été enregistré dans `supabase_migrations.schema_migrations`. Les empreintes SHA-256 du journal relu correspondent exactement aux trois sources approuvées.
- Les deux références de propriétaire sont désormais nullables et utilisent `ON DELETE SET NULL`. Les contrôles d’autorité tiennent compte du propriétaire absent.
- Sept règles RLS restrictives et seize déclencheurs du lot sont présents et actifs. Le contrôle de suppression partagé reste réservé au service ; la décision de modération refuse les visiteurs anonymes.
- Sept contrôles HTTP ont réussi après actualisation du cache de schéma : lectures sans lignes sur les cinq tables concernées, absence de droits de modération pour un visiteur et refus HTTP 401 de la procédure de décision avant toute mutation.
- Le filtre accepte un texte de football ordinaire et refuse la menace synthétique utilisée dans le test. Aucun texte de recette n’a été publié.

Preuves : [reçu et contrôles détaillés](guidelines-lot-a-activation-2026-09-24.json), [état serveur actuel](guidelines-backend-observations.json), [état avant activation](guidelines-backend-before-lot-a.json).

## Ce qui reste à valider

L’autorisation couvrait ces trois migrations. Les interfaces Web/Expo corrigées restent locales ; aucun site, build, Edge Function ou formulaire App Store n’a été publié. Les anciens écrans qui modifient directement les signalements seront refusés : les nouveaux écrans utilisent la procédure autorisée.

Les contrôles distants ont vérifié le schéma, les droits et les fonctions sans scénario destructif sur de vrais membres. La suppression complète avec Storage/facturation/révocation, la recette administrateur connecté et le traitement opérationnel des signalements restent à exercer avec des comptes dédiés dans un environnement isolé. Le masquage en base ne révoque pas les URLs publiques de médias déjà diffusées.

Apple est toujours désactivé ; Google reste activé. L’admission sociale et la révocation Apple appartiennent au lot B, non appliqué ici. La [recette iPhone de 31 cas](recette-iphone-guidelines.md) reste à exécuter sur un build signé. Aucune validation App Store complète n’est revendiquée.
