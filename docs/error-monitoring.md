# Suivi des erreurs FootNation

## Ce qui est raccordé

`@sentry/react-native ~7.11.0` correspond à la version recommandée par Expo SDK 57. Le module `monitoring.ts` est chargé avant les fournisseurs de l'application. Il reçoit les erreurs de rendu et de routes, les erreurs finales des requêtes/mutations React Query, les erreurs de chargement du profil et les erreurs des lecteurs vidéo. Les gestionnaires Sentry couvrent aussi les exceptions JavaScript non interceptées.

Le suivi reste **inactif** sans DSN valide et sans `EXPO_PUBLIC_ERROR_REPORTING_ENABLED=true`, et toujours inactif en développement. Aucun projet Sentry, destinataire d'alerte ou envoi réel n'a été configuré/testé pendant ce lot.

Le transport est volontairement JavaScript (`enableNative:false`) : tous les événements passent par le filtre testé. Les crashs natifs du processus, les blocages de l'application et les erreurs antérieures au chargement du module ne sont pas couverts. Activer le transport natif nécessitera un filtrage natif et une recette séparés : le filtre JavaScript ne s'applique pas à ces rapports.

## Données conservées et exclues

Le filtre reconstruit chaque événement avec : version de l'application, environnement preview/production, catégorie d'erreur, nom du fichier de route (`profile/[id]`, sans identifiant résolu), type standard d'exception et positions dans les fichiers compilés. Les Debug IDs et noms des bundles sont normalisés ensemble pour conserver l'association aux source maps. Le texte brut de l'erreur est remplacé par une catégorie générique ; cela réduit volontairement le détail disponible au diagnostic.

Les comptes, identifiants membres, emails, corps de messages, valeurs de formulaires, clés de requêtes, variables des mutations, URLs complètes, en-têtes, jetons, lignes de code et historiques de console/navigation sont exclus. Aucune capture d'écran, hiérarchie de vues, session replay, journal ou trace de performance n'est activée. Le SDK reçoit `sendDefaultPii:false` et `infer_ip:never`. Les coupures attendues sont ignorées, les mêmes objets d'erreur dédupliqués et le débit limité à 20 rapports par minute.

Un échec d'initialisation ou d'envoi du suivi ne doit pas empêcher l'ouverture de l'application ou son écran de reprise. Le transport JavaScript ne fournit pas de file persistante garantie après fermeture hors ligne.

## Activation et source maps

1. Choisir/créer le projet Sentry destiné à FootNation et récupérer son DSN public. Vérifier les règles de conservation et les destinataires d'alertes dans ce projet.
2. Renseigner dans l'environnement EAS utilisé :

   ```dotenv
   EXPO_PUBLIC_ERROR_REPORTING_ENABLED=true
   EXPO_PUBLIC_SENTRY_DSN=https://PUBLIC_KEY@HOST/PROJECT_ID
   EXPO_PUBLIC_APP_ENV=preview
   SENTRY_ORG=organisation
   SENTRY_PROJECT=projet
   SENTRY_AUTH_TOKEN=jeton-de-build
   ```

   Le DSN est public. Le jeton doit rester dans les secrets de build, jamais dans `app.json`, un champ `extra` ou une variable `EXPO_PUBLIC_*`. Le contrôle `check:build-env` refuse une activation sans configuration complète et masque les valeurs.

3. Générer une nouvelle build preview native. `app.config.js` active alors le plugin Sentry ; `metro.config.js` ajoute les Debug IDs. Le plugin prépare l'envoi des source maps pendant les compilations natives. Une génération `prebuild` seule ne les envoie pas et ne valide pas les credentials.
4. Provoquer une erreur **synthétique** dans une build de test, vérifier sa réception, l'environnement et l'association à la bonne ligne de code. Vérifier aussi qu'aucune donnée personnelle n'apparaît. Retirer le déclencheur de test avant livraison.
5. Configurer dans Sentry les alertes sur nouvelles erreurs/régressions, puis passer l'environnement à `production` dans la build destinée aux stores. Une intégration présente dans le code ne prouve ni la réception ni les alertes.

Pour un export Web ou une future mise à jour EAS Update, l'envoi des source maps nécessite une étape spécifique. Les générer avec `expo export --source-maps` dans un dossier privé et les envoyer au **même** projet Sentry avec sa CLI ; ne pas publier les fichiers `.map` avec le site. Les Debug IDs doivent correspondre exactement aux bundles distribués. Les versions de l'application doivent être incrémentées à chaque livraison ; l'export courant de développement n'est pas une livraison.

Un export de contrôle local avec source maps dans `/tmp/footnation-monitoring-maps.oPpP8n` a confirmé la présence du même Debug ID dans le bundle Web et sa map (3 559 sources). Aucun fichier n'a été envoyé. Cette vérification confirme la génération, pas la symbolication dans un projet Sentry distant.

Références officielles : [Expo et Sentry](https://docs.expo.dev/guides/using-sentry/), [installation Expo du SDK Sentry](https://docs.sentry.io/platforms/react-native/guides/expo/), [options de collecte](https://docs.sentry.io/platforms/react-native/configuration/options/).
