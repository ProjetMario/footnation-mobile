# Sauvegarde FootNation Expo — 27 septembre 2026

Le projet source se trouve dans `mobile-expo`. Il cible Android, iOS et le web avec Expo SDK 57.

L’en-tête utilise le ballon officiel avec le drapeau de la Bosnie et un texte FOOTNATION en dégradé animé bleu électrique, violet, rose et rouge. L’animation respecte la préférence système de réduction des mouvements.

Cette sauvegarde comprend également les évolutions locales des profils, expériences, palmarès, recommandations, couverture, recherche, découverte des clubs et consultation des publications. Les profils ayant renseigné une expérience sont regroupés parmi les membres actuels ou anciens du club concerné, selon leur période.

## Reprendre le projet

1. Décompresser l’archive et ouvrir le dossier `footnation-expo`.
2. Installer les dépendances avec `npm ci`.
3. Renseigner la configuration publique du backend dans `.env.local` : `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Les fichiers d’environnement locaux et les certificats ne sont pas inclus dans l’archive.
4. Lancer l’aperçu web avec `npm run web`.
5. Pour Android ou iOS, régénérer les projets natifs avec `npm run prebuild`, puis utiliser `npm run android` ou `npm run ios`. WebRTC nécessite une development build ; Expo Go seul ne suffit pas.

## Exports

`npm run export:all -- --max-workers 1` génère les bundles Android, iOS et web dans `dist-native`. Ces exports ne sont pas des APK/IPA signés. Les signatures et builds natifs restent distincts de cette sauvegarde ; aucun déploiement ni changement du backend n’a été effectué pour la créer.

Les sources sauvegardées incluent la configuration Expo/EAS, les routes, composants, assets, scripts et tests. Les dépendances installées, journaux, captures de recette, exports et projets natifs générés sont exclus pour garder une archive de travail réutilisable.
