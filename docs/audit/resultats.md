# Résultats — 23 septembre 2026

| Contrôle | Résultat |
| --- | --- |
| TypeScript (`tsc --noEmit`) | Réussi après les dernières corrections vidéo et liens |
| Structure native | Réussie : aucune WebView, balise HTML ou chaîne JSX hors Text |
| Tests Node métier | 12 réussis |
| Tests Vitest | 1 048 réussis dans 129 fichiers |
| Tests de préparation à la livraison | 6 réussis |
| Total | **1 066 tests réussis, aucun échec de test** |
| Inventaire | 155 routes ; contrôle des destinations statiques réussi |
| Liens publics HTTP | 12 réponses 200 ; voir `liens-publics.json` |
| Bundle Web de recette isolée | Compilation et réponse HTTP 200 vérifiées ; recette visuelle partielle documentée |
| Exports de livraison Web / Android / iOS | Réussis après les dernières corrections, code 0 ; bundles seulement, sans compilation APK/Xcode |
| Navigateur interactif | Disponible ensuite : recette partielle réalisée, voir `recette-visuelle.md` ; contrôleur instable |
| Appareils Android / iOS | Non exécuté |

Les tests de fixture utilisent le client Supabase réel contre un serveur local en mémoire, notamment pour le suivi/retrait et le commentaire fictif. Aucun commentaire réel, vote réel, abonnement, message ou changement de base distante n’a été effectué.

La validation visuelle aux quatre largeurs, les thèmes et les interactions sur appareil restent ouverts. Les tests de logique ne certifient pas la disponibilité des intégrations distantes, les politiques de la base déployée ou les autorisations matérielles.

Les journaux temporaires de cette exécution sont `/tmp/expo-parcours-tests-final.log`, `/tmp/expo-parcours-types-final.log` et `/tmp/expo-parcours-export-final.log`.

Revalidation complémentaire : `/tmp/recette-suite-vitest-node22.log` (1 048 tests), `/tmp/recette-suite-node-final.log` (12 tests métier et 6 tests de livraison), `/tmp/recette-suite-native-final.log` (interfaces natives). Les 14 tests de simulation et les nouveaux tests vidéo sont inclus dans le total Vitest, sans double comptage. Le contrôle de format des 11 fichiers concernés réussit.

La première relance générale avec Node 25 a subi un plantage du processus npm pendant le contrôle natif (code 139). Une tentative Vitest sans progression a ensuite été arrêtée. Les contrôles ont été exécutés séparément et la suite Vitest complète a réussi avec Node 22.22.0 et un seul worker en 80 secondes. Aucun échec de test n’est masqué par ces incidents d’exécution.

Export final : `/tmp/recette-suite-export-final.log`, sortie `/tmp/footnation-recette-final-export`. Les bundles Web, iOS et Android ne contiennent aucun des marqueurs contrôlés de la configuration de recette (clé factice, clé de session séparée, port de fixtures et module de garde réseau). La copie locale de recette a été redémarrée depuis les derniers fichiers et son serveur répond en scénario `normal`. Son interface finale n’a pas pu être parcourue : Chrome est resté absent de l’inventaire des navigateurs.

## Revalidation du 24 septembre

- **1 065 tests Vitest réussis dans 129 fichiers**, plus **18 tests Node** (12 métier, 6 préparation à la livraison), soit **1 083 tests réussis**. Les suites ciblées sont incluses dans ce total.
- Structure native et format des fichiers modifiés : réussis.
- TypeScript recontrôlé après les dernières modifications de traduction : réussi (`/tmp/recette-24-typecheck.log`).
- Clubs : correction des couleurs de filtres/liens en mode sombre, contraste calculé d’au moins 4,5:1 sur quatre fonds et douze couleurs ; auteurs de commentaires repliables et profils tactiles d’au moins 44 px.
- Traduction : appel complet conservé ; découpage UTF-8 seulement après un diagnostic explicite de longueur, lots bornés, annulation, conservation des paragraphes et emojis. Aucun succès partiel affiché. Le bouton après erreur indique « Masquer ».
- Le problème serveur ancien documenté dans `supabase/functions/translate/DEPLOYMENT.md` n’est pas certifié résolu par ces corrections locales. Aucun déploiement, secret ou schéma distant modifié.
- Chrome a de nouveau répondu après plusieurs délais. Connexion fictive, pause/reprise/son/boucle du short et filtre Ami(e)s contrôlés dans l’interface ; détails dans `recette-visuelle.md`.
- Recette club : vote nominatif, profil du votant, trois listes de communauté, recherche d’effectif, onglets chargés et états vides ; rendu sombre observé à 360/768/1280 px sur clubs rouge et bleu. Le téléphone physique reste non exécuté.
- Trois accords au singulier corrigés suite aux observations réelles (rencontres, effectif, statistiques de classement). Pas de nouveau test pour ces changements textuels ; vérification TypeScript et native finale.

Journaux : `/tmp/recette-24-vitest.log`, `/tmp/recette-24-node.log`, `/tmp/recette-24-native.log`, `/tmp/recette-24-format.log`. Les exports du 23 septembre restent des preuves de la version précédente ; aucun nouvel export de livraison n’est assimilé à une exécution sur téléphone.
