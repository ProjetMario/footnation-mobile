# Correspondance des données — Expo / site / App Store

Inventaire préparatoire du 24 septembre 2026. Aucune déclaration n’a été envoyée à App Store Connect. La politique canonique locale est `src/content/legal.json` dans Expo ; le site importe désormais ce même document pour éviter les divergences. Sa publication reste distincte de cette modification locale.

La colonne Apple propose les catégories à examiner d’après le code ; elle doit être validée contre les services et le binaire effectivement utilisés. Une donnée facultative peut rester déclarable. Ne pas cocher « aucune collecte ».

| Données et preuve dans le code | Catégorie Apple à examiner | Finalité | Liée au compte | Fournisseurs / vérification restante |
| --- | --- | --- | --- | --- |
| Nom, email, téléphone, adresse saisis dans profil/club ; relais Apple | Coordonnées : nom, email, téléphone, adresse physique | Fonctionnalités du compte, contact | Oui | Supabase, fournisseur d’identité choisi ; contrôler les champs effectivement envoyés |
| Date de naissance, rôle, parcours, données sportives | Autres données / contenu utilisateur ; données de forme physique si mesures d’activité corporelle utilisées | Profil, admissibilité, recherche | Oui | Supabase ; classer selon les champs collectés, sans déclarer de données médicales inexistantes |
| Identifiant Auth/profil, identité Google/Apple | Identifiants : identifiant utilisateur | Authentification, sécurité | Oui | Supabase et Google/Apple ; jeton Apple de révocation chiffré serveur si service activé |
| Photos, vidéos, voix déposées ; messages et pièces jointes | Contenu utilisateur : photos/vidéos, audio, emails/messages, autre contenu | Publication, messagerie | Oui | Supabase Storage ; distinguer médias publics et pièces privées ; valider suppression et rétention |
| Relations, connexions, abonnements | Contacts / réseau social | Mise en relation, fil | Oui | Supabase ; aucun import automatique du carnet d’adresses du téléphone dans Expo |
| Vues, réactions, pronostics, matching, jour UTC d’activité et plateforme | Données d’utilisation : interactions avec le produit, autres données d’utilisation | Fonctionnalités, analyse d’usage | Oui | Supabase ; les agrégats admin ne rendent pas les lignes source anonymes |
| Ville, département, région, pays renseignés | Localisation approximative, coordonnées selon le champ | Recherche/matching | Oui | Supabase ; aucune demande GPS pour la recherche de clubs ; ne pas inventer de localisation précise issue du téléphone |
| Jeton push et UUID d’installation, après opt-in | Identifiants : identifiant appareil | Notifications | Oui | Expo Push / APNs / FCM ; confirmer activation, révocation, durée et destinataires |
| Rapports Sentry filtrés, version et plateforme | Diagnostics : données de panne/autres diagnostics | Stabilité | À vérifier dans les événements reçus | Fonction optionnelle ; `sendDefaultPii:false` seul ne prouve pas une anonymisation ; vérifier aussi le traitement IP du fournisseur |
| Signalements, motif, réponse/état, contact support et retours bêta | Assistance clientèle / autre contenu utilisateur | Sécurité, support, amélioration | Oui | Supabase et services de contact ; destinataire humain et conservation à confirmer |
| Texte demandé et traduction | Autre contenu utilisateur | Traduction demandée par le membre | Source liée au compte ; requête fournisseur sans identifiant utilisateur explicite | DeepL, MyMemory ou LibreTranslate selon configuration ; fournisseur exact, cache, transfert et durée à vérifier |
| Statut premium, identifiant client et historique accessible | Achats / informations financières selon données reçues | Droits existants, facturation | Oui | Stripe côté site ; pas de collecte de carte dans le parcours Expo audité ; couvrir les données associées reçues par l’app |
| Métadonnées d’appel, signalisation temporaire et trafic relayé | Audio/vidéo, identifiants, données d’utilisation selon conservation effective | Communication demandée | Oui pour les métadonnées | Pas d’enregistrement des appels implémenté ; relais TURN et purge des SDP restent à vérifier sur le déploiement |

## Points à rapprocher avant de déclarer

1. Activer uniquement les services nécessaires au build et faire une trace de recette sans contenu personnel. Vérifier aussi les prestataires qui traitent des données pour le compte de FootNation.
2. Comparer la politique publiée sur le domaine, le document embarqué, les écrans d’autorisation et les réponses App Store Connect. L’égalité de deux fichiers locaux ne prouve pas celle des versions déjà publiées.
3. Vérifier les délais réels : purge d’activité à 90 jours, jetons push, cache de traduction, logs techniques, signalements/support, médias et sauvegardes. Le code de purge ne prouve pas qu’un ordonnanceur tourne. Toute durée non vérifiée reste ouverte dans l’audit.
4. Aucune collecte IDFA ni SDK publicitaire n’a été ajoutée. La réponse « données utilisées pour vous suivre » exige d’examiner le rapprochement inter-apps/sites et les destinataires actifs ; ne pas ajouter ATT sans activité de tracking correspondante.
5. Inspecter le rapport de confidentialité de l’archive Xcode et les manifestes des SDK effectivement intégrés, avec leurs versions. Les dépendances présentes dans `node_modules` ne constituent pas cette archive.
6. Vérifier séparément les contrats de sous-traitance/transfert et les obligations de conservation avec le responsable des données. Le présent inventaire n’atteste pas leur existence.

Sources : [détails de confidentialité Apple](https://developer.apple.com/app-store/app-privacy-details/), [manifestes de confidentialité](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files), [inventaire technique existant](privacy-inventory.md).
