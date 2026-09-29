# Mesure produit FootNation

Le tableau de bord **Super admin → Croissance & activité** (`/admin/growth`) repose sur les données du même Supabase que l’application. La migration `20260911074000_native_growth_metrics.sql` est nécessaire. Avant activation, l’écran explique l’indisponibilité ; aucune donnée de démonstration ni taux estimé n’est affiché.

## Données collectées et confidentialité

Le composant `GrowthActivityBridge`, monté sous `AuthProvider`, mesure l’ouverture de l’application au premier plan par un compte authentifié dont le profil est prêt. Une ligne par compte, jour UTC et plateforme (`ios`, `android` ou `web`) est conservée dans `native_activity_days`. Il s’agit de données **liées au compte, pas de données anonymes**. Aucune collecte avant connexion, aucun identifiant publicitaire/appareil, adresse IP, contenu de message, URL, texte libre ni propriété d’événement arbitraire. Le RPC vérifie l’identité et la suspension côté serveur, puis utilise la date serveur. Une ancienne requête A échouera si le compte B est désormais connecté.

Aucun client ne peut lire ni écrire directement les tables de mesure. Seul le RPC administrateur retourne des agrégats et vérifie que l’administrateur n’est pas suspendu. Les observations sont supprimées avec le compte via une clé étrangère en cascade ; l’autorisation correspondante est ajoutée à la liste de dépendances contrôlée du service de suppression.

Conservation cible : **90 jours**. La fonction de service `prune_native_growth_activity()` supprime jusqu’à 10 000 lignes expirées par appel. La migration programme `prune-native-growth-activity` toutes les 10 minutes **si `pg_cron` est déjà installé** ; elle n’installe aucune extension. Sans ce planificateur, configurer un ordonnanceur de confiance sur cette fonction avant la mise en production et surveiller sa bonne exécution. Si un lot atteint 10 000, le service doit répéter l’appel pour résorber le retard. Ne jamais exposer cette fonction à un client. Cette finalité et la durée doivent figurer dans l’information de confidentialité publiée.

## Définitions

- **Inscrits** : profils encore présents, selon `profiles.created_at`. Les jours UTC sont utilisés, jour courant inclus pour les fenêtres 7/30 jours. Pas de mesure d’abandon avant inscription.
- **Actifs mesurés** : comptes distincts ayant ouvert une version équipée du pont de mesure, au premier plan et connectés au réseau. Plusieurs appareils/plateformes comptent une seule fois. Pas de reconstitution depuis `app_usage` : cette ancienne table ne conserve que la première et la dernière ouverture par appareil.
- **Première action sous 7 jours** : publication dans `posts` ou réponse acceptée/refusée à une convocation dans les 7 jours suivant l’inscription. Cohortes depuis le début de la mesure, inscrites dans les 56 derniers jours et observées pendant 7 jours complets. Les comptes/post/réponses supprimés ne sont plus inclus ; les réponses s’appuient sur leur dernière date conservée. Ce n’est pas une mesure exhaustive des actions utiles.
- **Équipe active** : équipe active avec au moins deux membres approuvés et actuellement actifs dans l’effectif ayant ouvert l’application durant les 7 derniers jours. Ce n’est pas une preuve de présence physique à un entraînement, ni le critère de réussite du pilote (actions du coach et des joueurs), qui doit être évalué séparément.
- **Parrainés inscrits** : profils dont `referred_by` est renseigné, créés dans les 30 derniers jours. **Parrainés actifs** : sous-ensemble ayant ouvert l’application dans les 7 derniers jours. Aucun taux invitation→inscription n’est inventé, car le nombre de destinataires n’est pas connu.
- **Retour J7/J30** : compte ouvert exactement le 7e/30e jour UTC après sa date d’inscription ; ce jour doit être terminé pour entrer dans le dénominateur. Cohortes hebdomadaires sur les 56 derniers jours, uniquement après le début de la mesure. Un dénominateur nul affiche « En observation », pas « 0 % ».
- **Source manquante** : affichage « Indisponible ». La migration n’invente pas d’anciens enregistrements.

## Vérification et exploitation

- Tests locaux SQL : `tests/native-growth-backend.sql`, uniquement dans une base jetable vide nommée `native_growth_test_*`, avec `psql -X -v ON_ERROR_STOP=1 -v growth_test_disposable=1 -f tests/native-growth-backend.sql`. Jamais sur la base liée à Supabase.
- Tests client : `npx vitest run tests/growthMetrics.test.ts` depuis `mobile-expo`. Doublons, retour réseau, changement de compte, requêtes obsolètes, valeurs absentes et dénominateurs sont contrôlés.
- Recette : ouvrir sous un compte ordinaire, vérifier son refus d’accès au tableau de bord ; ouvrir une version équipée sous deux membres d’une équipe, vérifier un compte actif unique chacun et une équipe active ; quitter/reprendre l’application, vérifier l’absence de doublon ; tester le même compte sur deux plateformes.
- Surveillance : temps de réponse du RPC administrateur (limite 15 secondes), santé du nettoyage, fraîcheur de `generated_at` et adoption des versions instrumentées. Les erreurs de mesure n’empêchent pas les usages de l’application ; le pont réessaie au plus une fois par minute après échec et ne transmet pas de rapport contenant l’identité.

Avant une montée en charge importante, exécuter `EXPLAIN (ANALYZE, BUFFERS)` et des mesures de charge sur une copie de recette : le tableau de bord calcule ses agrégats en direct. Vérifier notamment les index sur `profiles.created_at`, `posts(user_id, created_at)` et les dates de réponse des convocations. Le nettoyage est borné à 10 000 lignes par appel (1,44 million par jour au rythme de 10 minutes) ; surveiller les lots pleins et le retard au-delà de 90 jours. Aucun test local ne prouve une capacité à un million d’utilisateurs actifs.
