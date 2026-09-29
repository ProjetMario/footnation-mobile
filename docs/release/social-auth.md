# Google et Apple — activation et recette Expo

Implémentation locale du 24 septembre 2026. Les fournisseurs distants, la signature Apple et les échanges réels avec Google/Apple ne sont pas validés par les tests locaux.

## Ce qui est livré

- Boutons partagés sur Connexion et Inscription ; Google suit PKCE Supabase. Apple utilise la feuille système sur iOS avec nonce SHA-256 et vérification du `state`, OAuth Supabase sur Android et Web.
- Même destination et parrainage à travers la connexion et la finalisation du profil. Une connexion sociale n’accorde aucun droit d’administration de club. L’âge et l’accord parental restent contrôlés par le serveur.
- Le retour OAuth est lié à une tentative locale non secrète (identifiant aléatoire, fournisseur, compte initial, durée maximale de dix minutes). Le compte initial doit encore être courant avant l’échange du code ; deux retours concurrents partagent le même échange. La tentative reste disponible après une redirection Web complète, puis est effacée au succès ou à l’annulation.
- Un retour dépourvu de ses paramètres OAuth est refusé tant qu’une tentative sociale est enregistrée. Une action explicite de connexion par mot de passe, d’inscription par e-mail, de renvoi de confirmation ou de récupération remplace cette tentative abandonnée ; consulter un écran ne l’efface pas.
- iOS utilise le bouton Apple natif. Android et Web embarquent le bouton officiel Apple ; le logo Google et sa police sont également embarqués, sans requête de marque avant une action utilisateur.
- Les jetons Google/Apple sont retirés du stockage de session avant écriture. Le jeton de rafraîchissement Apple OAuth et le code Apple natif sont transmis uniquement au service authentifié `apple-auth-credentials` pour permettre la révocation à la suppression du compte.
- Le nom donné une seule fois par Apple est enregistré uniquement dans les champs de métadonnées manquants. La requête utilise le JWT de la session capturée ; elle ne doit jamais modifier un compte qui s’est connecté pendant la requête.

## Configuration avant activation

1. Faire appliquer séparément les migrations sociales et Apple contrôlées, puis déployer `apple-auth-credentials` et la version correspondante de suppression de compte. Vérifier les secrets serveur requis dans la documentation du service ; aucun de ces secrets n’appartient aux variables `EXPO_PUBLIC_*`.
2. Configurer Google dans Supabase et sa console, avec le callback HTTPS Supabase du projet approuvé. Vérifier consentement, domaines et compte de test réel.
3. Activer Sign in with Apple pour `com.footnation.app` dans Apple Developer et la signature de la nouvelle app. Créer le Services ID pour Web/Android et configurer son domaine/callback HTTPS Supabase. Dans Supabase, placer le Services ID **en premier** dans la liste des Client IDs et l’App ID natif ensuite. Enregistrer le domaine d’envoi pour les adresses privées Apple.
4. Déclarer les retours exacts utilisés par `AuthSession.makeRedirectUri` pour chaque build (schéma `com.footnation.app`, chemin `auth/callback`) et le domaine Web Expo approuvé. Conserver les paramètres `social`, `attempt`, `next` et `ref` de l’URL de retour. Tester les URLs générées par les vrais builds ; ne pas remplacer la liste de redirection de production par un joker universel.
5. Renouveler le secret client OAuth Apple avant son expiration (au plus six mois). Cette contrainte touche Web/Android même si le login natif continue à fonctionner.
6. Activer explicitement `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=true` et `EXPO_PUBLIC_APPLE_AUTH_ENABLED=true` dans l’environnement de build seulement lorsque ces conditions sont remplies. En leur absence, les boutons restent cachés. Sur iOS, Google n’est proposé que si Apple est configuré et disponible sur l’appareil.
7. Produire une nouvelle app signée : l’ajout d’`expo-apple-authentication`, de son plugin et de `ios.usesAppleSignIn` nécessite un nouveau binaire. Expo Go n’est pas une preuve de configuration de l’app App Store.

### Compatibilité du backend partagé

La migration `20260924100000_social_signup.sql` ajoute l’état d’accès `profile_required` et `onboarding_required` pour les **nouveaux** comptes sociaux. Les comptes déjà créés ne sont pas inscrits rétroactivement dans cette finalisation. La nouvelle app Expo gère ces états et la route `/social-signup`.

Le site principal connaît désormais `profile_required` et propose la finalisation du profil social avec le même contrat serveur. Activer `VITE_MEMBER_ACCESS_ENABLED=true` lors du déploiement coordonné du registre d’âge, du contrôle d’accès et de l’inscription sociale. Le flag ne contourne jamais les restrictions serveur ; il évite de bloquer le site actuel avant installation des RPC. Vérifier également les anciennes versions Expo ou utiliser un environnement isolé. Le projet FOOTNATION inspecté le 24 septembre ne possède pas encore ces fonctions. Aucun contournement de l’âge n’est prévu en repli.

## Recette obligatoire avant App Review

Utiliser des comptes de test distincts et ne pas publier de messages ou de commentaires réels.

| Cas | Attendu |
| --- | --- |
| Nouveau compte Google/Apple | Connexion, formulaire de profil incomplet, conditions et âge, accès seulement après admission |
| Compte existant | Profil personnalisé conservé, aucune seconde fiche ni fusion manuelle par e-mail |
| Apple e-mail masqué | Adresse relais acceptée et compte récupérable à la connexion suivante |
| Apple nom absent au deuxième login | Aucun nom existant écrasé ; onboarding manuel si encore incomplet |
| Annulation / fermeture du navigateur | Retour propre sans message d’échec technique |
| Réseau perdu / fournisseur mal configuré | Erreur lisible, aucun faux succès, possibilité de recommencer |
| Retour OAuth livré deux fois | Un seul échange PKCE et une seule navigation |
| Changement de compte pendant connexion | Pas d’écriture ni de navigation attribuée au nouveau compte |
| Invitation d’équipe / parrainage | Contexte conservé jusqu’à la fin de l’inscription, aucune adhésion automatique |
| Réauthentification avant suppression | Retour à la suppression même si le profil est incomplet |
| Suppression Apple | Suppression et révocation ou traitement explicite du cas ancien sans jeton, reçu de suppression vérifié |
| iPhone/iPad réel | Bouton système, mode sombre, VoiceOver, feuille Apple, deep link signé |
| Android réel / Web Expo | Retour OAuth et fermeture propre du navigateur ; Google et Apple |

## Sources

- [Expo SDK 57 Apple Authentication](https://docs.expo.dev/versions/v57.0.0/sdk/apple-authentication/)
- [Supabase Sign in with Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- [Google branding](https://developers.google.com/identity/branding-guidelines)
- [Apple Sign in on other platforms](https://developer.apple.com/documentation/signinwithapple/incorporating-sign-in-with-apple-into-other-platforms)
