# État de la migration FootNation

Cette livraison est une première implémentation native substantielle, **pas encore une migration intégrale terminée**. Le site d’origine contient 113 routes statiques actives, auxquelles s’ajoutent les pages SEO dynamiques. Une route native présente ne signifie pas que toutes les fonctions de la page web correspondante sont reprises.

Le [checkpoint du 10 septembre](docs/release/checkpoint-2026-09-10.md) et la [matrice de parité actuelle](docs/native-parity-step5.md) donnent l’état du dernier lot. Les notes datées plus bas sont un historique : leurs anciens écarts et comptes de tests ne décrivent pas tous l’état actuel. Les services ajoutés dans ce dernier lot restent locaux, sans déploiement ni validation sur téléphone.

## Repris dans le code natif

| Domaine | Implémentation actuelle | Écarts / validation restante |
| --- | --- | --- |
| Navigation et identité | Cinq commandes conservées, bleu FootNation, Inter embarquée, thèmes clair/sombre/automatique, contenu avant les scores | Vérification VoiceOver/TalkBack et appareils réels |
| Compte | Connexion email, inscription, Google par navigateur système, retour PKCE, récupération de mot de passe, contrôle des suspensions, sessions dans SecureStore | Parcours OAuth/email et expirations à valider sur appareil ; reprise complète des préférences à terminer |
| Profil | Profil et champs métier, photo/couverture, CV/PDF, parcours, diplômes et préférences ; synchronisation du parcours préparée avec identifiant stable et journal de reprise | Projection 680 locale non déployée, lignes manuelles conservées ; distinction personnelle sans éditeur natif ; recette appareil restante |
| Publications | Fil paginé, réseau, textes, images, vidéos, publication photo/caméra/vidéo, dix hashtags, modération textuelle existante, six réactions, commentaires, partage système, favoris | Édition/suppression de ses publications et de ses commentaires, commentaires paginés ajoutés ; classement personnalisé, musique, bibliothèque et modération avancée restent à reprendre ; actions connectées non validées de bout en bout |
| Stories | Bandeau compact, lecture, photo/légende/lieu/hashtags, expiration 24 h ; filtres visuels et journal de reprise local ajoutés | Rendu SVG et reprise après fermeture à valider sur appareils ; conversion automatique des stories expirées non reprise |
| Réseau | Recherche de membres, relations et invitations, accepter une invitation, suivre, signaler, bloquer | Relations paginées, invitations envoyées et retrait/refus/annulation ajoutés ; recherche par nom/pseudo/club/ville et filtres rôle/département ajoutés ; suggestions à terminer |
| Messages | Conversations et historique paginés, texte ; fichiers et vocaux natifs, journal par compte, lecture et nettoyage préparés | Backend privé 620 non déployé, transport et interruptions à tester sur appareils ; recherche et règles premium historiques restantes |
| Appels | Adaptateur WebRTC natif, permissions explicites, vocal/vidéo, accepter/refuser/raccrocher, arrêt en arrière-plan, contrats RPC existants | Compilation native et tests sur deux appareils nécessaires ; compatibilité WebRTC/Expo 57 non validée sur appareil ; table et RPC d’appels présentes sur le serveur ; configuration TURN et fonction distante à vérifier ; pas de push/CallKit |
| Clubs | Annuaire `fff_clubs`, pagination, recherche par nom, département, fiche, itinéraire | Équipes FFF, résultats, calendriers et classement d’équipe ajoutés via les fonctions existantes ; suivi FootLovers ajouté ; installations et filtres complets restent à reprendre ; administration décrite ci-dessous |
| Opportunités | Liste, recherche, types, détail, création/édition, activation, candidature avec questions et liste des candidats pour l’auteur | Demandes carrière, matching, formulaires avancés et limites premium restent à reprendre ; écritures non testées en production |
| Groupes | Liste publique, membres paginés, rejoindre/quitter, créer/modifier | Listes des groupes rejoints/créés et recherche paginée ajoutées ; opérations d’administration avancées à terminer ; dernier administrateur ne peut pas quitter dans cette version |
| Événements | Liste publique, détail, inscription/désinscription, créer/publier, modifier, tableau de bord, participants, statuts, annulation et suppression, sélecteur de date natif | Filtres avancés, médias, contacts et paiements à terminer |
| Shorts | Flux vertical, réactions/commentaires, publication ; bornes d’extrait, musique choisie, miniature et repères de buts | Repères persistants : migration 640 locale. Pas de fichier monté/mixé ni d’édition des Shorts publiés. Synchronisation et appareils à valider |
| Football | Matchs par date et fiches, actualités filtrées/paginées | Classements de cinq compétitions, pronostics et classement des pronostiqueurs ; détail des actualités, commentaires/réponses/suppression et trois réactions ajoutés ; activité du réseau, articles associés, sondages live et diffusion restent à terminer |
| Notifications | Consultation, non lues et compteurs ; registre, renouvellement, file serveur, worker Expo, reçus et clics implémentés localement | Transport fermé par défaut ; APNs/FCM, secrets, scheduler et livraison réelle application fermée non validés |
| Pages Pro | Gestion de page, contenus, équipes/matchs/effectifs, images, vérification ; sélection et téléversement vidéo natifs ajoutés | Capacité vidéo 630 locale non déployée. Collaborateurs d’administration absents ; le site affiche aussi « Bientôt ». Recette appareil restante |
| Blog et documents | Articles et documents natifs ; géographie : 45 villes, 16 présentations pays, 3 dossiers et traductions existantes | Pas de base internationale de clubs inventée ni de traduction générale de toute l’interface ; contenus juridiques à rapprocher du déploiement réel |
| Contact et suppression du compte | Contact existant ; nouveau service de suppression effective, garde de facturation, reçu et reprise, purge locale isolée | Migration 610 et fonction locales, fermées par défaut ; schéma/facturation et suppression de comptes de recette à valider avant activation |

## Ajouts : espaces membres et administration

- Membres : invitations de club paginées, accepter/refuser, équipes et convocations avec réponse présent/absent.
- Clubs : accès vérifié par RPC `is_club_admin`, identité, présentation/histoire, coordonnées, équipes, convocations et sélection des joueurs, matchs, palmarès, articles, publications, shorts, staff, membres/invitations, administrateurs, organigramme avec affectation de l’équipe principale et paramètres de statut réservés au site admin. Présences, compétitions et groupes de discussion en lecture ; statistiques calculées sur les matchs terminés avec score.
- Site : accès vérifié par RPC `is_site_admin`, compteurs, recherche et pagination utilisateurs/clubs/publications/signalements ; premium, suspensions et suppression des publications/signalements avec confirmation dans l’interface.
- Les mutations relisent les droits serveur et restent soumises aux politiques RLS. Les opérations à plusieurs étapes signalent les réussites partielles (invitation enregistrée, notification échouée).
- La revue des revendications est disponible dans un ecran natif : filtres, pagination, justificatifs et decision atomique avec confirmation. Les decisions reelles avec un compte administrateur restent a valider.
- Il reste notamment les affectations multiples et automatiques, les imports FFF, le téléversement des médias de club, les options avancées, la modération des messages, les statistiques détaillées et les outils administratifs annexes. **Toute l’administration n’est donc pas encore reproduite.**

## Ajouts : carrière, CV, réseau et replays

- Recherche de clubs recruteurs dans `clubs`, avec les filtres d’origine et pagination ; préférences carrière et option OPEN sous contrôle du statut Premium.
- CV affiché en composants natifs, PDF généré par le système puis partagé sur iOS/Android. Les textes sont échappés et le parcours n’est pas tronqué ; export sur appareil à valider. L’aperçu web ne propose pas un faux téléchargement PDF.
- Parcours éditable avec contrôle des modifications concurrentes et journal local. La projection des seules expériences natives identifiées dans `club_experience_members` est préparée par la migration 680, non déployée ; aucun rôle, adhésion ou événement de réseau automatique n’est créé. Voir [le contrat de synchronisation](docs/experience-sync.md).
- Parrainage : compteur réel, création du code sur action explicite et partage du lien existant. Le lien partagé conserve l’inscription web existante. La route native reconnaît `mode=signup&ref=…`, préremplit le code et conserve la référence dans les métadonnées d’inscription. Après confirmation, l’écran parrainage attribue le parrain avec contrôle concurrent ; parcours réel de confirmation e-mail et liens universels sur appareil à valider.
- Replays : liste des vidéos existantes non expirées, lecture native, partage et liste des temps forts. Creation, edition et suppression personnelles ajoutees ; montage et conversion des temps forts en shorts a terminer.
- **Le live du site source est lui-même incomplet** : `src/pages/LiveWatch.tsx` crée un `demo-stream` avec un compteur simulé ; `LiveBroadcast.tsx` enregistre avec `MediaRecorder` puis dépose le replay. Il n’existe pas dans ces fichiers de transport vidéo en direct à porter. Aucun compteur fictif n’a été repris. Une vraie diffusion nécessite un service serveur à choisir/configurer et un émetteur natif.

## Domaines encore absents

Compléments administratifs indiqués ci-dessus, collaborateurs des Pages Pro, certains classements et quotas du matching, véritable diffusion en direct, compléments des replays, édition des Shorts publiés et parcours premium/abonnements. Les guides géographiques internationaux existants sont maintenant portés ; voir la matrice de parité pour leur couverture exacte.

Les alias existants qui correspondent à un écran réellement présent utilisent des redirections **internes natives**. Les autres routes affichent l’écran natif de page introuvable ; elles ne sont pas remplacées par une WebView.

## Vérifications réalisées

- TypeScript : contrôle réussi après les écrans natifs et adaptateurs.
- Tests : 8 tests de stockage/validation, 35 tests du cycle de vie des appels et 7 tests d’autorisation des clubs, 6 tests du contenu/échappement du CV, 4 tests de calcul de distance et 5 tests de structure native ont réussi (65 au total).
- Vérification structurelle : absence de WebView, Capacitor, directive DOM et balises HTML dans les interfaces.
- Export Expo : bundles iOS, Android et web générés avec succès, y compris les imports natifs WebRTC, les écrans clubs/admin et les Pages Pro.
- Prébuild : dossiers iOS/Android générés avec les déclarations de permissions et plugins.
- Aperçu web à 390 pixels : fil et navigation inspectés, annuaire chargé avec 20 531 lignes ; saisie successive « Troyes » puis 11 résultats et ouverture d’une fiche.

Un export JavaScript réussi ne valide ni la compilation Swift/Kotlin ni le fonctionnement de WebRTC sur appareil. Xcode complet et Java ne sont pas disponibles sur ce Mac. Aucune archive iOS, APK, soumission App Store/Play Store n’a été produite.

Les parcours qui écrivent sur le serveur ne sont pas déclarés validés. Ils doivent être testés avec des comptes de recette, idéalement sur un projet Supabase de test. Les politiques RLS et fonctions du backend existant restent l’autorité pour les permissions.

## Suite de la migration

1. Terminer la parité des profils, messages, publications/shorts et opportunités ; vérifier les limites d’usage et les droits dans chaque mutation.
2. Migrer les espaces clubs, les pages professionnelles, la carrière, les lives et le contenu éditorial restant à partir des sources existantes.
3. Compiler les development builds et valider les modules natifs, OAuth, sessions et tous les parcours avec deux appareils.
4. Configurer et déployer séparément les dépendances distantes des appels/push, puis préparer les signatures et la distribution.

## Corrections serveur appliquées le 8 septembre 2026

- `20260908010000_native_access_recursion` : suppression des récursions RLS des groupes et Pages Pro, conservation des espaces privés, impossibilité de rejoindre un groupe privé ou de s’auto-promouvoir administrateur. Tests SQL dans une base PostgreSQL jetable, contrôle anonyme en transaction avant commit, puis contrôle REST et aperçu Pages Pro réussis.
- `20260908011000_native_profile_workflows` : colonne de parrainage sans modification massive des profils existants, demandes de vérification, stockage privé des justificatifs, permissions et RPC de décision atomique. Protection des champs administrateur et badge vérifié. Tests SQL : propriétaire, tiers, visiteur, administrateur, documents référencés non modifiables, annulation intégrale d’une décision en cas d’échec. Le premier essai a été annulé automatiquement par un contrôle des permissions ; la version corrigée a ensuite été appliquée avec succès.
- QR du profil en SVG natif et partage du lien existant ; matching entre profils adapté au schéma réel, suggestions paginées et exclusion des blocages. Les extensions `target_type` / `user1_type` du matching clubs ne sont pas présentes sur le serveur : les cartes clubs restent consultables et les intérêts clubs ne sont pas encore activés.
- L’historique des migrations n’était pas suffisant pour connaître l’état réel : plusieurs versions y figuraient alors que leurs tables/colonnes étaient absentes. Les contrôles utilisent désormais aussi le schéma effectif.
- `scripts/check-backend.mjs` effectue des requêtes avec zéro ligne retournée. Un refus anonyme sur les tables privées des appels/vérifications est attendu et ne valide pas, à lui seul, les parcours authentifiés.

### Complément football et démarrage — 8 septembre 2026

- Écrans natifs des cinq compétitions reliés à la fonction `standings`. Lecture réelle de Ligue 1 vérifiée : 18 équipes, saison fournie par le backend affichée explicitement.
- Fiche `/actu/:id` reliée aux tables existantes : source, partage, réactions et commentaires paginés. Les écritures ne sont pas testées en production.
- Restauration initiale de session corrigée : elle ne supprime plus les requêtes déjà montées.
- Schémas actualités, suivi de club et parrainage vérifiés ; formulaire de vérification accessible après migration. Les colonnes de matching clubs manquent toujours, le mode profils conserve le schéma existant.

- Contrôles de lecture dans l’aperçu : fiche d’actualité, compteurs de réactions, champ de commentaire avec saisie séquentielle puis effacement, QR de profil. Aucun commentaire, réaction ou document de test n’a été envoyé.
- `npm test` : 65 tests réussis. TypeScript, formatage et contrôle des composants natifs réussis. Le délai des tests qui démarrent Node a été porté à 20 secondes pour ce Mac chargé, sans changer leurs assertions.
- `expo prebuild --no-install` a régénéré les dossiers iOS/Android après ajout du sélecteur de documents. La compilation native reste non effectuée : Xcode complet et Java ne sont pas installés.

- Aperçu du classement contrôlé à 390 × 844 : cartes et statistiques lisibles ; largeur d’aperçu restaurée ensuite. Parrainage : compteur et création du lien chargent sans erreur, aucune création déclenchée.

- Export final après les corrections de session et de commentaire : iOS, Android et web réussis (`npm run export:all -- --max-workers 2`). Il s’agit de bundles JavaScript/Hermes, pas d’archives IPA/APK. Sources synchronisées dans `mobile-expo` du projet d’origine.

### Inscription et parrainage — 8 septembre 2026

- Code facultatif dans l’inscription, lien source redirigé vers le formulaire natif, référence conservée dans les métadonnées de compte. Après connexion immédiate ou confirmation, attribution sur l’écran parrainage avec retour clair et possibilité de réessayer. Aucun compte de test créé.
- Contrôles contre l’auto-parrainage, les codes inconnus et le remplacement d’un parrain déjà attribué ; mise à jour conditionnelle `referred_by IS NULL`.
- Échange PKCE partagé entre le navigateur système et la route de retour pour éviter de consommer deux fois le même code. Les erreurs peuvent être retentées ; la mémorisation est bornée et limitée à deux minutes.
- 72 tests réussis (5 nouveaux tests de parrainage, 2 tests de double retour OAuth), TypeScript et formatage validés. Redirection et préremplissage du code contrôlés dans l’aperçu, sans soumettre d’inscription. Les retours OAuth/e-mail restent à tester sur appareil.

### Demandes de représentation de club — 8 septembre 2026

- Nouvelle demande native accessible depuis une fiche club et depuis Mon espace. Recherche paginée dans l’annuaire FFF, filtre département, coordonnées, fonction, numéro FFF à 8 chiffres et message.
- Choix facultatif des photos recto/verso, 5 Mo par photo ; envoi uniquement lors de la soumission via la fonction existante `club-claim-upload`. Les chemins restent internes au stockage, sans URL publique affichée. Identifiant stable pour la reprise après une réponse réseau incertaine.
- Historique personnel paginé : club, statut, date et note administrative. L’historique vide charge correctement sur le compte de l’aperçu. Aucune revendication ni pièce d’identité de test envoyée.
- L’édition d’une demande existante et sa revue administrative native restent à reprendre. Les politiques actuelles du serveur autorisent la création et la lecture personnelles, mais pas l’édition par le demandeur ; aucun faux bouton d’édition ajouté.

- Recherche Annecy, sélection du club et historique personnel vérifiés dans l’aperçu. 72 tests réussis ; TypeScript et structure native revérifiés après conservation du bon type MIME pour les photos JPG/PNG/WebP. Les envois réels et la sélection de photos sur appareil ne sont pas encore validés.

### Recherche de membres — 8 septembre 2026

- Découverte : recherche sur nom, pseudo, club et ville ; rôles et départements repris du site, filtres réinitialisables. Recherche serveur également activée dans les relations et invitations via le RPC existant.
- Profils bloqués dans les deux sens et suspensions actives masqués dans les résultats Découvrir, profil courant exclu. La pagination conserve la taille brute de la page pour poursuivre après des résultats masqués.
- TypeScript, structure native et formatage validés. Lecture des résultats Joueur pro et recherche par ville « Chambéry » contrôlées dans l’aperçu. Trois requêtes sans retour de données ont vérifié auprès de PostgREST le traitement des guillemets, virgules, parenthèses et caractères de recherche spéciaux. Aucun changement de relation ni blocage de test effectué.
- L’export précédent (inscription et demandes de club) s’est terminé sur iOS, Android et web. Les derniers filtres de réseau sont validés par TypeScript et l’aperçu, pas encore par un nouvel export.

### Groupes personnels — 8 septembre 2026

- Vues Découvrir, Mes groupes et Créés par moi, recherche par nom et pagination. Les groupes privés sont accessibles dans les vues personnelles sous contrôle des règles serveur existantes. Les groupes créés restent retrouvables même si l’insertion de la première adhésion avait échoué.
- La requête Mes groupes filtre les adhésions de la personne connectée par jointure ; aucune liste d’identifiants tronquée côté client. Les adhésions mettent déjà à jour le cache de toutes les vues de groupes.
- TypeScript, contrôle des composants natifs et formatage validés. Vues publiques et personnelles chargées sans erreur dans l’aperçu (aucun groupe sur ce compte). Aucun groupe ni adhésion de test créé. La visibilité avec de vraies adhésions privées reste à vérifier sur appareil.

### Fiabilite des groupes et choix de profil - 8 septembre 2026

- Rejoindre/quitter relit la session, le role, la confidentialite et l adhesion. Une nouvelle tentative conserve son intention et ne repete pas une mutation deja appliquee. La suppression compare aussi le role dans SQL.
- Les compteurs natifs lisent le nombre reel d adhesions. Les RPC historiques restent appeles apres confirmation pour compatibilite avec le site. Les jointures ont ete acceptees par le serveur lors de requetes sans retour de donnees.
- 75 tests reussis, dont trois nouveaux tests de repetition, promotion concurrente et confidentialite. Aucun changement d adhesion effectue en production.
- Profil : choix du site pour role, departement, genre, niveau, secteur entreprise et type/niveau institution. Les anciennes valeurs restent preservees tant que l utilisateur ne les modifie pas. TypeScript, structure native et formatage valides.

### Date de naissance native - 8 septembre 2026

- Selecteur de date systeme sur iOS/Android, sans heure, avec limite a la date du jour et effacement facultatif. Le formulaire web conserve une saisie AAAA-MM-JJ.
- Validation stricte des jours du calendrier et des annees bissextiles : les dates impossibles ne sont plus acceptees par normalisation automatique de JavaScript. La valeur utilise le calendrier local pour eviter un decalage de jour.
- 77 tests reussis, TypeScript et structure native valides. Interaction avec le selecteur systeme sur appareil encore a verifier.

### Profils organisations et liens - 8 septembre 2026

- Informations de club, entreprise et institution affichees dans le profil natif : presentation, secteur/type/niveau, adresse, telephone et e-mail publics du profil, site web pour clubs et entreprises. Libelles repris des options du site.
- Les sites sans schema utilisent HTTPS. Les liens executables et les URL contenant des identifiants sont refuses. Validation des sites et e-mails professionnels avant enregistrement.
- 79 tests reussis apres nettoyage de l export incomplet ; TypeScript et structure native valides. Le premier lancement des tests et la sauvegarde de l export ont echoue avec ENOSPC. Le dossier dist-native incomplet a ete supprime ; aucun export final de cette version n est valide. Environ 135 Mio restaient disponibles au dernier controle.

### Reprise apres saturation disque - 8 septembre 2026

- `npm cache verify` a elimine 405 entrees inutilisees (448804357 octets), sans supprimer de sources ni de dependances installees. Environ 310 Mio disponibles avant la nouvelle tentative d export.
- Aucun compte Expo authentifie dans la configuration locale. Les archives installables via EAS necessitent une connexion au compte du proprietaire ; compilation locale toujours impossible sans Xcode complet et Java/SDK Android.

### Rendu conditionnel natif - 8 septembre 2026

- La lecture du profil public Unity Football a revele un avertissement React Native sur les champs vides. Correction de 235 conditions JSX dans 60 fichiers : les conditions hors Text produisent un booleen au lieu de laisser passer une chaine vide ou zero.
- Ajout du controle scripts/native-conditions.cjs et d un test de regression. Le profil public recharge sans nouvel avertissement ; les anciennes entrees du journal restent datees avant le correctif.
- La reprise d export avant ce correctif a reussi sur iOS, Android et web. La version contenant ces corrections de rendu doit encore etre exportee.

### Navigation dans les temps forts - 8 septembre 2026

- Les temps forts permettent de positionner le lecteur et de lancer la lecture, avec retour visuel en haut de page. Un lien ?t=secondes positionne aussi le replay, sans lecture automatique a l ouverture. Le partage d un temps fort conserve ce temps dans le lien.
- Le lecteur attend son etat pret, limite la position a la duree connue et ne demarre pas une lecture demandee si l ecran a perdu le focus ou si l application est en arriere-plan.
- 82 tests reussis avant ajout du bouton de partage ; les tests de temps de lecture ont ensuite ete relances pour les valeurs extremes. Aucun replay public actif n a ete renvoye par la verification anonyme de lecture du backend ; le positionnement du lecteur reste a valider sur appareil avec une video.

### Isolation au changement de compte - 8 septembre 2026

- Les ecrans et leurs formulaires sont recrees lors du changement d identifiant utilisateur, apres nettoyage du cache. Un renouvellement de jeton pour le meme utilisateur conserve les ecrans ouverts.
- Les requetes de profil deja en cours sont invalidees immediatement au changement de compte, avant le rechargement differe de la session.
- 84 tests reussis, TypeScript, structure native et formatage valides. Deux nouveaux tests couvrent la recreation des observateurs du cache et une reponse tardive apres changement de compte. Ces tests ne remplacent pas un parcours complet connexion/deconnexion sur appareil.
- Le profil public Unity Football se recharge correctement dans l apercu apres le correctif. Aucun changement de compte effectue avec la session existante.
- Export final de cette version reussi pour Android, iOS et web, incluant les corrections de rendu, les temps forts et l isolation des comptes. Il s agit des bundles Expo ; aucune archive APK/IPA compilee ni verification sur telephone a ce stade. Journal d erreurs de l apercu vide apres rechargement.

### Revue des demandes de club - 8 septembre 2026

- Route native /admin-club-claims depuis l administration : statuts, recherche par demandeur, pages de 20, detail, liens club/profil, justificatifs prives par lien signe de 60 secondes, note visible par le demandeur et confirmation explicite.
- Migration 20260908012000_native_club_claim_review installee apres relecture du schema distant : approbation, attribution du role, rattachement des profils club et verification de la fiche officielle dans la meme transaction. Le refus conserve aussi auteur, date et note. Une reponse reseau incertaine peut etre retentee sans ecraser la premiere decision ; les modifications concurrentes sont controlees par updated_at.
- Tests SQL en PostgreSQL jetable passes : refus au demandeur et aux tiers, statut invalide, date perimee, repetition, decision opposee, conservation des metadonnees et annulation integrale sur echec de la derniere ecriture. Permissions anonymes refusees aussi sur le serveur distant (401 / 42501).
- TypeScript, structure native et formatage valides. Le compte de l apercu est refuse par le controle administrateur. Aucun justificatif ouvert, aucune demande reelle approuvee ou refusee. Le parcours complet avec un compte administrateur sur appareil reste a verifier.
- Export Expo de cet ecran et de ses dependances termine avec succes sur Android, iOS et web ; aucune archive installable produite.

### Edition des temps forts - 8 septembre 2026

- Creation au temps courant du lecteur, saisie minutes:secondes, types du site, equipe, joueur, titre et description facultatifs. Edition et suppression limitees a l auteur, avec confirmation pour la suppression. Les videos restent conservees.
- Relecture de la session et de la disponibilite du replay avant mutation. Edition/suppression comparent tous les champs modifiables, car la table ne possede pas de revision updated_at. La creation utilise un identifiant stable et verifie le contenu deja enregistre lors d une reprise.
- Le lecteur emet la progression uniquement quand demandee ; le formulaire valide le temps avant la fin connue de la video et dans les limites de la colonne SQL. 87 tests passes, dont trois nouveaux tests du format, des depassements et de la duree ; TypeScript et structure native valides.
- Aucune ecriture de temps fort effectuee sur les donnees reelles. Le parcours de lecture et edition sur appareil avec une video reste a valider ; notifications du reseau et conversion en shorts non reprises dans cette etape.
- Exports Android, iOS et web reussis. La liste des replays charge sans erreur dans l apercu, mais ne renvoie actuellement aucune video ; le formulaire n a donc pas ete valide avec un replay reel.

### Associations des contenus Pro - 8 septembre 2026

- Selecteur natif d equipe pour un match et de match pour un media, avec recherche et pages de 20. Les choix sont limites a la Page Pro courante ; une association existante est affichee meme hors de la premiere page de resultats et peut etre effacee explicitement.
- Relecture de la session, du proprietaire et de l appartenance de l element associe avant enregistrement. Les champs sont desactives pendant la mutation, y compris les selecteurs de date natifs et web.
- La page publique affiche l equipe associee au match et le match associe au media. Deux requetes sans retour de donnees ont valide ces jointures aupres du serveur (HTTP 200). Aucun contenu reel modifie.
- TypeScript, structure native, formatage et exports Expo Android/iOS/web valides. Mes Pages Pro charge correctement dans l apercu, mais ce compte ne possede aucune page ; selection et enregistrement sur contenu reel et sur appareil restent a verifier.

### Enregistrements Pro fiables - 8 septembre 2026

- Correction de la creation des publications Pro : author_id, obligatoire sans valeur par defaut dans le schema, est maintenant fourni avec l utilisateur authentifie. Les medias conservent uploader_id.
- Identifiant stable a la creation, verification du contenu lors d une reprise apres reponse reseau incertaine ; aucun remplacement silencieux si le meme identifiant contient deja un autre texte ou media. Comparaison des dates normalisees pour les reponses PostgreSQL.
- Edition et suppression comparent updated_at pour les tables qui disposent du declencheur correspondant ; les medias comparent leurs champs et leur match associe. Le formulaire garde sa reference initiale lors des rechargements en arriere-plan et change d identite avec la route. Un conflit propose explicitement d abandonner les changements et de recharger.
- 91 tests passes, dont quatre nouveaux tests de l attribution de l auteur, de reprise, de contenu different et de normalisation des dates/listes de medias. Aucun enregistrement reel teste en production ; la couverture des tests ne constitue pas un essai complet de l editeur sur appareil.
- TypeScript, structure native et formatage valides apres les derniers changements ; exports Expo Android, iOS et web termines avec succes. Sources synchronisees dans mobile-expo.

### Photos des contenus Pro - 8 septembre 2026

- Verification distante : le bucket pro-pages utilise par les logos et couvertures etait absent. Migration 20260908013000_native_pro_media testee puis installee : images publiques, limite de 10 Mo et cinq types MIME image, droits d ecriture limites au prefixe de l utilisateur. Des politiques restrictives empechent les anciennes politiques permissives d elargir ces droits.
- Tests PostgreSQL jetables passes : lecture publique, refus anonyme des ecritures, ajout/remplacement/suppression par le proprietaire, refus des chemins et fichiers d autres utilisateurs, conservation du comportement des autres buckets.
- Photos natives pour les publications (selection multiple), medias photo, miniatures, logos d equipes/adversaires et photos de joueurs. Apercu local, retrait de la selection et envoi a l enregistrement. Les liens existants restent disponibles. Les envois confirmes sont reutilises pendant une reprise du formulaire ; les echecs reseau incertains ne declenchent pas de suppression automatique de fichiers.
- Logos et couvertures corriges pour utiliser le prefixe du proprietaire. Aucun fichier reel envoye. Les choix depuis la phototheque et les enregistrements avec images sur appareil restent a valider ; le televersement de videos n est pas ajoute dans cette etape.
- TypeScript, structure native et formatage valides ; exports Expo Android, iOS et web termines avec succes. Le test SQL a aussi verifie le remplacement autorise du fichier par son proprietaire.

### Validation des formulaires Pro - 8 septembre 2026

- Validation commune avant les envois de photos : scores/ numeros entiers dans les limites SQL, distinction entre champ vide et zero, choix connus, booleens reels, e-mails et liens publics valides. Les textes conservent leur mise en forme et leurs sauts de ligne.
- Dates de matchs/evenements controlees contre les jours impossibles et les heures hors limites, avec fuseau explicite pour la saisie web. Les dates de naissance refusent les jours inexistants et les dates futures ; selecteur natif repris pour les joueurs.
- 97 tests passes, dont six nouveaux tests des limites numeriques, calendriers, dates de naissance, liens, choix/booleens et e-mails. Aucun contenu reel modifie ; les essais des formulaires sur appareil restent a effectuer.
- Les six tests de validation ont ete relances apres clarification des erreurs de liens. TypeScript, formatage et exports Expo Android/iOS/web reussis ; sources synchronisees dans mobile-expo.

### Validation officielle des Pages Pro - 8 septembre 2026

- Demande native pour les clubs officiels lies a une fiche, message facultatif, statut et retour administratif visibles au proprietaire. Certification approuvee affichee sur la page. Session/propriete relues avant mutation et comparaison de updated_at pour les changements simultanes.
- Les reprises d une demande deja en attente et les pages deja approuvees ne changent pas le statut. Trois tests couvrent premier envoi, nouvelle demande apres refus, reprises et eligibilite.
- Le site source presente encore Gerer les membres comme un bouton desactive Bientot (ProPageSettingsPanel.tsx). Les politiques serveur actuelles accordent la gestion du contenu au proprietaire, pas aux roles editor/analyst. L activation des collaborateurs necessitera donc aussi un workflow et des droits serveur a concevoir, pas seulement le portage d un formulaire existant.
- Aucun envoi reel de demande de validation. Parcours avec un compte proprietaire et revue administrative native encore a verifier. L autorite serveur sur les champs de certification Pro doit aussi etre auditee : les anciennes politiques permettent largement les mises a jour du proprietaire.
- 100 tests passes au total, TypeScript, structure native et formatage valides ; exports Expo Android/iOS/web termines avec succes et sources synchronisees.

### Autorite et revue des certifications Pro - 8 septembre 2026

- Schema distant relu : les mises a jour du proprietaire n etaient pas filtrees par champ. Migration 20260908014000_native_pro_authority installee apres tests : certification, mise en avant et decision administrative protegees ; proprietaire limite a ses demandes, date de demande fournie par le serveur.
- RPC administrateur review_pro_page avec verrou, comparaison updated_at, decision/date/auteur/note dans une seule mise a jour et reprise sans ecrasement de la premiere decision. Lecture des pages privees accordee aux administrateurs pour la revue. Les roles serveur de maintenance restent compatibles.
- Changement du club lie ou du type de page : remise a draft de la validation precedente et effacement de ses metadonnees de revue. Avertissement affiche avant l enregistrement dans l editeur natif.
- Route /admin-pro-validation depuis l administration : statuts, pagination, message du proprietaire, club lie, affiliation, note de decision et confirmation. La relation serveur est vers clubs, pas fff_clubs ; le controle REST a detecte puis valide la correction (HTTP 200). Aucun lien vers une fausse fiche FFF conserve.
- Tests SQL jetables passes pour auto-certification/notes interdites, demandes, statut perime, reprises, refus/nouvelle demande, changement d identite, lecture privee et maintenance serveur. RPC anonyme refuse en production (401 / 42501) ; compte de l apercu refuse par la garde administrateur.
- Aucune page reelle modifiee et aucune decision de test en production. Le parcours administrateur sur appareil reste a valider. La confidentialite en lecture des champs de demande sur les pages publiees reste a auditer separement des droits de modification.
- TypeScript, structure native, formatage et exports finaux Android/iOS/web passes apres correction de la relation clubs. Sources et migration synchronisees dans le projet d origine.


### Confidentialite des messages Pro - 8 septembre 2026

- Audit des permissions et compteurs uniquement : aucune Page Pro presente au moment du controle, donc aucun message reel consulte ou deplace. Les anciennes colonnes auraient ete lisibles avec les pages publiques.
- Migration 20260908015000_native_pro_review_privacy installee : messages de demande et notes administratives dans pro_page_review_details, lecture reservee au proprietaire et aux administrateurs. Les colonnes publiques restent nulles ; les anciennes ecritures sont capturees dans la meme transaction pour conserver la compatibilite. Effacement explicite et changement d identite du club traites.
- Tests PostgreSQL jetables passes : reprise des anciennes donnees de fixture, masquage public, lecture autorisee, refus des ecritures directes et des fausses decisions, creation avec relation differee, revue administrative et remise a zero. Aucun contenu reel cree ou modifie.
- Application native adaptee aux relations privees, y compris la consultation administrative des pages non publiees. Les deux controles REST sans retour de donnees repondent HTTP 200.
- 103 tests passes (8 tests coeur et 95 Vitest), TypeScript, structure native et formatage valides. Artefacts Android/iOS presents avec la relation privee et toutes leurs ressources ; le code web exporte contient egalement cette relation. Aucune archive APK/IPA ni validation sur appareil.
- Le hook du site original src/hooks/useProPages.ts a ete adapte aux relations privees et a l identite du compte dans les cles de cache. Cette modification du site n est pas deployee. Son controle TypeScript global signale des erreurs dans d autres fichiers, aucune dans ce hook ; cela ne constitue pas une validation globale du site.


### Fidelite des formulaires et fiches Pro - 8 septembre 2026

- Comparaison directe avec les gestionnaires du site : les nouvelles publications sont maintenant publiees par defaut et les nouveaux matchs a domicile. Une valeur explicite false deja enregistree reste conservee dans l editeur ; les autres interrupteurs restent desactives par defaut.
- Les fiches de matchs affichent statut traduit, domicile/exterieur, competition, journee et notes. Les scores distinguent domicile/exterieur et affichent aussi un score partiel renseigne uniquement pour l equipe exterieure. Les publications evenement affichent leur date et leur lieu.
- TypeScript, controle de structure native et formatage passes. Aucun contenu reel cree pour ces verifications ; validation visuelle avec des contenus Pro et sur appareil encore necessaire.
- Exports Expo Android, iOS et web termines avec succes pour cette version. Sources synchronisees dans mobile-expo ; aucune archive installable produite.


### Acces aux medias et diffusions Pro - 8 septembre 2026

- Liens de diffusion et de resume video accessibles depuis les fiches de match. Ouverture externe limitee aux adresses HTTP(S) valides, avec etat de chargement et erreur recuperable.
- Les publications reconnaissent les extensions video mp4/m4v/mov/webm/m3u8 dans le chemin de l URL, y compris avec parametres de signature, et utilisent NativeVideo. Les autres medias gardent un apercu image avec repli en cas d erreur. Un bouton permet toujours d ouvrir le lien ; aucune WebView ajoutee. Les medias sans extension ne sont pas identifies automatiquement comme videos.
- Les evenements ayant seulement un lieu, sans date, affichent maintenant aussi ce lieu. Aucun contenu reel modifie.
- TypeScript et structure native valides. La lecture de ces medias sur telephone reste a verifier avec des contenus reels ; les liens de diffusion ne constituent pas un service de streaming heberge par l application.
- Formatage et exports Expo Android/iOS/web reussis. Sources synchronisees dans mobile-expo ; aucune compilation APK/IPA effectuee.


### Consultation des effectifs Pro - 8 septembre 2026

- La route d effectif est accessible aux visiteurs pour les pages publiees, conformement aux droits de lecture serveur existants. La requete verifie l appartenance de l equipe a la page indiquee ; une page non publiee reste reservee ici a son proprietaire. Aucun droit serveur elargi.
- Ajout et modification visibles uniquement pour le proprietaire ; leurs formulaires conservent le controle de session/propriete avant chaque mutation. Pagination de 30, nom d equipe, photos et nationalites affiches avec les noms, numeros, postes et roles du staff.
- Jointure equipe/page verifiee sans donnees renvoyees : HTTP 200. TypeScript et structure native passes. Aucun joueur ni equipe reel cree ou modifie ; parcours avec un effectif existant et sur appareil encore a valider.
- Les liens de presentation de la Page Pro utilisent aussi le bouton avec validation HTTP(S) et retour d erreur, a la place d une ouverture sans gestion d echec.
- Formatage et exports Expo Android/iOS/web reussis ; sources synchronisees. Aucune archive installable generee.


### Recherche de clubs et centres indoor - 8 septembre 2026

- Recherche etendue au nom, au nom abrege et a la ville, avec caracteres speciaux cites et jokers SQL echappes. Filtres Tous / Clubs / Indoor-futsal et remise a zero depuis l annuaire natif. La recherche utilisee dans la demande de club beneficie aussi des trois champs.
- Classification indoor reprise des mots-cles du site (five, soccer, urban, foot indoor, futsal), sans la presenter comme une certification du type d etablissement. Inclusion et exclusion executees cote serveur avant pagination et comptage ; le filtre Clubs ne compte donc pas seulement les resultats de la page courante.
- Quatre requetes REST sans donnees ont valide les filtres simples, combines et avec ponctuation speciale (HTTP 200). L apercu charge les nouveaux champs et affiche 20 531 resultats au moment du controle. Aucun club modifie.
- TypeScript et structure native passes. Les modes carte/proximite et niveau restent a reprendre ; cette etape ne constitue pas une parite integrale de l annuaire.
- Comptages serveur verifies sans lignes retournees : 19 646 clubs et 885 noms indoor, soit les 20 531 entrees du total. Formatage et exports Expo Android/iOS/web reussis ; sources synchronisees. Aucune archive installable produite.


### Informations publiques des clubs - 8 septembre 2026

- Fiche completee avec logo, code postal, fondation, niveau, presentation, histoire, disciplines et installations lorsque ces champs sont renseignes. Les valeurs proviennent de fff_clubs ; aucun contenu invente ni modification des donnees.
- Coordonnees copiables et boutons telephone/e-mail ouvrant les applications du telephone, avec erreur visible si l ouverture echoue. Aucun appel ni message lance pendant les verifications. Le site internet et l itineraire utilisent le bouton de lien valide avec retour d erreur.
- TypeScript et structure native passes. Ouvertures telephone/e-mail sur appareil encore a verifier.
- Apercu de Monfoot5 Annecy verifie : adresse complete, telephone et bouton de contact presents, sans appel effectue. Formatage et exports Expo Android/iOS/web reussis ; sources synchronisees. Aucune archive installable produite.


### Autorisation serveur de modification des clubs - 8 septembre 2026

- Source de update-club-info telechargee depuis le projet distant : la version 3 controlait la connexion mais utilisait ensuite le client service sans verifier le role sur le club. Correctif ajoute avant toute ecriture : appel is_club_admin avec le JWT du demandeur verifie, refus sur erreur ou resultat autre que true. Les administrateurs du site restent pris en charge par cette politique existante.
- Cinq tests isoles du handler reel transpile passes : utilisateur absent, role refuse, resultat null, erreur du controle et role autorise. Les quatre refus ne declenchent aucune ecriture ; le cas autorise utilise uniquement un client simule. Aucun club reel modifie pour tester.
- Source corrigee conservee dans backend/functions et dans le projet original. Le controle des modifications concurrentes et la validation complete des formulaires ClubInformation restent a terminer ; cette etape traite l autorisation serveur prioritaire.
- Correctif deploye sur FootNation puis source distante retelechargee et comparee a l identique. Requete anonyme refusee HTTP 401. Aucun changement du bundle mobile dans cette etape serveur.


### Validation des informations de club - 8 septembre 2026

- Validation du nom obligatoire, des liens HTTP(S), des e-mails, telephones et dates de fondation avant mutation. Une date inexistante ou future est refusee ; les champs facultatifs peuvent etre effaces et les presentations conservent leurs sauts de ligne.
- Champs desactives pendant l enregistrement, claviers adaptes aux coordonnees et indication du format de date. L identite du formulaire inclut le club pour ne pas reutiliser les valeurs d une autre fiche.
- Quatre tests de validation passes, TypeScript et structure native valides. Aucun enregistrement reel effectue. La protection atomique contre les modifications simultanees reste a implementer ; les ecritures directes de presentation/contact restent aussi a verifier face aux droits serveur actuels.
- Audit des politiques distantes confirme : fff_clubs ne possede actuellement qu une politique SELECT publique, aucune politique UPDATE. Les formulaires presentation/contact utilisant une mise a jour directe ne disposent donc pas du chemin serveur necessaire. Prochaine correction requise : les faire passer par une operation serveur autorisee, avec controle de concurrence, sans elargir les droits de toute la table.
- Formatage et exports Expo Android/iOS/web reussis pour la validation des formulaires. Sources synchronisees ; cela ne valide pas les enregistrements presentation/contact encore a corriger.


### Enregistrement serveur des informations de club - 8 septembre 2026

- update-club-info etendu puis deploye pour les sections infos/about/contact, avec liste ferme de champs, validation serveur et controle du role via le JWT du demandeur. Les ecritures natives de presentation/contact ne passent plus par les UPDATE directs refuses par RLS.
- Les requetes natives transmettent les valeurs initiales de chaque champ de la section. La meme requete SQL UPDATE compare ces valeurs, y compris null, avant modification ; absence de ligne correspondante renvoie 409. Le formulaire garde sa reference independante des refetchs et la remplace seulement par la reponse confirmee. Un echec propose d abandonner les changements et de recharger ; les champs sont bloques pendant ce rechargement.
- Les nouvelles requetes ne modifient pas le type du club. Le payload historique du site pour l identite reste accepte sans exiger de reference initiale ; il ne beneficie donc pas du controle de concurrence natif. Les autres champs non autorises ne sont jamais transmis a la mise a jour.
- 16 tests isoles du handler reel transpile passes : refus d acces, erreur de permission, validation, trois sections, champs supplementaires ignores, conservation du type, conflit, effacement null et enregistrement suivant avec nouvelle reference. Pas de donnees reelles modifiees ; cette couverture simule le client SQL et ne remplace pas un essai complet avec deux administrateurs sur appareil.
- TypeScript et structure native passes. Source distante retelechargee pour comparaison avec le correctif local ; la gestion des demandes reseau incertaines retourne un conflit lors d une reprise avec une ancienne reference, sans ecrasement silencieux.
- Formatage et exports Expo Android/iOS/web termines avec succes ; sources synchronisees. Aucune archive installable ni ecriture de club en production pour les tests.


### Enregistrement des statuts administratifs de club - 8 septembre 2026

- Migration 20260908016000_native_club_status installee : RPC limite aux deux cles metadata.is_verified et metadata.is_suspended, avec autorisation is_site_admin dans la transaction, verrou de ligne, comparaison de la valeur initiale et conservation de toutes les autres metadonnees. Aucune politique UPDATE generale ajoutee.
- Interrupteurs natifs branches sur cette operation ; un conflit permet d actualiser. Les administrateurs de club sans role site restent en lecture seule. La colonne fff_clubs.is_verified distincte n est pas modifiee ici : cette correction conserve le modele des interrupteurs existants et ne pretend pas implementer a elle seule tous les effets d une suspension.
- Tests PostgreSQL jetables passes : refus du non-administrateur, cle inconnue, valeur null, club absent, conflit, reprise identique, deux statuts independants et metadonnees conservees. Privileges anonymes refuses dans le test et sur le serveur (HTTP 401). Aucun statut de club reel modifie.
- TypeScript et structure native passes ; parcours avec un administrateur FootNation sur appareil encore a valider.
- Formatage et exports Expo Android/iOS/web reussis. Sources et migration synchronisees dans le projet original ; aucune archive installable produite.


### Equipe principale et appartenances - 8 septembre 2026

- Migration 20260908017000_native_primary_team installee : autorisation is_club_admin, verrou du profil et des affectations du club, validation du rattachement du membre et de l equipe active, comparaison de l ancienne equipe principale. Les operations natives sont serialisees pour ce profil.
- Changer d equipe principale demote l ancienne affectation sans la supprimer, promeut une equipe secondaire existante ou reactive son ancienne ligne sans perdre role, numero et metadonnees. Une nouvelle appartenance utilise les valeurs par defaut du schema pour son statut. Aucune equipe principale efface seulement la designation, sans retirer les appartenances.
- Un seul appel serveur transactionnel remplace les ecritures directes et les retours sans effet. Reprise identique sans nouvel ajout, conflit explicite et refus des donnees comportant deja plusieurs equipes principales. Leur reparation manuelle reste a traiter ; cette operation ne modifie pas les anciens clients qui ecrivent directement dans team_members.
- Les choix de l editeur conservent la reference initiale pendant les refetchs ; boutons et puces sont desactives pendant la mutation. Les puces communes exposent maintenant aussi leur etat desactive a l accessibilite.
- Tests PostgreSQL jetables passes : refus d acces, promotion, retrait de designation, reprise, conflit, equipe inactive, mauvais club, reactivation et rollback apres echec de la derniere ecriture. RPC anonyme refuse sur le serveur (HTTP 401). Aucun membre reel reaffecte.
- TypeScript et structure native valides. Parcours complet avec administrateur et effectifs reels sur appareil encore a verifier.
- Formatage et exports Expo Android/iOS/web reussis. Sources et migration synchronisees dans le projet original ; aucune archive installable produite.


### Validation des contenus administratifs et audit de schema - 8 septembre 2026

- Validation commune des scores/annees entiers dans les limites SQL, dates calendaires avec fuseau, statuts connus et liens de shorts. Un score blanc devient null et reste distinct de zero. Les paragraphes des articles sont conserves. Champs, choix et dates bloques pendant enregistrement.
- Trois tests de regression passent pour scores vides/zero/depassement, dates impossibles/statuts et liens/paragraphes. TypeScript et structure native passes.
- Audit REST sans donnees de toutes les rubriques : staff, equipes, convocations, matchs, publications et shorts acceptent leurs colonnes. club_achievements, attendance et competitions sont absentes. club_news manque title/excerpt/published_at ; le formulaire conserve ces champs presents dans le site, donc une migration de parite et des droits d ecriture restent indispensables avant de declarer la creation d actualites fonctionnelle. Le schema inspecte ne comporte qu une politique de lecture des actualites publiees.
- La liste club_chat_groups utilise maintenant name/group_type/team_category/updated_at, au lieu des champs inexistants de messages/compteurs. La requete corrigee revele ensuite un autre blocage serveur HTTP 500 / 42P17 : recursion infinie dans la politique de club_chat_groups. Sa correction RLS reste necessaire ; la messagerie interne n est pas consideree fonctionnelle.
- Les actualites sont triees par created_at, disposent du champ is_pinned existant et attribuent author_id lors de la creation. Aucun article, message ou autre contenu reel cree/modifie dans cette etape.
- Formatage et exports finaux Expo Android/iOS/web reussis. Sources synchronisees ; ces exports ne valident pas les rubriques bloquees par le schema ou les politiques serveur.


### Schema et droits des actualites de club - 8 septembre 2026

- Audit distant confirme les colonnes manquantes et la seule politique SELECT des articles publies. Migration 20260908018000_native_club_news installee : title/excerpt/published_at ajoutes comme champs facultatifs pour conserver les articles existants sans inventer de titre ou de date.
- Politiques de gestion reservees aux utilisateurs authentifies reconnus par is_club_admin pour le club de chaque ligne. Lecture des brouillons accordee aux administrateurs, creation/edition/suppression autorisees dans leur club, deplacement vers un autre club non administre refuse. La lecture publique existante reste limitee aux actualites publiees.
- Tests PostgreSQL jetables passes : conservation du contenu anterieur, brouillons caches aux anonymes et tiers, refus des ecritures anonymes/tiers, CRUD administrateur, controle du club destination et administrateur du site. Aucune actualite reelle creee, modifiee ou supprimee.
- Verification REST des champs editoriaux apres installation : HTTP 200 sans ligne retournee. Sources et migration synchronisees ; aucun changement de bundle mobile requis dans cette etape serveur. Le parcours complet d edition sur appareil reste a verifier.
- Les blocages de messagerie interne (recursion RLS) et les trois autres rubriques aux tables absentes restent ouverts.


### Acces aux groupes de discussion des clubs - 8 septembre 2026

- Audit des politiques distantes uniquement, sans lecture de messages : boucle groupes/membres et comparaison erronee m.group_id=m.id dans la politique de lecture des groupes confirmees.
- Migration 20260908019000_native_club_chat_access installee : deux fonctions booleennes SECURITY DEFINER avec search_path vide et utilisateur authentifie requis. Les politiques de lecture et gestion des appartenances les utilisent pour eviter la recursion. Le groupe est compare au group_id de l appartenance du demandeur.
- Roles existants conserves via is_fff_club_admin : administration du club/site pour les groupes et leurs appartenances ; messages toujours reserves aux membres selon les politiques existantes. Un administrateur non membre ne recoit pas un acces implicite aux messages. Aucun elargissement des autres politiques de messages, signalements ou lectures.
- Tests PostgreSQL jetables passes : lecture du groupe et messages par le membre, refus anonyme/tiers, refus d inscription autonome et d envoi dans un autre groupe, gestion admin dans son club, refus de deplacement vers un autre club et retrait effectif des acces apres suppression d appartenance.
- Apres deploiement, club_chat_groups, club_chat_group_members et club_chat_messages repondent HTTP 200 aux requetes sans donnees, au lieu de l erreur 42P17. Aucun message ni groupe reel cree ou modifie. Sources et migration synchronisees ; aucun changement du bundle mobile necessaire dans cette etape serveur.
- Ce correctif leve le blocage RLS ; l ecran natif d echange dans les groupes de clubs et sa validation sur appareil restent a terminer, la rubrique administrative actuelle listant les groupes en lecture seule.


### Conversations natives de club - 8 septembre 2026

- Routes /club-chat et /club-chat/[id], accessibles depuis Messages et la liste administrative. Liste paginee des groupes dont le compte est membre, avec club et categorie. Un administrateur non membre n obtient pas implicitement la conversation.
- Conversation native : messages recents en bas, pagination de 30, auteur/date, textes selectionnables et ouverture des pieces jointes existantes. Les contenus supprimes ou bloques sont masques dans l interface. Rafraichissement manuel et toutes les 15 secondes quand l ecran est actif au premier plan.
- Saisie multiligne, clavier iOS gere, limite de 4 000 caracteres et bouton bloque pendant l envoi. Session et appartenance relues avant insert. Identifiant stable et relecture avant reprise via le helper d enregistrement existant ; une reprise avec un contenu different deja enregistre est refusee.
- TypeScript et structure native passes ; les deux jointures de groupes/auteurs acceptent les requetes sans donnees (HTTP 200). L apercu affiche correctement la liste vide de ce compte. Aucun message reel consulte ou envoye.
- Cette etape couvre lecture et envoi texte ; reponses a un message, edition/suppression, envoi de pieces jointes, gestion native des membres/groupes, accuses de lecture et signalements restent a completer. Envoi et lecture avec un groupe reel sur appareil non verifies.
- Refus d une discussion inaccessible verifie dans l apercu, sans composeur affiche. Formatage et exports Expo Android/iOS/web reussis ; sources synchronisees. Aucune archive installable produite.


### Palmares du club - 8 septembre 2026

- Le formulaire du site confirme club_achievements comme table attendue, absente du serveur. Migration 20260908020000_native_club_achievements installee : champs titre/competition/annee/categorie/description, cle vers fff_clubs, lecture publique et gestion limitee aux administrateurs du club via is_club_admin. Les titres et competitions vides et annees hors 0..9999 sont refuses.
- Les donnees existantes dans fff_clubs.achievements ne sont ni deplacees ni effacees. La fiche native affiche leurs titres textuels, ainsi que les entrees de la nouvelle table avec pagination de 30. Aucun titre invente ; section masquee si aucune donnee n existe.
- Formulaire pre-rempli avec l annee courante pour un nouvel element, validation de la borne serveur et invalidation de la fiche publique apres enregistrement/suppression.
- Tests PostgreSQL jetables passes : lecture publique, CRUD administrateur, refus tiers/anonymes, limite du club destination, champs et annee valides, conservation des titres historiques. Requete REST de tous les champs acceptee apres installation (HTTP 200, aucune ligne retournee). Aucun palmares reel cree ou modifie.
- TypeScript et structure native valides ; parcours d ecriture avec un administrateur sur appareil encore a verifier. Les rubriques presences et competitions restent a raccorder a leur schema reel.
- Trois tests de validation passes apres ajout de la borne d annee. Apercu du club sans titre verifie sans erreur ni section vide ; formatage et exports Expo Android/iOS/web reussis. Sources et migration synchronisees.


### Consultation des presences - 8 septembre 2026

- La rubrique native n utilise plus la table attendance inexistante. Ecran dedie branche sur club_attendance_records, club_attendance_sessions et club_players, avec controle is_fff_club_admin correspondant aux politiques reelles. Aucun droit serveur elargi.
- Recherche par nom de joueur, filtres present/absent/late/excused/injured, tri par date de seance et pagination de 30. Compteurs exacts par statut sur toute la recherche, independants de la page chargee. Les erreurs de comptage restent visibles au lieu d afficher zero par defaut.
- Affichage du type et de la date de seance, du joueur, de la categorie et des notes. La categorie n est pas presentee comme un nom d equipe, absent du schema des seances. Aucun statut pending invente : les donnees existantes utilisent cinq autres statuts.
- Jointures, filtre du club/recherche et tri relationnel verifies sans donnees renvoyees (HTTP 200). TypeScript et structure native valides. Aucun relevé reel consulte ou modifie ; le controle sur un compte administrateur et sur appareil reste a faire. Cette rubrique est en consultation, comme le panneau du site examine ; saisie de nouvelles seances et pointage non ajoutes dans cette etape.
- Refus du compte non administrateur verifie dans l apercu. Formatage et exports Expo Android/iOS/web reussis ; sources synchronisees. Aucune archive installable produite.


### Consultation des competitions - 8 septembre 2026

- La rubrique native ne pointe plus vers competitions, absente. Ecran dedie aux tables existantes club_competitions et club_competition_standings, avec recherche nom/categorie citee et caracteres SQL echappes, pagination de 20 et comptage serveur.
- Nom, type championnat/coupe/amical/tournoi, categorie, saison, niveau, dates et lien externe affiches selon les donnees renseignees. Le nombre affiche correspond aux equipes enregistrees au classement ; aucun statut d avancement invente a partir de colonnes absentes.
- Classement depliable et pagine par 30 : rang, equipe, points, matchs, victoires/nuls/defaites, buts et date de mise a jour. Equipe du club reperee ; valeurs manquantes distinguees de zero. La requete du classement verifie aussi le club de la competition.
- Les deux jointures repondent HTTP 200 sans donnees retournees. TypeScript et structure native passes ; aucun resultat sportif reel modifie. Creation/edition de competitions et saisie de classements non ajoutees dans cette etape de consultation, le bouton Nouveau du panneau source examine etant sans action.
- La validation avec un compte administrateur et des competitions renseignees sur appareil reste a effectuer.
- Suite complete : 110 tests passes (8 coeur, 102 Vitest), formatage et exports Expo Android/iOS/web reussis. Sources synchronisees ; aucune archive installable produite.

### Edition native des competitions et classements - 8 septembre 2026

- Ajout de la creation, modification et suppression des competitions avec nom/type/categorie/saison/niveau/site et dates. Selecteurs de calendrier natifs iOS/Android ; validation stricte des dates, y compris futures, et de leur ordre. Suppression confirmee avec mention explicite du classement supprime en cascade.
- Ajout de la saisie des equipes au classement : rang, matchs, victoires/nuls/defaites, buts, points et marqueur Notre equipe. Valeurs inconnues conservees en NULL, zero distingue ; entiers PostgreSQL verifies, rang positif, statistiques non negatives et points negatifs acceptes pour les penalites. Aucun calcul impose des points selon un bareme unique. Date de mise a jour renseignee lors des editions natives.
- Controles de session fraiche et is_fff_club_admin avant les mutations, conformes aux politiques existantes. Competition et club verifies avant une ecriture de classement. UUID de creation stable et lecture avant insertion pour une reprise sans doublon. Edition/suppression compare tous les champs du formulaire a leur valeur initiale dans la requete ; conflit visible au lieu d ecraser les modifications. Actualisation du classement disponible pour reprendre apres un conflit. Aucun droit serveur modifie ni resultat sportif reel saisi pendant les controles.
- Suite complete : 116 tests passes (8 coeur, 108 Vitest), dont trois nouveaux tests de dates/competition et trois de statistiques/classement. TypeScript passe. Les parcours d ecriture avec compte administrateur sur appareil restent a verifier ; exports Expo distincts d archives installables.
- Formatage, garde de structure native et exports Expo Android/iOS/web reussis. Refus d acces du compte non administrateur confirme dans l apercu de la rubrique competitions. Sources synchronisees vers mobile-expo ; aucune archive APK/IPA produite.

### Actions sur ses messages de club - 8 septembre 2026

- Modification native du texte et suppression logique confirmee pour l auteur d un message disponible. Suppression vide le texte et retire le lien media de la ligne ; ne supprime pas physiquement le fichier du stockage. Mention Modifie et conservation de la date d envoi.
- Session et appartenance au groupe reverifiees avant mutation. Requete limitee a l auteur, au groupe et a l identifiant ; compare le contenu, le media, edited_at et is_deleted du debut d edition, avec is_blocked=false. Refus visible en cas de modification concurrente. Etat initial fige pendant l edition malgre le rafraichissement periodique.
- Validation de texte commune a l envoi et a l edition (non vide, 4000 caracteres) ; deux tests limites/formatage. L erreur de lecture ne presente plus une conversation comme vide.
- Les politiques serveur existantes ne sont pas elargies. La politique generale Authors edit messages permet deja les UPDATE de l auteur ; son durcissement global des champs de moderation reste a auditer separement. Ces controles natifs ne constituent pas une nouvelle protection serveur contre un client modifie.
- Aucun message reel envoye, modifie ou supprime pendant les verifications. Parcours d ecriture avec un membre sur appareil restant a tester.
- TypeScript, structure native, formatage, 118 tests (8 coeur, 110 Vitest) et exports Expo Android/iOS/web reussis. Liste des discussions verifiee dans l apercu avec son etat vide pour le compte courant. Sources synchronisees dans mobile-expo ; aucune archive installable creee.

### Integrite serveur des messages de club - 8 septembre 2026

- Audit distant confirme : trois politiques sur club_chat_messages, dont Authors edit messages autorisant auparavant tous les champs de la ligne de l auteur ; aucun trigger applicatif preexistant. Schema et droits examines sans lire de messages.
- Migration 20260908021000_native_club_chat_integrity deployee et journalisee atomiquement sur FootNation. Trigger INSERT/UPDATE en securite invocateur : auteur et appartenance actuelle requis, champs de moderation reserves, identite/groupe/date d envoi/reponse immuables apres creation. Seuls contenu, media, edited_at et is_deleted restent modifiables par l auteur. Un message deja bloque ou supprime ne peut plus etre modifie par le client.
- Creation d une reponse limitee au meme groupe. Controle applique aux nouvelles reponses, sans empecher la suppression d anciennes donnees incoherentes. Roles serveur postgres/service_role/supabase_admin preserves explicitement ; aucune autorisation ajoutee aux administrateurs de club et aucune politique de lecture elargie.
- Tests PostgreSQL jetables passes : edition normale, suppression logique, falsification des champs reserves/identifiant/auteur/date/groupe, injection de moderation a l insertion, reponse dans le meme groupe et refus intergroupe, moderation serveur, refus de debloquer/restaurer, acces apres retrait du groupe. Premier test de changement de date corrige pour changer effectivement la valeur dans la transaction ; suite finale reussie.
- Aucune ligne de message existante reecrite par la migration, aucun message reel envoye/modifie/supprime en test. Cette etape renforce aussi les appels directs au serveur ; elle complete les controles natifs ajoutes precedemment. Les essais sur appareil restent a realiser.
- Verification apres deploiement : trigger present, requete REST des champs natifs HTTP 200 avec zero ligne demandee/retournee. Migration copiee dans le projet source et fichiers synchronises dans mobile-expo. Aucun changement du code Expo dans cette etape serveur ; exports precedents non relances.

### Reponses dans les discussions de club - 8 septembre 2026

- Ajout du bouton Repondre sur les messages disponibles, selection du parent dans le composeur et annulation sans perdre le brouillon. reply_to_id envoye et relu pour recuperer une insertion confirmee apres une perte de reponse ; une reprise avec un autre parent est refusee.
- Apercus des messages d origine, y compris hors des pages deja chargees : references dedupliquees et lues par lots de 50 avec filtre group_id et RLS existante. Cache separe par utilisateur et groupe, invalide avec les messages lors du polling, d une edition ou d une suppression. Les erreurs de lecture des references sont distinguees d un message absent.
- Les apercus masquent les messages supprimes/bloques ; un statut indisponible deja charge dans la conversation masque aussi une reference encore en cache. Verification fraiche du parent avant une nouvelle insertion ; la protection serveur deployee precedemment impose le meme groupe. Aucun texte cite duplique dans le contenu enregistre.
- Trois tests sur les apercus et chargements par lots, plus un test de reprise d insertion avec changement de parent. Aucun message reel envoye. Le schema REST de references est verifie sans lecture de contenu. Parcours d ecriture avec compte membre sur appareil restant a tester.
- TypeScript, formatage, structure native et 122 tests passes (8 coeur, 114 Vitest). Requete REST HTTP 200 avec zero ligne retournee. Exports Expo Android/iOS/web reussis ; sources synchronisees dans mobile-expo. Aucune archive installable produite.

### Formulaire de signalement des messages de club - 8 septembre 2026

- Formulaire natif sur les messages disponibles d autres membres : motifs contenu inapproprie/harcelement/spam/autre, precisions facultatives limitees a 3000 caracteres, annulation et confirmation d enregistrement. Aucun blocage automatique annonce.
- Session fraiche et lecture du message dans le groupe sous RLS avant une nouvelle insertion dans club_chat_message_reports. UUID stable pendant la vie du formulaire et lecture du signalement du declarant avant insertion pour les reprises apres reponse perdue. Les champs status/admin_notes/reviewed_at/reviewed_by ne sont pas fournis par le formulaire. Reprise d un signalement deja confirme possible sans reexiger la disponibilite du message.
- Deux tests de motifs, espaces, longueur et charge utile. Aucun signalement reel cree en test. L administration native actuelle ne liste que user_reports : liste/revue des signalements de club encore a raccorder. Les politiques existantes de club_chat_message_reports sont conservees ; leur insertion n impose actuellement que reporter_id=auth.uid(), et le durcissement serveur des champs de revue reste a faire.
- Cette etape permet l enregistrement en base ; elle ne prouve ni un traitement par un administrateur ni une notification. Essai du parcours sur appareil avec compte membre encore necessaire.
- TypeScript, garde native, formatage et 124 tests passes (8 coeur, 116 Vitest). Requete REST HTTP 200 sans ligne retournee, exports Expo Android/iOS/web reussis, sources synchronisees dans mobile-expo. Aucune archive installable produite.

### Administration des signalements de club - 8 septembre 2026

- Nouvel ecran admin-club-reports accessible depuis l administration FootNation : liste paginee de 30, filtres par statut, comptage serveur, consultation du motif/details et du message signale. Controle frais du compte et is_site_admin avant lecture ou traitement.
- Traitement en attente/examine/resolu/classe sans suite, note limitee a 3000 caracteres. Le formulaire indique que la note est accessible au declarant, conformement a la politique de lecture existante. Le suivi ne bloque ni ne supprime automatiquement le message ; action de moderation directe encore a ajouter. Edition avec comparaison atomique du statut/note/date/relecteur initiaux ; refus visible d une modification concurrente.
- Migration 20260908022000_native_club_report_review deployee et journalisee sur FootNation. Trigger invocateur : insertion uniquement par un membre actuel sur un message disponible d autrui, statut initial pending et champs de revue vides ; l auteur ne peut pas falsifier le traitement. Revue reservee aux administrateurs site, champs du signalement originel immuables et relecteur/date attribues par le serveur. Roles de service preserves. Aucune ligne existante reecrite.
- RPC get_native_club_report_message reservee aux administrateurs site : renvoie uniquement le message rattache a l identifiant d un signalement existant, avec auteur/groupe et etat de moderation. Aucune extension de lecture a toute une discussion pour un administrateur non membre.
- Tests PostgreSQL jetables passes : creation valide, refus du faux statut/relecteur, refus auteur/ancien membre, isolation des signalements, lecture admin du seul message signale, immutabilite du motif, attribution serveur du relecteur et refus d une mise a jour sur ancien statut. TypeScript et garde native passes. Aucun signalement reel cree ou traite en test ; parcours administrateur sur appareil restant a valider.
- Verification distante apres deploiement : trigger present, schema REST accepte avec zero ligne retournee, RPC refusee a anon (401/42501). Refus du compte non administrateur observe dans l apercu admin-club-reports. Formatage et exports Expo Android/iOS/web reussis ; migration et sources synchronisees. Aucune archive installable produite.

### Moderation des messages de club signales - 8 septembre 2026

- Ajout du blocage/deblocage explicite dans l examen administratif, avec confirmation et motif obligatoire pour bloquer. Les actions de traitement du signalement sont desactivees pendant la moderation. Actualisation du message disponible avant une nouvelle confirmation ; le formulaire conserve la version consultee au debut de l action.
- Migration 20260908023000_native_club_message_moderation preparee pour FootNation. RPC restreinte aux administrateurs site et au message rattache a un signalement existant, verrou de ligne et comparaison d empreinte de toute la ligne avant modification. Message change ou supprime refuse. Motif, auteur et date du blocage attribues cote serveur ; levee du blocage efface ces champs. Le contenu et le statut du signalement restent inchanges.
- La RPC de consultation administrative expose maintenant le motif/date de blocage et l empreinte de version. Pas d elargissement des politiques de lecture des discussions. Le blocage est un etat de moderation masque par les interfaces natives ; les politiques membres existantes ne retirent pas le contenu de la reponse REST. Ce n est ni une suppression physique ni un mecanisme de confidentialite envers un client modifie.
- Tests PostgreSQL jetables passes avec les protections messages/reporting precedentes installees : refus non administrateur, motif obligatoire, version perimee, blocage/deblocage, conservation contenu/statut, signalement inconnu et message supprime. TypeScript et garde native passes (deux conditions JSX explicitees apres le premier controle). Aucun message reel bloque/debloque pendant les tests. Validation sur appareil avec administrateur restant a realiser.
- Premier deploiement annule integralement par le garde de privileges : les privileges par defaut de la base accordaient EXECUTE a anon. Migration corrigee par REVOKE explicite de PUBLIC et anon, puis deployee/journalisee avec succes. Fixture enrichie avec ce privilege par defaut pour couvrir la regression.
- Exports Expo Android/iOS/web et formatage reussis. Migration finale copiee dans le projet source et fichiers synchronises ; aucune archive installable produite.

### Suivi personnel des signalements de club - 8 septembre 2026

- Nouvel ecran my-club-reports, accessible depuis Mon espace, la liste des discussions de club et la confirmation d enregistrement. Statuts partages avec l administration pour conserver les memes libelles.
- Liste limitee explicitement au reporter_id du compte courant, session fraiche verifiee, cache par utilisateur/statut, filtres et pagination de 30 avec compte serveur. Motif, precisions, statut, note/date de traitement et reference copiable ; aucun contenu du message signale ni identite du relecteur recuperes. Erreurs distinguees d un suivi vide.
- L enregistrement d un signalement invalide le cache du suivi personnel. Actualisation manuelle disponible ; aucune notification automatique inventee.
- Test PostgreSQL complete et passe : le declarant retrouve le statut et la note de son propre signalement meme apres son retrait du groupe, tandis que les autres membres ne peuvent pas consulter ce signalement. Cela utilise la politique existante sans nouveau droit serveur.
- TypeScript et garde native passes. Aucune donnee de signalement creee/modifiee dans la base de production ; validation sur appareil restant a effectuer.
- Requete REST HTTP 200 sans ligne retournee ; etat vide du compte courant verifie dans l apercu. Formatage et exports Expo Android/iOS/web reussis ; sources synchronisees. Environnement de compilation locale recontrole : CommandLineTools uniquement, eas/adb absents du PATH, environ 342 Mio disponibles. Aucune archive installable produite.

### Fiabilite du formulaire de profil - 8 septembre 2026

- Editeur monte apres AuthGate et isole par compte. Valeurs initialisees depuis une copie de depart ; une actualisation normale du profil en contexte ne reinitialise plus le brouillon. Rechargement explicite avec confirmation d abandon, y compris pour un profil encore inexistant. Choix du type de compte, competences et deconnexion desactives pendant l enregistrement.
- Remplacement de l upsert inconditionnel par une creation sans ecrasement ou une mise a jour comparant atomiquement les champs envoyes a leur valeur initiale. Session fraiche avant ecriture. Les tableaux de competences utilisent une representation PostgreSQL correctement echappee. Une modification concurrente presente un conflit et invite a recharger.
- Lecture avant ecriture pour reconnaitre un profil deja enregistre apres une reponse perdue. Photo televersee memorisee pour la reprise avec la meme selection ; suppression automatique du fichier sur erreur reseau retiree afin de ne pas casser une photo deja referencee par une ecriture confirmee cote serveur. Des televersements abandonnes peuvent rester sans reference ; aucun nettoyage destructeur suppose leur inutilisation.
- Trois tests de reprise avec photo, conflit de creation/edition et tableaux passes. Suite complete 127 tests (8 coeur,119 Vitest) passee, puis tests cibles repasses apres ajout du cas retour a la ligne dans les tableaux. TypeScript et garde native passes. Filtre REST des competences citees accepte (200, zero ligne retournee).
- Aucun profil ni avatar reel modifie pendant les controles. Verification d enregistrement et de reprise sur appareil encore necessaire. Le premier export a precede un dernier ajustement du rechargement d un profil absent ; un export final distinct est lance pour couvrir ce code.
- Export final Android/iOS/web reussi apres le dernier changement ; formatage valide. Formulaire pre-rempli et bouton de rechargement observes dans l apercu sans modification. Sources synchronisees dans mobile-expo ; aucune archive installable produite.

### Enregistrement de profils longs - 8 septembre 2026

- Reproduction en lecture seule : filtre bio avec 30 caracteres accepte (HTTP 200), meme requete avec 3000 caracteres accentues echoue (fetch failed). Les valeurs de comparaison placees dans l URL rendaient donc l edition d un profil long fragile.
- Migration 20260908024000_native_profile_snapshot_save : RPC avec valeurs et copie attendue dans le corps JSON. Operation en securite invocateur conservant RLS/trigger d autorite, limitee au profil auth.uid(), liste blanche des champs du formulaire et copie attendue complete exigee. Comparaison JSON atomique des valeurs, tableaux et NULL avant UPDATE ; conflits refuses. Aucun champ administratif ni identifiant de compte modifiable via cette operation.
- Le formulaire utilise cette RPC pour les profils existants ; creation sans ecrasement et reprise apres reponse perdue conservees. Suppression de la conversion des tableaux en filtres URL, devenue inutile. Type de compte invalide refuse avant enregistrement.
- Tests PostgreSQL passes sur textes Unicode longs, tableaux avec virgules/guillemets/retours a la ligne, champs NULL, conflits, copie incomplete, champ administratif interdit et isolation du compte. Base de test jetable configuree explicitement en UTF-8 apres avoir detecte que son ancien encodage SQL_ASCII comptait les octets du texte accentue ; aucun changement d encodage en production.
- Suite native complete 127 tests passee (8 coeur,119 Vitest), TypeScript et garde native valides. Aucun profil reel modifie en test ; parcours sur appareil avec compte connecte restant a effectuer.
- Migration deployee/journalisee avec controles de privileges. Requete JSON de 3000 caracteres accentues acceptee par la couche HTTP et correctement refusee a anon (401/42501), sans mutation de profil. Formatage et exports Expo Android/iOS/web reussis ; migration et sources synchronisees dans le projet source. Aucune archive installable produite.

### Edition des messages longs - 8 septembre 2026

- Les actions natives de modification/suppression des messages de club transmettent maintenant leur copie attendue dans le corps JSON, comme le formulaire de profil. Le contenu long et les liens media ne sont plus places dans les filtres URL.
- Migration 20260908025000_native_club_message_snapshot deployee/journalisee avec controles de privileges. RPC en securite invocateur, RLS et trigger d integrite conserves : message du compte auteur dans le groupe attendu, disponible et copie complete concordante. Comparaison des dates en timestamptz ; modification du texte et datation serveur ou suppression logique avec retrait du contenu/lien media. Identite et moderation non modifiables par la RPC.
- Tests PostgreSQL UTF-8 passes : 4000 caracteres accentues, texte vide/trop long refuse, conflit, copie incomplete, mauvais groupe, autre auteur, retrait du groupe, message bloque ou supprime. Privileges anonymes refuses meme avec des privileges par defaut larges.
- Requete JSON longue acceptee et refusee correctement a anon (401/42501), sans message reel modifie. TypeScript et garde native passes. Parcours sur appareil encore a verifier ; cette etape ne change pas le comportement de reprise apres une reponse d edition perdue, qui demande une actualisation en cas de conflit.
- Formatage et exports Expo Android/iOS/web reussis. Sources et migration finale synchronisees dans le projet FootNation ; aucune archive installable produite.

### Brouillon de profil et contrat des champs - 8 septembre 2026

- Etat de l editeur conserve au-dessus de son AuthGate : une erreur temporaire de verification de session masque les controles sans detruire le brouillon en memoire. Initialisation apres verification initiale, compte isole par cle utilisateur ; changement de compte/deconnexion recrée l editeur. Aucune persistance du brouillon apres fermeture de l application ajoutee.
- La confirmation Profil enregistre est reinitialisee a la prochaine saisie, selection du type de compte ou changement de photo, afin de ne pas presenter de nouvelles modifications comme deja enregistrees.
- Audit du formulaire revele institution_phone absent de la liste blanche de la RPC introduite a l etape precedente : correction via migration distincte 20260908026000_native_institution_profile_phone, deployee/journalisee. Aucun champ administratif ajoute aux droits d edition.
- Test de contrat compare les champs reels du formulaire et la derniere definition SQL de la RPC, et verifie l exclusion des champs administratifs. Test PostgreSQL confirme l edition du telephone d institution avec valeur initiale NULL et les protections precedentes. Suite complete 128 tests passee (8 coeur,120 Vitest), TypeScript et garde native passes.
- Aucun profil reel modifie en test. Simulation de perte/reprise reseau et changement de compte sur appareil restant a effectuer.
- Formatage et exports Expo Android/iOS/web reussis, sources et migration synchronisees. Aucune archive installable produite.

### Parametres sensibles du compte - 8 septembre 2026

- Ecran isole par identifiant de compte et verification auth.getUser avant changement email/mot de passe, preferences, lecture/retrait des blocages. Champs email/mots de passe desactives pendant la mutation et confirmation precedente effacee a la nouvelle saisie.
- Validation du mot de passe alignee sur inscription/reinitialisation (8 caracteres, majuscule, minuscule, chiffre et confirmation exacte). Email valide normalise, adresse deja actuelle refusee apres verification fraiche du compte.
- Changement d email avec emailRedirectTo vers auth/callback selon le meme schema Expo que l inscription. Resultat distingue changement immediat et confirmation attendue ; mention de l ancienne adresse uniquement si demandee. Aucun email reel envoye ni identifiant de connexion modifie en test.
- Actualisation de la liste des comptes bloques ajoutee ; les caches block/posts/relationship sont invalides apres un deblocage. Changement de cible desactive pendant la suppression et preferences verrouillees pendant leur actualisation.
- Deux tests de validation email/mot de passe ajoutes. La preference profile_visibility demeure un sujet distinct : la source web presente Profil public mais son utilisation trouvee se limite au stockage dans les parametres ; audit serveur complet des politiques/RPC de profils a poursuivre avant de garantir une confidentialite effective. Cette etape ne revendique pas cette garantie.
- Suite complete 130 tests passee (8 coeur,122 Vitest), TypeScript, formatage et exports Expo Android/iOS/web reussis. Aucun changement reel d email/mot de passe, preference ou blocage effectue en test ; sources synchronisees.
- Audit distant de confidentialite confirme : les trois politiques SELECT de profiles ont qual=true, et aucune fonction publique ne reference profile_visibility. Fonctions de lecture avec privileges eleves a examiner pour appliquer la visibilite : get_connection_suggestions, get_profile_connections, get_ranked_connection_suggestions ; conserver les exceptions administratives explicites et les helpers d autorite necessaires. Le script backend/audit-profile-visibility.py ne lit que les metadonnees. La preference seule ne rend pas un profil prive dans l etat serveur actuel ; correctif serveur encore necessaire.

### Visibilite effective des profils - 8 septembre 2026

- Apres audit des metadonnees et des trois fonctions de reseau, ajout de la migration 20260908027000_native_profile_visibility. Question de preference posee ; faute de reponse pendant l analyse, choix restrictif annonce : profile_visibility=false limite la lecture au titulaire et aux administrateurs FootNation, sans exception automatique pour les relations acceptees.
- Politique SELECT restrictive ajoutee sur profiles, combinable avec les politiques existantes. Helper booleen en contexte protege lit la preference sans recursion ; preference absente/NULL conserve le comportement public. Les proprietaires conservent la lecture/edition de leur profil et les administrateurs leur acces.
- Trois RPC adaptees : get_connection_suggestions, get_ranked_connection_suggestions et get_profile_connections filtrent les profils selon le lecteur reel. Recommandations limitees au contexte du compte demandeur ou d un administrateur, reseau d un profil prive inaccessible aux tiers, demandes pending/sent reservees au compte concerne ou a l administration. Tables qualifiees et search_path vide. Controle des empreintes des definitions auditees avant deploiement, transaction journalisee.
- Reglage natif precise la portee : profil uniquement, publications selon leur propre visibilite. Invalidation des donnees apres changement. Lectures de profil en cache par compte et gestion explicite d un resultat absent/prive, y compris QR ; aucun faux profil generique ni erreur de cardinalite presente a sa place.
- Tests PostgreSQL : public par defaut, anonyme/membre prive refuse, proprietaire et administrateur autorises, profils publics toujours presents dans les recommandations, absence de profils prives dans recommandations/reseau, demandes entrantes d autrui interdites, publication du profil reactive par son titulaire. Tests ajoutent explicitement le cas auth.uid() NULL pour le reseau prive.
- Migration deployee et verifiee par metadonnees ; requetes REST sans lignes et RPC anonymes de recommandations renvoient 200 avec zero resultat. Aucun profil/preference reel modifie pour tester. Profil inexistant verifie dans l apercu avec le message Profil indisponible. Les contenus deja partages, copies locales ou medias publics ne sont pas effaces par ce reglage.
- Suite complete 130 tests passee (8 coeur,122 Vitest), TypeScript, garde native, formatage et exports finaux Expo Android/iOS/web reussis. Migration et sources synchronisees. Aucune archive installable produite ; essai sur appareil avec plusieurs comptes restant a faire.

### Confidentialite des blocages et signalements de profils - 8 septembre 2026

- Audit distant confirme les politiques Public read access=true sur user_blocks et user_reports. Migration 20260908028000_native_personal_safety_privacy deployee/journalisee : politiques SELECT restrictives, signalements visibles seulement au declarant et aux administrateurs site ; blocages visibles aux deux comptes concernes et aux administrateurs, pour conserver la detection reciproque utilisee par le fil et le reseau.
- Les comptes bloques/signales ne peuvent pas retirer une action creee par autrui. Droit DELETE administratif ajoute uniquement aux signalements de profil, conformement a l action deja presente dans SiteAdmin ; aucun droit supplementaire de suppression des blocages d autrui.
- Tests PostgreSQL jetables passes avec des donnees non vides : anonymes et tiers sans lecture, proprietaire autorise, compte signale sans acces au signalement, detection inverse du blocage preservee, identites de creation protegees, suppression administrative des signalements et suppression de ses propres elements.
- Verifications post-deploiement : politiques presentes, deux lectures anonymes limitees a un identifiant renvoient HTTP 200 et zero ligne. Aucun blocage/signalement reel cree, lu dans son contenu ou supprime. Sources et migration synchronisees ; aucun changement Expo dans cette etape serveur, donc pas de nouvel export ni archive installable.

### Reprise des signalements et intention de blocage - 8 septembre 2026

- Formulaire de signalement isole par compte et profil cible, verification fraiche de session avant chaque action, refus de se signaler/bloquer soi-meme. Motifs valides et precisions limitees a 3000 caracteres ; champs verrouilles pendant l envoi et apres confirmation. Identifiant stable pendant la vie du formulaire et relecture de son propre signalement avant reprise pour eviter un doublon apres une reponse perdue.
- Blocage/deblocage explicite avec confirmation et actualisation de l etat. Une reprise de blocage ne se transforme pas en deblocage ; suppression conditionnee a l identifiant initial pour preserver un blocage remplace sur un autre appareil. Erreurs de lecture et suppression refusee affichees, caches de blocage/fil/reseau invalides apres succes.
- Trois tests de reprise/concurrence ajoutes : insertion enregistree avec reponse perdue, blocage remplace, suppression deja effectuee ou refusee. Suite complete 133 tests passee (8 coeur,125 Vitest), TypeScript, garde native et formatage passes. Aucun signalement ou blocage reel cree/supprime en test ; essais sur appareils restant a effectuer.
- Exports Expo Android/iOS/web reussis et sources synchronisees dans le projet FootNation. Aucune archive installable produite.

### Reprise de creation dans l administration des clubs - 8 septembre 2026

- Formulaire generique ClubRecordEditor : identifiant de creation stable et relecture ciblee des champs envoyes avant reprise, via createProContent. Date de premiere publication stable pendant la vie du formulaire ; comparaison des dates meeting_date/published_at independante de la representation PostgreSQL du fuseau. Un contenu different sous le meme identifiant produit un conflit explicite. Aucun brouillon persistant apres fermeture de l ecran ajoute.
- Ecran de listes/edition isole par compte dans sa cle React et ses requetes. Verification fraiche auth.getUser et correspondance avec le compte initial avant creation, modification ou suppression, puis verification des droits administrateur du club. Pendant une suppression, ajout/modification/autres suppressions et annulation desactives.
- Test ajoute pour les dates de convocation/publication relues au format PostgreSQL. Suite complete 134 tests passee (8 coeur,126 Vitest), TypeScript et garde native passes. Aucun element reel de club cree/modifie/supprime en test.
- Limite encore presente : edition/suppression des elements generiques ne compare pas atomiquement tous les champs initiaux. Une RPC en corps JSON reste a ajouter pour proteger les longs textes contre les modifications concurrentes ; aucune garantie correspondante revendiquee a cette etape.
- Formatage et exports Expo Android/iOS/web reussis ; sources synchronisees dans mobile-expo du projet FootNation. Aucune archive installable produite.

### Comparaison atomique des elements de club - 8 septembre 2026

- Migration 20260908029000_native_club_record_snapshot deployee/journalisee apres audit des colonnes et de la RLS des huit tables. RPC en securite invocateur avec search_path vide, compte authentifie et is_club_admin obligatoires ; politiques des tables toujours appliquees. Tables/colonnes modifiables strictement choisies par section, identites/auteurs/indicateurs officiels exclus.
- Edition et suppression natives transmettent la copie complete chargee par select(*) dans le corps JSON. Comparaison atomique apres conversion aux types PostgreSQL, notamment dates/fuseaux et tableaux ; une difference ou une ligne inaccessible renvoie un conflit. Copie incomplete et champs inconnus refuses. La comparaison comprend aussi les compteurs et autres colonnes non editees : une activite concurrente sur ces champs peut demander une actualisation.
- Confirmation de suppression conserve sa copie initiale, meme si la liste change. Bouton Actualiser la liste ajoute, annulant la confirmation precedente. Une reprise apres reponse perdue d edition/suppression peut demander une actualisation ; aucune fusion automatique ni effacement force.
- Tests PostgreSQL jetables passes : 8000 caracteres accentues et retour ligne, dates equivalentes, tableaux/NULL, copies perimees en edition et suppression, copie incomplete, champs proteges, section invalide, autre club, RLS refusee meme avec helper administrateur positif, suppression concordante et edition equipe. Test de contrat couvre tous les champs des huit formulaires et exclut les champs reserves.
- Suite complete 135 tests passee (8 coeur,127 Vitest), TypeScript, garde native et formatage passes. Verification distante de la migration, securite invocateur et privileges ; corps JSON long recu et refuse correctement a anon (401/42501). Aucun contenu reel de club modifie/supprime en test. Essais multi-appareils restant a effectuer.
- Exports Expo Android/iOS/web reussis ; migration et sources synchronisees dans le projet FootNation. Aucune archive installable produite.

### Creation native des seances de presence - 8 septembre 2026

- Comparaison avec AttendanceSection du site : lecture d une ancienne table attendance, bouton Modifier sans gestionnaire et aucun formulaire de creation. Audit distant confirme la table club_attendance_sessions, ses champs, ses quatre types autorises et les politiques is_fff_club_admin existantes ; aucun nouveau droit serveur ajoute.
- Liste native paginee de seances, date/type/categorie/notes et actualisation. Creation d entrainement, match, reunion ou autre seance avec DateField natif iOS/Android, date valide obligatoire et champs facultatifs bornes. Identifiant stable et relecture des champs de creation pour reprendre apres reponse perdue, y compris dates serialisees par PostgreSQL.
- Verification fraiche du compte et des droits de presence avant lecture des seances et creation. Ecran isole par compte ; champs/annulation verrouilles pendant creation. Retour de formulaire expose seulement apres fin de mutation.
- Acces depuis chaque seance aux releves et compteurs filtres par session_id ; retour a toutes les seances conserve. Aucune presence automatiquement inventee lors de la creation. La saisie du pointage des joueurs, ainsi que l edition/suppression de seance, restent a implementer.
- Deux tests de validation/reprise ajoutes. Suite complete 137 tests passee (8 coeur,129 Vitest), TypeScript et garde native passes. Aucun entrainement/match/seance ni relevé reel cree pour tester. Essais sur appareils restant a effectuer.
- Formatage et exports Expo Android/iOS/web reussis ; sources synchronisees dans le projet FootNation. Aucune archive installable produite.

### Pointage natif des joueurs - 8 septembre 2026

- Audit distant des tables club_players/club_attendance_records : unicite session_id/player_id deja presente, mais absence de controle du club du joueur lors d une ecriture autorisee par la seance. Aucun contenu de pointage lu pendant cet audit de metadonnees.
- Migration 20260908030000_native_attendance_record_write deployee/journalisee : trigger en securite invocateur impose joueur du meme club, administrateur FFF, statut reconnu, notes bornees, identite de pointage immuable a l edition. Roles serveur de maintenance existants conserves. RPC invocateur cree ou modifie un pointage avec comparaison de la copie attendue sous verrou de ligne ; aucune politique de lecture/ecriture elargie.
- Identifiant stable pour la creation ; reprise reconnaissant la meme ligne et les valeurs deja enregistrees apres une reponse perdue. Un autre identifiant existant, une copie perimee ou un pointage supprime demande une actualisation. Unicite SQL protege les creations concurrentes.
- Depuis les releves d une seance : recherche paginee des joueurs du club, choix explicite parmi present/absent/retard/excuse/blesse, notes facultatives, chargement du pointage existant avant edition. Verification fraiche du compte et des droits, session rattachee au club, brouillon isole par compte/seance/joueur et commandes verrouillees pendant sauvegarde. Joueurs inactifs etiquetes et disponibles pour historique. Actualisation des releves/compteurs apres succes.
- Tests PostgreSQL jetables passes : creation/reprise sans doublon, edition/reprise, copie perimee/incomplete, 3000 caracteres Unicode, notes trop longues, statut invalide, joueur d autre club via RPC et INSERT direct, date de creation immuable et non-administrateur refuse. Suite complete 137 tests applicatifs passee (8 coeur,129 Vitest), TypeScript et garde native passes. Aucun pointage reel cree/modifie en test.
- Premiere transaction de deploiement annulee par une erreur de nom de fonction dans le controle post-installation ; nom corrige dans le lanceur puis transaction appliquee avec succes. Aucun deploiement partiel conserve. Saisie en lot, suppression d un pointage et edition/suppression de seance restent a ajouter ; essais sur appareils toujours necessaires.
- Verification distante : trigger et migration presents, RPC en securite invocateur avec search_path vide, execution anonyme refusee et authentifiee autorisee ; requete HTTP anonyme longue refusee (401/42501). Formatage et exports Expo Android/iOS/web reussis, sources et migration synchronisees. Aucune archive installable produite.

### Correction de seance et suppression de pointage - 8 septembre 2026

- Liste des seances charge sa copie complete et propose Modifier la seance. Formulaire natif partage avec creation, pre-rempli, validation date/type/categorie/notes existante, verification fraiche du compte et des droits. Edition limitee aux informations de seance ; identite et auteur conserves, aucun pointage supprime ou modifie.
- Pointage existant : suppression explicite avec confirmation, mention de l abandon des changements non enregistres, actions concurrentes desactivees pendant mutation. Suppression conditionnee au pointage initial, session, joueur, statut et notes ; une modification intervenue ailleurs provoque un conflit. Releves et compteurs invalides apres succes.
- Migration 20260908031000_native_attendance_corrections deployee/journalisee avec controle des huit colonnes de seance, RLS active et privileges. Deux RPC en securite invocateur, search_path vide, administrateur FFF obligatoire, copies completes et concordantes, parametres JSON pour les notes longues. Une reprise apres reponse perdue peut demander une actualisation en cas de copie perimee ou suppression deja effectuee.
- Tests PostgreSQL jetables passes : modification de seance conserve les releves, date equivalemment serialisee et notes Unicode, copie perimee/incomplete, champs reserves, suppression perimee/incomplete, autre administrateur refuse, suppression concordante conserve la seance. Les tests du pointage precedent sont aussi rejoues dans cette fixture.
- Suite complete 137 tests passee (8 coeur,129 Vitest), TypeScript, garde native et formatage passes. Deux requetes HTTP anonymes avec notes longues refusees (401/42501), aucun pointage/seance reel modifie ou supprime en test. Suppression d une seance complete et pointage en lot non ajoutes ; essais sur appareils restent requis.
- Exports Expo Android/iOS/web reussis, migration et sources synchronisees dans le projet FootNation. Aucune archive installable produite.

### Fiabilisation des invitations et acces administrateurs - 8 septembre 2026

- ClubPeople isole par compte/club/section, cache par compte et recherche temporisee. requireClubAdmin accepte un identifiant de compte attendu et verifie auth.getUser avant la verification de droits ; comportement historique conserve pour les autres appelants ne transmettant pas cet argument.
- Confirmation capture identifiant stable de creation et role propose. Reprise d une invitation encore pending creee par cette confirmation ou d une nomination via createProContent sans nouvelle insertion ; refus explicite si demande deja traitee ou autre invitation existante. Profil cible relu avant nouvelle invitation pour verifier acces et appartenance actuelle. Notification demeure separee avec message explicite en cas d echec.
- Annulation d invitation conditionnee au statut pending dans la requete DELETE ; absence de ligne traitee comme changement demandant actualisation. La suppression ne retire plus une demande passee a un statut traite entre affichage et confirmation. Protection existante contre retrait de son propre acces administrateur conservee.
- Actions, role et changement de mode verrouilles pendant mutation ; actualisation explicite ajoutee, confirmation annulee au changement de mode/recherche. La liste des administrateurs ne fait plus de jointure interne supprimant les lignes dont le profil est prive ; donnees de profil masquees restent masquees selon RLS.
- Deux tests de verification d identite ajoutes : compte attendu confirme, changement de compte ou erreur auth bloque avant interrogation des droits. Suite complete 139 tests passee (8 coeur,131 Vitest), TypeScript, garde native et formatage passes. Aucun membre invite, notification envoyee, invitation supprimee ni acces administrateur reel modifie en test.
- Limites : renouvellement d une ancienne demande traitee non ajoute (message explicite conserve l historique), protection serveur contre retraits simultanes des derniers administrateurs a auditer, aucun envoi reel sur appareil effectue.
- Exports Expo Android/iOS/web reussis et sources synchronisees dans le projet FootNation. Aucune archive installable produite.

### Integrite des acces administrateurs de club - 8 septembre 2026

- Audit distant : cinq politiques club_admins, aucune garde d integrite ; is_club_admin inclut certains roles staff actifs, tandis que is_fff_club_admin correspond aux lignes club_admins et au drapeau administrateur site. La gestion native des acces exige maintenant cette seconde autorite, en plus de l identite verifiee ; invitations ordinaires conservent leur regle precedente.
- Migration 20260908032000_native_club_admin_integrity deployee/journalisee : politiques INSERT/UPDATE/DELETE alignees sur is_fff_club_admin et trigger protege avec search_path vide, non appelable directement par anon/authenticated. Verrou transactionnel par club puis verification fraiche de l autorite, identite de ligne immuable, retrait de son propre acces refuse, dernier administrateur conserve. Politiques de lecture conservees. Les roles serveur de maintenance conservent leur capacite existante, notamment pour les cascades lors de suppression de compte.
- Migration distincte 20260908033000_native_club_admin_nonnull deployee/journalisee apres controle d empreinte de la fonction precedente : lignes sans profil non comptees comme administrateurs valides, creation sans profil refusee pour les comptes applicatifs ; retrait d une ancienne ligne incomplete reste possible. Aucun acces reel cree/retire pendant cette verification.
- Tests PostgreSQL jetables passes : retrait personnel interdit, remplacement d identite interdit, role editable, ancien administrateur sans retour de droits, administrateur site capable de nommer, dernier compte protege meme en presence d une ligne NULL et nettoyage de cette ligne autorise. Test avec deux connexions PostgreSQL en Read Committed : premier retrait maintenu en transaction, second retrait attend puis refuse car son auteur a perdu l autorite ; un administrateur demeure.
- Verification distante des deux migrations, trois politiques, trigger, search_path vide et absence de droit d appel direct. Suite complete 139 tests applicatifs passee (8 coeur,131 Vitest), TypeScript, garde native, formatage et exports Expo Android/iOS/web reussis. Migrations et sources synchronisees dans FootNation. Aucune archive installable produite ni test de retraits reels sur appareil effectue.

### Reponses aux invitations de club - 8 septembre 2026

- Audit distant identifie accept_club_membership_request SECURITY DEFINER sans verification auth.uid, sans controle du destinataire/statut, avec EXECUTE anonyme autorise. Migration 20260908034000_native_membership_response deployee/journalisee apres verification d empreinte de cette definition : appel authentifie, invitation du compte courant verrouillee, acceptation pending uniquement, retour sans reapplication pour une invitation deja acceptee. Search_path vide et droit anonyme retire.
- Trigger d integrite des demandes : creation par administrateur du club avec son propre invited_by, statut pending et aucune reponse pre-remplie ; refus par le destinataire seulement si encore pending, statut rejected et date serveur. Identite, club, role propose et auteur non modifiables directement. Acceptation passe par la RPC et conserve la mise a jour du rattachement/role de profil du site original.
- Ecran MemberSpace isole par compte et section, verification fraiche d identite avant lecture/reponse, confirmation explicite et explication du remplacement de rattachement lors d une acceptation. Refus conditionne a pending ; reprise d un refus deja enregistre reconnue sans reecriture. Rechargement du profil et invalidation des listes apres succes, actualisation manuelle et controles verrouilles pendant mutation.
- Tests PostgreSQL jetables : acceptation du destinataire, reprise sans doublon ni reapplication apres changement de club ulterieur, autre compte/anonyme refuses, role propose protege, acceptation directe interdite, refus terminal protege, auteur d invitation non falsifiable et creation legitime conservee. Aucun profil/invitation reel modifie en test. Requete HTTP anonyme vers la RPC refusee (401/42501).
- Suite complete 139 tests applicatifs passee (8 coeur,131 Vitest), TypeScript et garde native passes apres correction de la condition d affichage de confirmation. Audit revele aussi que club_convocation_players.player_id reference club_players et non profiles, avec acces actuellement reserve aux administrateurs : la consultation/reponse du membre pour les convocations reste a corriger dans une etape distincte.
- Formatage et exports finaux Expo Android/iOS/web reussis ; migration et sources synchronisees dans le projet FootNation. Aucune archive installable produite.

### Convocations accessibles au membre concerne - 8 septembre 2026

- Correction du lien utilisateur : club_convocation_players.player_id reference club_players.id, dont profile_id identifie le compte. Ancienne comparaison directe avec auth.uid supprimee du parcours membre. Migration 20260908035000_native_member_convocations deployee/journalisee apres controles de relation et RLS.
- RPC de lecture authentifiee, paginee 1 a 30, limitee aux fiches joueurs liees au compte courant et au meme club que la convocation. Expose seulement identifiant/statut/date de reponse et renseignements du rendez-vous ; notes internes de la ligne joueur non exposees. Politiques administratives existantes conservees.
- RPC de reponse authentifiee limitee au membre concerne, accepte seulement accepted/declined, date serveur et comparaison de statut/date attendus sous verrou de ligne. Reprise avec resultat deja enregistre reconnue. Statuts injured/absent geres par le club ne peuvent pas etre remplaces par cette RPC. UI masque les boutons correspondants et oriente vers un responsable.
- Confirmation native capture la copie de reponse au moment du choix ; compte re-verifie avant action et caches membre/effectif invalides apres succes. Aucun changement aux notes, identites ou autres joueurs.
- Tests PostgreSQL jetables avec identifiants profil/joueur distincts : lecture non vide du bon membre, pagination, absence des notes internes, mauvaise relation de club et autre joueur refuses, acceptation/reprise/refus, conflit de copie et statut administratif protege. Suite complete 139 tests applicatifs passee (8 coeur,131 Vitest), TypeScript, garde native et formatage passes.
- Apercu connecte localhost:8081/member/convocations verifie : ecran Mes convocations et etat Aucun element pour le moment sans erreur pour le compte actuel. RPC anonymes de lecture/reponse refusees (401/42501). Aucun joueur reel convoque ni reponse reelle envoyee pendant les tests ; validation sur appareils avec convocations reelles restant necessaire.
- Exports Expo Android/iOS/web reussis ; migration et sources synchronisees dans le projet FootNation. Aucune archive installable produite.

### Effectif des convocations cote administrateur - 8 septembre 2026

- Correction de ConvocationPlayers : ancienne lecture de champs profiles sur la relation player_id et insertion d un identifiant profile remplacees par club_players.id/name. Recherche paginee des joueurs actifs du club, filtre equipe par correspondance team_members.profile_id/club_players.profile_id, joueurs deja convoques exclus cote serveur. Liste des reponses paginee, equipes lues par pages et option tout l effectif actif.
- Ajout avec identifiant stable et relecture de son identite pour reprendre sans reinitialiser une reponse deja recue. Confirmation avant ajout/retrait/changement d equipe, verification fraiche du compte et des droits FFF, commandes verrouillees pendant mutation et actualisation explicite. Association/dissociation d equipe validee dans le club avec comparaison du team_id attendu ; les joueurs existants sont conserves.
- Migration 20260908036000_native_convocation_roster deployee/journalisee : garde invocateur sur INSERT/UPDATE impose joueur du meme club, nouvelle convocation pending sans reponse, identite immuable. Lecture des candidats via RPC strictement reservee aux administrateurs du club concerne. Retrait via RPC invocateur compare une copie complete de la ligne, y compris reponse/notes, en corps JSON. Politiques existantes conservees.
- Tests PostgreSQL jetables passent : correspondance profil/fiche joueur d equipe, exclusion des convoques, recherche, equipe/joueur d un autre club refuses, statut initial non invente, reponse du membre toujours fonctionnelle apres ajout du trigger, suppression refusee apres changement de notes puis acceptee avec copie concordante. Une ambiguite de nom SQL trouvee par le test a ete corrigee avant deploiement.
- Suite complete 139 tests applicatifs passee (8 coeur,131 Vitest), TypeScript et garde native passes. Deux RPC anonymes refusees (401/42501). Aucun joueur reel convoque, retire ou rattache a une equipe pendant les tests. Import/creation des fiches joueurs et controle sur appareils restent a traiter dans la parite globale.
- Formatage et exports Expo Android/iOS/web reussis ; migration et sources synchronisees dans le projet FootNation. Aucune archive installable produite.

### Gestion native des fiches joueurs - 8 septembre 2026

- Reprise des champs du PlayerForm source (nom, categorie, poste, maillot) et de sa suppression logique is_active=false. Nouvelle section Effectif des joueurs dans l administration native, liste paginee, edition/creation avec identifiant stable et comparaison atomique des modifications, retrait confirme et reactivation par le champ Joueur actif. Historique conserve, distinction visuelle des fiches avec/sans compte associe.
- Migration 20260908037000_native_club_player_management deployee/journalisee apres controle d empreinte de la RPC generique et des politiques existantes. Ajout de players a la liste blanche de cette RPC, suppression physique explicitement refusee pour cette section. Deux politiques INSERT/UPDATE reservees a is_fff_club_admin, aucune politique DELETE ajoutee.
- Trigger invocateur : autorite FFF, identite/club/compte/dates d affiliation immuables pour les ecritures applicatives, dates techniques serveur, nouveau nom/categorie non vides, nouveau numero de maillot entre 1 et 99 ou NULL. Creation liee arbitrairement a un compte refusee ; imports serveur existants restent possibles. Retrait d une fiche ancienne n exige pas de renormaliser ses valeurs historiques inchangees.
- Tests PostgreSQL jetables : creation/edition, retrait perime refuse, retrait/reactivation conservent une relation historique, suppression physique refusee, numero invalide et rattachement de compte falsifie refuses, compte tiers sans mutation. Test du maillot ajoute et contrat des champs etendu aux neuf sections generiques. Suite complete 140 tests passee (8 coeur,132 Vitest), TypeScript et garde native passes.
- Verification distante : politiques SELECT existante + INSERT/UPDATE attendues, trigger et migration presents, mutation anonyme non autorisee. Invalidation des effectifs, presences et statistiques apres changement. Aucun joueur reel cree, desactive, reactive ou modifie pour tester. Rattachement d une fiche manuelle a un compte et import natif restent distincts et non implementes dans cette etape ; essais sur appareils restent necessaires.
- Formatage et exports finaux Expo Android/iOS/web reussis ; migration et sources synchronisees dans le projet FootNation. Aucune archive installable produite.


### Effectif public des clubs - 8 septembre 2026

- Ajout du composant natif ClubRoster sur la fiche publique : joueurs et staff actifs, recherche de nom, filtre de categorie, pagination par 30, actualisation et etats de chargement/erreur/liste vide. Affichage des postes, roles et numeros de maillot ; requetes limitees aux champs effectivement affiches.
- Relation profil conservee en jointure gauche : aucun contournement de la confidentialite des profils. Avatar et lien de profil seulement lorsque la relation est accessible ; noms des fiches publiques du club restent distincts des donnees privees de profil. Cache isole par compte, club et filtres ; invalidation apres modification de joueurs ou staff.
- Apercu de la fiche Monfoot5 Annecy verifie avec effectif joueurs vide. Avertissement React de cles identiques entre deux sections trouve puis corrige avec une cle prefixee. Deux projections publiques joueurs/staff verifiees par requetes sans lignes, sans erreur. Aucune fiche reelle creee ou modifiee pour tester ; parcours peuple et appareils physiques non verifies.
- Suite complete 140 tests passee (8 coeur,132 Vitest), TypeScript, garde native, formatage et exports Expo Android/iOS/web reussis. Ces exports ne sont pas des archives installables.
- Audit de suivi du staff (backend/audit-club-staff.py), exclusivement metadonnees : une seule politique SELECT publique, aucune politique d ecriture ni trigger. Formulaire source comporte une categorie absente du formulaire natif et utilise is_active=false pour le retrait. Certains roles staff associes a un profil conferent des droits via is_club_admin : une correction distincte doit proteger cette association et les changements d autorite avant d ouvrir les ecritures. Aucune migration du staff appliquee a cette etape.


### Gestion native du staff - 8 septembre 2026

- Reprise de la categorie du StaffForm source, tri par nom, indication de compte associe, retrait logique is_active=false avec confirmation et reactivation par le champ Actif. Verification fraiche du compte et autorite is_fff_club_admin pour la lecture administrative et les mutations, comme pour les fiches joueurs. Cache public deja invalide apres succes.
- Migration 20260908038000_native_club_staff_management deployee et journalisee apres verification d empreinte de la RPC precedente, RLS et politiques du staff. Liste blanche de la RPC etendue a category ; suppression physique du staff refusee. Deux politiques INSERT/UPDATE reservees aux administrateurs FFF, aucune politique DELETE ajoutee ; lecture publique existante conservee.
- Trigger invocateur : creation sans association arbitraire a un compte, dates techniques serveur, modification limitee au nom/role/categorie/activite ; identite, compte, club, dates historiques et details importes conserves. Nom et role nouveaux non vides. Roles serveur de maintenance conservent leur fonctionnement existant. La nomination d un compte a partir d une fiche manuelle reste un parcours distinct non implemente.
- Tests PostgreSQL jetables passent : creation/edition, retrait perime refuse, retrait/reactivation avec historique preserve, suppression physique refusee, association de compte et transfert de club refuses, donnees importees inchangees, role vide refuse, membre staff sans autorite FFF incapable de s elever ou creer une fiche, tiers et appel anonyme refuses. Tests joueurs precedents inclus et passes. Aucun membre reel cree, retire ou modifie pendant ces essais.
- Suite complete 140 tests applicatifs passee (8 coeur,132 Vitest), TypeScript, garde native et formatage passes. Verification distante des deux nouvelles politiques et du trigger. Essais du formulaire avec un administrateur sur appareils physiques restant necessaires.
- Exports finaux Expo Android/iOS/web reussis ; sources et migration synchronisees dans FootNation. Aucune archive installable produite.


### Actualites publiques des clubs - 8 septembre 2026

- Ajout du composant natif ClubNews a la fiche club, a partir du ClubNewsFeed source : lecture des seules actualites publiees, epinglees en premier puis date et identifiant, pagination par 20, actualisation et etats erreur/vide. Titres, extraits, textes complets, photos et videos via les composants Expo existants ; compteurs J aime/commentaires affiches et partage systeme declenche uniquement par l utilisateur.
- Relation auteur en jointure gauche et cache isole par compte pour respecter la visibilite du profil ; nom du club en remplacement si auteur inaccessible. Invalidation de ce fil apres mutation administrative d actualite. Texte initialement integral pour ne pas cacher un contenu court qui occuperait plusieurs lignes sur petit ecran.
- TypeScript, garde native et formatage passes. Projection publique complete verifiee sans lignes (HTTP 200). Recherche anonyme d une actualite publiee renvoie une liste vide ; aucune actualite reelle creee pour tester. Apercu Monfoot5 Annecy verifie avec titre, actualisation et etat Aucune actualite publiee, sans erreur affichee. Affichage peuple des medias sur appareil restant a valider.
- Cette etape ajoute la consultation ; lecture/ecriture des commentaires et reactions du fil club ne sont pas encore implementees. Aucun changement de politique serveur ni partage reel effectue.
- Exports Expo Android/iOS/web reussis et sources synchronisees dans FootNation. Aucune archive installable produite.


### Consultation des commentaires d actualites club - 8 septembre 2026

- Ajout du bouton Lire/Masquer les commentaires a chaque actualite et composant ClubNewsComments charge seulement a l ouverture. Lecture paginee par 30, tri date/identifiant, nombre exact, actualisation, etats erreur/vide ; texte integral selectionnable et auteur avec avatar si profil accessible. Cache isole par compte, club et actualite.
- Requete joint obligatoirement une actualite du club avec is_published=true, y compris pour un administrateur disposant aussi du droit de lire les brouillons. Relation auteur demeure a gauche, pour conserver le commentaire public si profil inaccessible, avec libelle Membre FootNation. Projection et filtres verifies par requete anonyme avec identifiants inexistants : HTTP 200, compte 0.
- Audit distant de metadonnees ajoute (backend/audit-club-news-interactions.py) : commentaires SELECT true, INSERT propre auteur ; likes SELECT true, INSERT/DELETE propre utilisateur ; aucun trigger applicatif sur ces deux tables. Ces politiques ne conditionnent pas l interaction a une actualite publiee. La correction serveur et la mise a jour fiable des compteurs restent a effectuer avant integration native de l envoi et des reactions. Le filtre du composant ne remplace pas une restriction serveur.
- TypeScript, garde native et formatage passes. Aucun commentaire, like ou publication reel cree pour tester. Aucun contenu publie disponible lors de l etape precedente : parcours avec commentaires reels et appareils restant non verifies.
- Exports Expo Android/iOS/web reussis, sources synchronisees. Aucune archive installable produite.


### Envoi natif des commentaires d actualites club - 8 septembre 2026

- Migration 20260908039000_native_club_news_comments deployee/journalisee avec verification des politiques et de RLS. Quatre politiques restrictives SELECT/INSERT ajoutent la condition actualite publiee pour commentaires et likes, en conservant les politiques d auteur/utilisateur existantes. Aucun contenu historique reecrit.
- RPC invocateur avec search_path vide et appel authentifie uniquement : controle actualite/club/publication, contenu entre 1 et 10000 caracteres, auteur auth.uid et identifiant fourni stable. INSERT ON CONFLICT suivi de verification exacte de l identite, auteur et texte ; reprise concordante retour du meme identifiant, conflit refuse sans reecriture.
- Formulaire natif : connexion dirige vers /login, brouillon par compte, preparation puis publication explicite avec texte verrouille, verification fraiche du compte avant appel, erreurs conservees pour nouvelle tentative et succes visible. Caches du fil et commentaires invalides. Compteur des commentaires du fil obtenu par agregat relationnel plutot que colonne historique non maintenue.
- Tests PostgreSQL jetables passes : publication et reprise sans doublon, texte different et auteur tiers refuses sur le meme identifiant, mauvais club/brouillon/texte vide refuses ; insertions directes de commentaires et likes sur brouillon refusees, commentaires et likes historiques de brouillon invisibles meme avec lecture du parent autorisee. RPC anonyme non executable.
- Verification distante des quatre politiques, projection du compteur HTTP 200 et appel RPC anonyme refuse 401/42501. Aucun commentaire reel envoye ni reaction reelle ajoutee en test. Interface likes/unlike reste a integrer ; tests avec contenu reel et appareils physiques restent necessaires.
- Suite complete 140 tests applicatifs passee (8 coeur,132 Vitest), TypeScript, garde native, formatage et exports Expo Android/iOS/web reussis. Sources et migration synchronisees dans FootNation. Aucune archive installable produite.


### Mentions J aime natives des actualites club - 8 septembre 2026

- Ajout du bouton J aime/Retirer ma mention sur chaque actualite ; connexion vers /login si necessaire. Lecture de sa propre reaction et cache isole par compte, actualite et club ; verification fraiche d identite et du parent publie avant mutation. Commandes verrouillees pendant chargement/envoi, erreurs visibles, reprise explicite de la meme intention ou annulation avec actualisation.
- Helper applyNewsLikeIntent : ajout deja present reconnu, relecture apres erreur d insertion pour recuperer une reponse perdue ; retrait capture l identifiant de reaction et refuse de supprimer une reaction de remplacement creee ailleurs. Retrait deja effectue reconnu. Contrainte UNIQUE(news_id,user_id) et cles etrangeres confirmees dans la base distante.
- Compteur des mentions du fil issu de l agregat club_news_likes(count), comme les commentaires, sans dependance au compteur historique non maintenu. Projection publique des deux agregats verifiee HTTP 200 sans lecture de contenu. Aucune nouvelle migration necessaire apres les restrictions de publication de la migration 39.
- Fixture PostgreSQL des interactions etendue : unicite, retrait personnel reussi, retrait par un autre compte sans effet ; controles commentaires/brouillons precedents toujours passes. Trois tests de reprise et conflit ajoutes au helper et a la liste explicite Vitest. Aucun like reel ajoute ou retire pour tester ; parcours peuple sur appareils physiques restant a verifier.
- Suite complete 143 tests applicatifs passee (8 coeur,135 Vitest), TypeScript, garde native, formatage et exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation ; aucune archive installable produite.


### Publications et shorts publics des clubs - 8 septembre 2026

- Ajout de ClubMedia sur la fiche native avec modes Publications/Shorts : lecture club_publications/club_shorts limitee a is_published=true, champs affiches seulement, pagination par 12, epinglees en premier pour les publications puis date/identifiant, actualisation et etats erreur/vide.
- Textes, titres, dates, photos, videos et miniatures conserves ; compte de vues historique des shorts affiche sans increment artificiel. Lecteur Expo ouvert a la demande et un seul lecteur monte a la fois dans cette section ; fermeture explicite et fermeture lors du changement de mode. Aucun faux bouton de reaction ajoute aux contenus sans parcours correspondant.
- Cache par compte/club/mode et invalidation apres modification administrative de publication/short. API : deux projections completes verifiees sans lignes (HTTP 200), recherche de contenu publie renvoie vide dans les deux tables. Aucun contenu reel cree pour tester.
- Apercu Monfoot5 Annecy verifie : section Les publications du club, modes Publications/Shorts, actualisation et etat Aucune publication disponible sans erreur affichee. Parcours avec medias reels et lecture sur appareils restent a valider. TypeScript, garde native et formatage passes.
- Exports Expo Android/iOS/web reussis et sources synchronisees dans FootNation. Aucune archive installable produite.


### Navigation par rubriques sur la fiche club - 8 septembre 2026

- Ajout d un menu Explorer le club avec acces Informations, Actualites, Publications, Effectif et Vie sportive ; bouton Rubriques dans l en-tete pour revenir au menu. Deplacement anime par ScrollView natif, positions mesurees par onLayout et recalculees lors des changements de hauteur des sections. Clavier ferme au changement de rubrique.
- Sections restent montees pendant cette navigation : formulaires et brouillons ne sont pas detruits par un changement de rubrique. Contenus existants conserves, boutons du menu avec retour a la ligne sur les petits ecrans et couleurs des composants FootNation existants.
- Apercu Monfoot5 Annecy verifie : menu et cinq boutons exposes dans l arbre d accessibilite, bouton d en-tete visible et toutes les sections presentes sans erreur affichee. Defilement tactile, clavier et comportement des brouillons sur appareils restent a verifier. TypeScript, garde native et formatage passes.
- Exports Expo Android/iOS/web reussis ; sources synchronisees dans FootNation. Aucune archive installable produite.


### Alignement des droits de gestion des medias club - 8 septembre 2026

- Audit distant confirme que club_publications et club_shorts autorisent les ecritures par is_fff_club_admin, tandis que le controle natif generique utilisait is_club_admin, qui inclut certains roles staff. Ajout de fffAdminOnly a la configuration des sections et application aux lectures administratives, sauvegardes et suppressions des publications/shorts ; joueurs/staff conservent le meme controle existant via cette configuration.
- Verification fraiche du compte et des droits avant ces operations conservee. Aucun elargissement de politique serveur. Audit reproductible disponible dans backend/audit-club-media-access.py, limite aux metadonnees.
- Suppression d une invalidation club-public-media lancee pendant la construction du contenu, avant la sauvegarde ; invalidations apres succes de sauvegarde et suppression conservees, pour eviter la relecture prematuree de l ancien contenu.
- Comparaison du formulaire PublicationsManagerSection source : champs titre/contenu/publication deja repris dans le formulaire natif. Sa requete web reference likes_count/comments_count absents du schema club_publications observe ; cette anomalie du site original n a pas ete modifiee dans cette etape native. Aucun contenu ou droit reel modifie en test.
- Suite complete 143 tests applicatifs passee (8 coeur,135 Vitest), TypeScript, garde native, formatage et exports Expo Android/iOS/web reussis. Sources synchronisees ; essais de gestion sur appareils toujours a effectuer. Aucune archive installable produite.


### Liste native des FootLovers de club - 8 septembre 2026

- Route /club-followers?clubId=... accessible par Voir les FootLovers depuis la fiche club. Reprise de ClubFollowersList source avec pagination par 30, ordre date/identifiant, nombre exact, actualisation, etats erreur/vide et acces aux profils accessibles.
- Projection limitee aux champs affiches, relation profiles en jointure gauche et cache isole par compte. Profil inaccessible remplace par Membre FootNation sans identifiant/lien de compte affiche ; abonnement demeure compte. Cache de liste invalide apres changement d abonnement, avec cache du compteur existant.
- Apercu Monfoot5 Annecy : bouton visible sur fiche, ouverture directe de la route verifiee avec un abonne existant, avatar, nom, club et bouton Voir le profil, sans erreur affichee. Aucun abonnement reel ajoute ou retire pour tester.
- Inspection du composant ClubFollow existant revele une mutation qui inverse un etat relu au moment de l appel : sa reprise apres reponse perdue pourrait inverser l intention. Correction distincte de cette logique a effectuer ; cette etape ajoute seulement la consultation et son invalidation. TypeScript, garde native et formatage passes.
- Exports Expo Android/iOS/web reussis et sources synchronisees. Aucune archive installable produite ; verification sur appareils physiques restant necessaire.


### Fiabilite et propriete des abonnements club - 8 septembre 2026

- ClubFollow ne bascule plus un etat relu au moment de l appel : l action suivre/arreter et l identifiant attendu sont captures au clic. Helper applyClubFollowIntent reprend un ajout deja enregistre apres reponse perdue, reconnait un retrait deja effectue et refuse de supprimer un nouvel abonnement remplaçant celui initialement vise. Ecran isole par compte/club, verification fraiche d identite et reprise explicite de la meme action ; commandes bloquees pendant chargement/envoi.
- Audit distant revele une politique INSERT true sur club_followers, permettant de contourner les politiques de proprietaire. Migration 20260908040000_native_club_follow_owner deployee/journalisee apres verification des huit politiques precedentes et de RLS : restriction INSERT pour anon/authenticated exige compte authentifie et son propre profile_id, ou administrateur site pour conserver le parcours administratif existant. Politiques de lecture et retrait conservees.
- Contrainte unique(profile_id,club_id) et cles etrangeres confirmees. Tests PostgreSQL jetables : creation propre, creation administrative conservee, tiers/anonyme refuses meme avec ancienne politique permissive, doublon refuse et retrait par un autre compte sans effet. Trois tests helper de reprise/conflit passes. Audit distant confirme la nouvelle politique. Aucun abonnement reel ajoute ou retire pour tester.
- Suite complete 146 tests applicatifs passee (8 coeur,138 Vitest), TypeScript, garde native et formatage passes. Aucun changement de contenu utilisateur reel ; validation sur appareils physiques restant necessaire.
- Exports Expo Android/iOS/web reussis ; sources et migration synchronisees dans FootNation. Aucune archive installable produite.


### Mes clubs suivis en natif - 8 septembre 2026

- Ajout de la route /my-followed-clubs depuis l annuaire des clubs et le menu personnel. Reprise du composant MyFollowedClubs source avec pagination par 30, compte exact, logos/noms/localisation, acces aux fiches et decouverte de clubs. Actualisation et etats erreur/vide integres.
- AuthGate et verification fraiche du compte avant requete, filtre profile_id du compte courant et cache par utilisateur. Relation club a gauche pour signaler une fiche devenue inaccessible. Invalidation de la liste apres abonnement/desabonnement dans ClubFollow.
- Projection des champs et de la relation validee par requete sans lignes HTTP 200. Apercu connecte /my-followed-clubs verifie avec compte actuel sans abonnement : titre, decouverte, actualisation et etat Vous ne suivez aucun club sans erreur. Aucun abonnement reel cree pour remplir la liste.
- TypeScript, garde native et formatage passes. Liste peuplee et essais sur appareils physiques restant a verifier.
- Exports Expo Android/iOS/web reussis et sources synchronisees dans FootNation. Aucune archive installable produite.


### Matchs du jour sur la fiche club - 8 septembre 2026

- Reprise de la vue Aujourd hui du ClubMatchesSection source dans ClubFootball natif, en plus des equipes/calendrier/resultats. Date locale du telephone via calendarDate, re-evaluation chaque minute et au retour au premier plan ; actualisation manuelle de la vie sportive ajoutee.
- Helper todayMatches rassemble calendrier et resultats pour la date demandee, dedoublonne par identifiant en conservant le resultat si present, trie par heure puis identifiant et rejette une date impossible. Tests du regroupement/dedoublonnage et de la date locale autour de minuit passes.
- Le jeu disponible reste celui de la fonction club-details existante, qui retourne jusqu a dix matchs futurs et dix passes : cette vue ne garantit pas une couverture exhaustive des rencontres d un club au-dela de cette limite serveur. Aucun resultat reel modifie.
- Apercu Monfoot5 Annecy verifie avec boutons Aujourd hui et Actualiser la vie sportive ; pas de donnees sportives pour ce club dans la reponse actuelle. Tests de la vue peuplee sur appareils restent necessaires.
- Suite complete 148 tests applicatifs passee (8 coeur,140 Vitest), TypeScript, garde native, formatage et exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation. Aucune archive installable produite.


### Matchs renseignes par le club sur la fiche publique - 8 septembre 2026

- Ajout de ClubManagedMatches a la rubrique sportive pour afficher club_matches, deja utilise par le formulaire administratif natif et le ClubMatchesList source. Requete minimale, pagination par 30 et compte exact ; filtres A venir/en cours, Passes et Tous. Instant de reference stable durant la pagination, renouvele a l actualisation.
- Reprise des conditions source : futurs ou scheduled/live dans A venir, dates passees et finished/cancelled/postponed dans Passes. Vue Tous conserve l acces aux anciennes lignes hors de ces categories. Dates locales, categorie/competition, lieu, statut et equipe domicile/exterieur affiches ; zero conserve et score absent affiche par un tiret.
- Ordre des scores aligne sur les champs administratifs natifs home_score/away_score et les noms des equipes domicile/exterieur. Le ClubMatchCard web inverse les scores a l exterieur alors que les placeholders du MatchForm source indiquent home_score pour Eux dans ce cas : incoherence source a verifier sur des rencontres reelles avant validation definitive des donnees historiques. Aucune valeur de score reecrite.
- Invalidation du calendrier public apres creation/edition/suppression administrative. Deux projections filtrees verifiees HTTP 200 ; recherche anonyme d un match public renvoie vide. Apercu Monfoot5 Annecy montre calendrier, trois filtres, actualisation, compte 0 et etat vide sans erreur. Aucun match reel cree pour les tests.
- TypeScript, garde native et formatage passes. Statistiques de joueurs et votes MVP presentes dans le composant source ne sont pas integres dans cette etape ; parcours peuple et appareils physiques restent a verifier.
- Exports Expo Android/iOS/web reussis ; sources synchronisees dans FootNation. Aucune archive installable produite.


### Buteurs et passeurs des matchs de club - 8 septembre 2026

- Ajout de Voir/Masquer les buteurs et passeurs aux matchs termines de ClubManagedMatches, avec une seule fiche statistique ouverte a la fois. Composant ClubMatchContributors charge a la demande, modes Buteurs/Passeurs, pagination par 30, tri du nombre decroissant puis identifiant, actualisation et etats erreur/vide.
- Reprise des champs match_player_stats.goals/assists et club_players.name/jersey_number du ClubMatchCard source. Jointures obligatoires au match termine et au joueur du meme club ; absence de filtre sur activite du joueur pour conserver les statistiques historiques des joueurs retires de l effectif actif. Aucune jointure aux profils prives ni note interne lue.
- Deux projections filtrees verifiees par appels anonymes avec identifiants inexistants, HTTP 200 et compte 0. Aucun match/statistique reel cree pour remplir un test. Table des matchs vide lors de la verification precedente, donc affichage peuple et appareils physiques non verifies. TypeScript, garde native et formatage passes.
- Audit metadonnees backend/audit-match-player-stats.py : deux cles etrangeres vers match/joueur, unicite(match_id,player_id), note bornee 0..10, seule politique SELECT publique et aucun trigger applicatif. Creation/correction native des statistiques et protection du lien joueur/club restent a implementer ; cette etape est la consultation publique.
- Exports Expo Android/iOS/web reussis ; sources synchronisees dans FootNation. Aucune archive installable produite.


### Serveur de saisie des statistiques de match - 8 septembre 2026

- Migration 20260908041000_native_match_player_stats deployee/journalisee apres verification de la politique SELECT seule, de RLS et de l absence de trigger. Deux politiques INSERT/UPDATE reservees a is_fff_club_admin du match ; aucune politique DELETE ajoutee. Lecture publique conservee.
- Trigger invocateur avec search_path vide : match et joueur du meme club administre, identite/relations/note/horodatage historique immuables, dates techniques serveur, cinq compteurs nouveaux/modifies non negatifs et non nuls. Roles serveur de maintenance conservent leur fonctionnement. Pas de filtre joueur actif pour permettre une correction historique.
- RPC invocateur save_native_match_player_stats accepte exactement goals,assists,minutes_played,yellow_cards,red_cards. Creation par identifiant stable et unicite match/joueur ; reprise identique reconnue, creation concurrente conflictuelle refusee. Modification sous verrou de ligne et copie complete normalisee du record attendu ; aucune suppression/recreation globale. Note rating existante conservee, y compris lors de remise a zero des cinq compteurs.
- Tests PostgreSQL jetables passes : creation/reprise sans doublon, correction valide et correction perimee refusee, reprise de creation avec valeurs differentes refusee, compteurs negatifs et copie incomplete refuses, joueur tiers/compte non admin refuses, note non modifiable, suppression physique non accordee et remise a zero conservant identite/note.
- Verification distante des deux politiques et du trigger ; appel RPC anonyme refuse HTTP 401/42501. Aucune statistique ou rencontre reelle modifiee en test. Formulaire natif de saisie non encore integre : cette etape prepare le serveur, elle ne rend pas encore la saisie accessible depuis l application. Sources et migration synchronisees. Aucun nouvel export applicatif requis pour ces seuls changements serveur/tests ; aucune archive installable produite.


### Formulaire natif des statistiques de match - 8 septembre 2026

- Route /club-admin/[id]/match/[matchId] reliee a chaque match de la liste administrative. AuthGate, verification fraiche is_fff_club_admin et lecture du match dans le club, puis recherche paginee par 30 des fiches joueurs du club. Ancien effectif inclus et signale pour permettre une correction historique.
- Saisie des cinq compteurs source (buts, passes decisives, minutes, cartons jaunes/rouges), validation entiers non negatifs dans les bornes PostgreSQL par le parseur existant, preparation puis confirmation avec champs verrouilles et message de succes. Identifiant de creation stable et copie complete de la ligne initiale transmis a la RPC de migration 41. Note existante non exposee a l edition.
- Lecture de la fiche de statistique sans actualisation automatique pendant le brouillon, cache detruit a la fermeture ; retour au choix puis reouverture recharge la copie pour resoudre un conflit. Verification fraiche de compte/droits avant sauvegarde, invalidation des buteurs/passeurs, statistiques club et fiche joueur apres succes. Aucun effacement global des statistiques du match.
- Apercu direct de la nouvelle route avec compte non administrateur et identifiant de match inexistant : refus Cet espace est reserve aux administrateurs du club avant acces a la saisie. Aucun droit reel change ni statistique reelle enregistree pour tester. Parcours administrateur complet avec match/joueur reels sur appareils restant a verifier.
- Suite complete 148 tests applicatifs passee (8 coeur,140 Vitest), TypeScript, garde native, formatage et exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation. Aucune archive installable produite.


### Serveur du vote joueur du match - 8 septembre 2026

- Audit match_mvp_votes confirme unicite(match_id,voter_id), trois cles etrangeres, lecture publique et INSERT propre votant uniquement. Le statut du match et l eligibilite du joueur n etaient pas controles par cette derniere politique.
- Migration 20260908042000_native_match_mvp deployee/journalisee : politique INSERT restrictive verifie match termine, joueur du meme club, fiche statistique participante ou joueur actif en absence de statistiques valides du club. Reprise de la regle du composant MatchMVPVoting source, sans inventer de participation. Une fiche statistique, meme a zero, qualifie selon cette regle source.
- Lecture publique paginee par 30 des candidats avec compte de votes agrege, tri votes/nom/identifiant, controle club/match/statut et offset. Ne renvoie aucun identifiant de votant. Fonction d envoi invocateur reservee aux comptes authentifies : vote unique, reprise du meme choix reconnue, autre choix refuse, aucune modification/suppression des bulletins existants. Les trois fonctions gardent RLS et un search_path vide.
- Tests PostgreSQL jetables passes : effectif actif en absence de stats, ancien joueur participant conserve, joueur etranger/non participant refuses, pagination et offset invalide, compte agrege, reprise sans doublon, changement de choix refuse et match non termine refuse. Nom de colonne position corrige avec guillemets apres echec de syntaxe en base jetable, avant deploiement.
- Verification distante de la nouvelle politique ; envoi anonyme refuse HTTP 401/42501 et offset negatif refuse HTTP 400/22023. Aucun vote reel envoye en test. Interface native de vote non encore branchee a cette etape. Le prop isVotingOpen du site est une condition UI sans champ persistant observe ; aucun mecanisme serveur de fermeture manuelle ajoute ici.
- Sources, tests et migration synchronises dans FootNation. Aucun changement applicatif necessitant un nouvel export dans cette etape serveur ; aucune archive installable produite.


### Interface native du vote joueur du match - 8 septembre 2026

- Ajout de Vote joueur du match aux rencontres terminees de ClubManagedMatches, ouverture a la demande et un voteur visible a la fois. Candidats pagines par 30 via RPC 42, nom/categorie/poste/maillot et votes agreges affiches ; total des bulletins et propre vote lus separement, sans charger les identites des autres votants.
- Selection puis confirmation explicite, identifiant stable par choix, compte re-verifie avant appel, vote deja enregistre masque les commandes. Etats et caches isoles par compte/match, erreurs et actualisation disponibles ; conflit de vote et candidat ineligible expliques en francais. Aucun bulletin reel emis pour tester.
- Relecture du propre vote peut afficher le joueur historique meme s il ne figure plus parmi les candidats actuels apres modification des statistiques. La liste des candidats est invalidee apres sauvegarde des statistiques du match. Les deux listes de votes sont invalidees apres succes de vote.
- Relation joueur precisee comme objet nullable apres erreur TypeScript de cardinalite lors de la premiere verification. Projection HTTP du propre vote validee avec identifiants inexistants (200, aucun vote). Pas de match reel disponible pour une verification du formulaire peuple ; parcours sur appareils physiques restant a valider.
- Suite complete 148 tests applicatifs passee (8 coeur,140 Vitest), TypeScript, garde native, formatage et exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation. Aucune archive installable produite.


### Lecture des notifications - 8 septembre 2026

- Ajout des filtres Toutes/Non lues, du repere Non lue et du marquage read=true a l ouverture. Compte re-verifie avant ecriture, requete limitee au destinataire connecte et a la notification choisie ; absence de ligne et erreurs rendues visibles. Invalidation des listes apres succes. Une notification sans lien est marquee sans navigation.
- Audit en lecture seule backend/audit-notification-read.py : colonnes et politiques existantes confirmees, SELECT/UPDATE limites au destinataire. Aucune migration appliquee ; les politiques existantes ne limitent pas les colonnes modifiables, donc cette etape ne constitue pas une protection serveur de tous les champs.
- Reglages explicites : les alertes push sur telephone ne sont pas encore disponibles dans cette version. Le paquet expo-notifications et l enregistrement de jetons ne sont pas integres. La preference existante est conservee.
- Apercu navigateur de /notifications verifie : boutons Toutes/Non lues et etat vide Vous etes a jour. Aucune notification reelle marquee ni preference modifiee pour tester ; affichage peuple et ecriture sur appareil restent a verifier.
- TypeScript (apres correction du lien nullable), garde native, 148 tests (8 coeur et 140 Vitest), formatage et exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation. Aucune archive APK/IPA produite ; configuration EAS et validation sur appareils restent a terminer.


### Acces et compteur des notifications - 8 septembre 2026

- Cloche accessible depuis les en-tetes Accueil et Mon espace, vers /notifications. Compteur exact des notifications read=false du compte connecte, requete HEAD sans contenu des notifications, cache isole par compte et invalide par le marquage en lecture existant. Aucun compteur pour visiteur, badge masque a zero, affichage limite a 99+ et libelle accessible avec nombre complet. Erreur de compteur signalee dans le libelle accessible sans bloquer l acces a la liste.
- Actualisation toutes les 30 secondes pendant activite de l application, pause via AppState en arriere-plan, reprise avec donnees perimees au retour. Il s agit d un compteur dans l application, pas du badge systeme ni des alertes push.
- Projection HEAD anonyme sur identifiant inexistant validee HTTP 200, compte 0. Apercu navigateur Accueil : cloche Notifications presente entre recherche et messages. Compte sans notifications ; badge non nul et retour depuis arriere-plan sur appareils restent a verifier. Aucune notification ni preference reelle modifiee pour tester. TypeScript, garde native, 148 tests existants et formatage passes.
- Exports Expo Android/iOS/web reussis et sources synchronisees dans FootNation. Aucune archive installable APK/IPA produite.


### Liens des notifications historiques - 8 septembre 2026

- Reprise des corrections explicites du useNotifications source : /clubs/:id vers /club/:id, /matchs/:id vers /match/:id et /actus/:id vers /actu/:id. Les chemins actuels et leurs parametres/fragments sont conserves.
- Les URL HTTPS des deux origines foot-nation.com et www.foot-nation.com sont converties en chemins natifs. Origines externes, identifiants dans URL, protocoles differents, doubles slash et caracteres de controle/backslash bruts ou encodes sont refuses. Une notification sans destination valable reste dans la liste, tout en permettant son marquage comme lue. Aucun changement du validateur partage des autres parcours.
- Cinq tests specialises couvrent les trois anciens chemins, les deux domaines, les chemins actuels et parametres, les destinations ambigues/exterieures et l absence de lien ; ajout explicite a la configuration Vitest. Aucun lien issu d une notification reelle ouvert en test pour ne pas changer son etat de lecture.
- Suite complete de 153 tests (8 coeur et 145 Vitest), TypeScript, garde native, formatage et exports Expo Android/iOS/web passes. Sources synchronisees dans FootNation ; aucune archive APK/IPA produite.


### Configuration de compilation distante - 8 septembre 2026

- Revalidation locale : CLI EAS et adb absents, xcode-select pointe uniquement vers CommandLineTools, environ 312 Mio libres. Aucun projet EAS dans app.json. Aucun build distant lance et aucune archive installable produite.
- Profils development/preview/production avec environnement EAS explicite. Hook eas-build-pre-install sans dependance arrete avant installation si configuration publique Supabase absente, exemple, URL non HTTPS ou cle de format non public. Ne journalise aucune valeur. Valide uniquement la structure : ne pretend pas verifier signature de JWT, validite de cle ou disponibilite du backend. Configuration locale verifiee sans mutation.
- Documentation du fichier local ignore et des variables a renseigner dans EAS apres liaison du projet ; references officielles Expo consultees. Aucun secret ou parametre distant cree/modifie.
- Quatre tests d execution du script : absence/exemples, formats publics acceptes, cles serveur refusees sans affichage, URL invalides refusees sans affichage. Suite complete 157 tests (8 coeur et 149 Vitest), TypeScript, garde native et formatage passes. Pas de nouvel export requis pour ces seuls changements de configuration/scripts/tests/documentation.


### Galerie des Pages Pro - 8 septembre 2026

- Affichage des albums et de la mise a la une deja presents dans le composant ProPageMediaManager source. Filtres Tous/Photos/Videos/A la une appliques au serveur avant pagination de 20 ; cle de cache inclut le filtre et invalidations existantes par prefixe conservees.
- Miniature video affichee avant ouverture du lecteur a la demande ; un lecteur de galerie ouvert a la fois, fermeture disponible et remise a zero au changement de filtre/section/page. Lien explicite pour ouvrir le media d origine, notamment les videos de plateformes externes non lisibles directement par le lecteur natif. Photos indisponibles avec texte de repli et lien conserves.
- Le bucket Pro reste limite aux photos de 10 Mio ; aucun upload video ni extension de droits ajoutee. Aucun media reel cree/modifie/ouvert en test. Trois projections publiques sur page inexistante (photo/video/featured) HTTP 200 et compte 0. TypeScript, garde native et formatage passes. Affichage peuple et lecture sur appareils restent a valider.
- Exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation. Aucune archive installable produite.


### Recuperation des favoris - 8 septembre 2026

- La jointure publique des publications enregistrees inclut image_url/video_url : une publication accessible sans texte est identifiee Photo/Video/Publication enregistree au lieu du faux message Publication indisponible. Miniature photo native, aucune video chargee automatiquement.
- Une jointure nulle garde le favori et son nom de collection, explique la disparition ou restriction du contenu et desactive la navigation vers ce contenu inaccessible. Aucun favori supprime.
- Erreurs visibles meme lorsque des lignes sont deja chargees, bouton Reessayer, chargement manuel de la suite et arret du chargement automatique en erreur. Indicateur d actualisation distingue de celui de pagination.
- Projection filtre anonyme sur identifiant inexistant HTTP 200. Apercu navigateur du compte courant : etat vide des favoris verifie. Aucun favori/publication reel cree ou modifie pour tester ; affichage peuple et erreurs reseau sur appareils restent a verifier. TypeScript et garde native passes.
- Formatage et exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation ; aucune archive installable produite.


### Liste des conversations et recherche complete - 8 septembre 2026

- Audit des colonnes, politiques et index messages/profiles sans lecture de messages reels : SELECT messages limite aux participants, profils sous RLS. Le client chargeait 100 messages puis dedupliquait et recherchait localement, ce qui pouvait masquer les autres conversations derriere un echange actif.
- Migration 20260908043000_native_conversation_list deployee/journalisee : RPC get_native_conversations(text,integer), STABLE SECURITY INVOKER, search_path vide, EXECUTE authentifie uniquement. Aucune ecriture de donnees et aucune modification de politique. Regroupement par interlocuteur, dernier message par created_at/id, pagination de 30 conversations, recherche litterale sur nom/pseudo visibles avant pagination. Profils prives conserves comme jointures nulles, aucun nom prive retourne.
- Compteur de tous les messages recus non lus par conversation, hors messages masques ; reste correct si le dernier message est sortant. Contenu du dernier message masque remplace par Message masque dans la reponse. Le lecteur suit les politiques existantes de messages et ne change pas les droits d envoi.
- Tests PostgreSQL jetables passes avec 32 interlocuteurs, 120 messages sur un seul echange, message tiers et profil prive : deux pages 30/2, recherche au-dela des premiers messages, recherche % litterale, compteur conserve apres reponse, message masque exclu du compteur, acces anonyme refuse et offset negatif refuse. Requete distante anonyme HTTP 401/42501. Aucun message reel cree/modifie/lu pour tester.
- Ecran Messages raccorde avec recherche temporisee serveur et cle de cache par compte/terme, compteur numerique (99+ visuellement, nombre entier dans le libelle accessible), erreurs de pagination visibles et etat de recherche vide distinct. Apercu du compte courant : liste vide chargee sans erreur ; aucune conversation ouverte. Parcours peuple sur appareils restant a verifier.
- Suite applicative complete de 157 tests, TypeScript, garde native, formatage et exports Expo Android/iOS/web passes. Sources et migration synchronisees dans FootNation. Aucune archive installable produite.


### Lecture effective des messages - 8 septembre 2026

- Suppression de l UPDATE global de tous les messages non lus de la conversation au chargement/refetch. Marquage limite aux identifiants des messages recus, du bon interlocuteur, visibles via FlatList au moins 500 ms, deja lus et masques exclus. Seuil de couverture de zone visible 60 %, permettant aussi les messages plus hauts que l ecran ; les petites lignes entierement visibles sont prises en compte par FlatList.
- Ecriture seulement lorsque la conversation est au premier plan et AppState actif. Compte re-verifie et contexte compte/interlocuteur/activite recontrole apres l attente reseau, puis UPDATE limite aux IDs, destinataire, expediteur, read_at NULL et absence de masquage. Erreur visible avec reprise explicite ; IDs traites memorises pour eviter les repetitions avant actualisation. Listes conversation/historique invalidees apres succes.
- Quatre tests purs ajoutent les cas hors ecran, message sortant/autre interlocuteur, ecran inactif/deconnexion, deja lu/masque/traite, doublon entre pages et ancien interlocuteur. Suite complete 161 tests (8 coeur et 153 Vitest), TypeScript, garde native et formatage passes. Aucun message reel ouvert ou marque comme lu pour tester. Seuils de visibilite et cycle premier plan/arriere-plan restent a valider sur appareils.
- Exports Expo Android/iOS/web reussis, configuration finale de visibilite retrouvee dans le bundle web. Sources synchronisees dans FootNation. Aucune archive installable produite.


### Reprise d envoi de message sans doublon - 8 septembre 2026

- Audit distant des triggers messages : aucun trigger applicatif observe. La cle primaire id deja auditee fournit l unicite des propositions ; aucune migration ni modification de regle serveur ajoutee.
- Proposition UUID avec expediteur/destinataire/texte figee avant envoi, conservee pour reessayer dans la conversation ouverte. Relecture du meme ID et des memes participants via createProContent : une insertion deja recue apres perte de reponse est reconnue, toute divergence de contenu/identite refusee. Avant insertion nouvelle, compte re-verifie, relation/admin destinataire et blocages recontroles.
- Verrou synchrone contre double appui, brouillon non editable tant que la tentative reste a verifier. Reprise explicite ou abandon avec explication qu un message deja recu n est pas retire. Formulaire et etat de lecture isoles par compte/interlocuteur grace a une cle de montage ; quitter/reouvrir ou redemarrer ne conserve pas la proposition en memoire. Une boite d envoi persistante reste a faire pour ce cas.
- Test supplementaire de perte de reponse puis reprise exacte sans seconde insertion, refus de destinataire/texte divergents. Suite complete 162 tests (8 coeur et 154 Vitest), TypeScript, garde native et formatage passes. Aucun message reel envoye pour tester ; reprise reseau sur appareils reste a valider.
- Exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation. Aucune archive installable produite.


### Reprise persistante des tentatives de message - 8 septembre 2026

- Proposition sauvegardee avant toute verification/envoi reseau, par compte et interlocuteur ; stockage natif SecureStore via adaptateur existant avec decoupage et WHEN_UNLOCKED_THIS_DEVICE_ONLY, AsyncStorage dans l apercu web. Une proposition en attente par conversation, conservation du meme UUID et du texte jusqu au succes ou abandon explicite. Aucun envoi automatique au chargement.
- Restauration a l ouverture avec formulaire bloque pendant lecture locale, erreur recuperable sans ecraser la tentative existante. Le succes serveur doit etre suivi du retrait local avant de vider le formulaire ; si ce retrait echoue, reessayer reconnait le message deja enregistre. Abandon retire seulement la tentative locale, sans retirer un message recu.
- Operations de stockage serialisees par cle ; un acquittement ancien ne retire pas une proposition plus recente. Une sauvegarde concurrente divergente est refusee et une donnee corrompue ou attribuee a un autre compte n est pas restauree. Les brouillons jamais soumis ne sont pas enregistres par cette etape.
- Cinq tests avec stockage memoire : restauration apres recreation du gestionnaire, isolation compte/destinataire, conflit concurrent et acquittement perime, echec d ecriture remonte, rejet d une proposition attribuee a un autre compte. Aucun message reel ni stockage de compte reel modifie pour tester. Persistance SecureStore apres arret/redemarrage sur appareils restant a valider.
- Suite complete 167 tests (8 coeur et 159 Vitest), TypeScript, garde native, formatage et exports Expo Android/iOS/web passes. Sources synchronisees dans FootNation. Aucune archive installable produite.


### Liste des envois en attente - 8 septembre 2026

- Nouvelle route /message-outbox depuis Messages : liste locale des tentatives avec apercu de texte, nom/pseudo du destinataire si accessible et ouverture de la conversation pour reprise explicite. Donnees disponibles localement meme sans reponse du profil distant ; aucun envoi automatique.
- Registre de destinataires par compte dans le meme stockage securise natif. Registre ecrit avant la proposition : une interruption peut laisser une entree sans contenu, ignoree par la liste. Retrait apres succes/abandon, serialisation des operations par compte pour conserver deux sauvegardes concurrentes de destinataires differents. Acquittement ancien ne retire pas un nouvel envoi.
- Les propositions anterieures sans registre sont ajoutees au registre a la reouverture de leur conversation. Pas d enumeration native arbitraire des cles SecureStore. Deux tests supplementaires couvrent les destinataires concurrents, l isolation de liste, les entrees interrompues et la reprise de ce format anterieur.
- Apercu navigateur /message-outbox : explication et etat Aucun envoi en attente sur cet appareil verifies. Aucun brouillon reel ni message de test cree ; aucun statut de lecture modifie. Liste peuplee et stockage persistant sur appareils restent a verifier.
- Suite complete 169 tests (8 coeur et 161 Vitest), TypeScript, garde native, formatage et exports Expo Android/iOS/web passes. Sources synchronisees dans FootNation. Aucune archive installable produite.


### Statut et historique des messages - 8 septembre 2026

- Messages sortants avec libelle Envoye/Lu selon read_at, Masque si moderation ; date complete et heure pour distinguer les anciens echanges. Aucun statut Livre invente, aucune ecriture de read_at depuis cet affichage.
- Bouton Charger les messages precedents, reprise d erreur sur historique deja charge, suspension de pagination automatique en erreur et etat vide explicite.
- Abonnement client UPDATE des messages sortants limite au destinataire courant pour actualiser les accusés de lecture quand Realtime sera disponible. Audit backend/audit-message-realtime.py : aucune publication PostgreSQL n inclut actuellement messages. Le polling existant toutes les dix secondes reste le mecanisme effectif ; l ajout du listener seul n active pas le serveur Realtime. Aucune publication serveur modifiee dans cette etape.
- TypeScript, garde native et formatage passes. Aucune conversation reelle ouverte pour tester (ce qui marquerait les messages visibles comme lus). Affichage peuple et actualisation entre appareils restent a verifier.
- Exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation. Aucune archive installable produite.


### Activation serveur Realtime des messages - 8 septembre 2026

- Audit confirme publication supabase_realtime existante avec INSERT/UPDATE, messages absente, RLS active, identite de replication par defaut et trois politiques limitant lecture aux participants/envoi a expediteur/lecture au destinataire.
- Migration 20260908044000_native_message_realtime deployee/journalisee : ADD TABLE public.messages a la publication geree existante, operation idempotente. Aucune regle RLS, permission ou donnee de message modifiee ; identite de replication conservee, pas de REPLICA IDENTITY FULL ni ajout d anciens contenus aux evenements. Les evenements DELETE conservent les limitations Realtime documentees, ce travail ne les transforme pas en accusés de lecture.
- Fixture PostgreSQL jetable valide ajout et reprise, maintien de la table deja publiee, identite/politiques inchangees, lecture expediteur/destinataire et refus tiers/anonyme. Configuration du seul fixture Realtime avec wal_level=logical apres avertissement initial ; nouvelle execution sans avertissement. Ces tests verifient metadonnees et RLS, pas la livraison WebSocket de messages personnels.
- Verification distante apres deploiement : appartenance messages a supabase_realtime et trois politiques inchangees. Connexion WebSocket anonyme avec filtre destinataire inexistant : SUBSCRIBED, canal ferme ensuite ; aucun contenu collecte et aucune ecriture declenchee. Reception d evenements entre deux comptes/appareils restant a verifier. Polling existant conserve en secours.
- Reference officielle consultee : https://supabase.com/docs/guides/realtime/postgres-changes . Aucun changement applicatif necessitant un nouvel export dans cette etape serveur. Sources et migration synchronisees dans FootNation ; aucune archive installable produite.
- Le processus de verification WebSocket a termine normalement avec code 0 apres un delai de fermeture. Une tentative de nettoyage a constate qu il etait deja termine ; aucun serveur applicatif arrete.


### Actualisation Realtime de la boite de reception - 8 septembre 2026

- Hook partage par useConversations/useThread : abonnements INSERT/UPDATE filtres par expediteur/destinataire courant, controle des participants et de l interlocuteur avant invalidation. La liste profite du temps reel sans conversation ouverte ; envoi depuis un autre appareil et changement read_at peuvent actualiser les donnees.
- Reconnexion SUBSCRIBED et retour AppState actif declenchent une relecture. Nettoyage du canal/listener et garde disposed evitent qu un callback tardif invalide le cache apres demontage/changement de compte. Aucun traitement de DELETE sans participant identifie ; polling 10/15 secondes conserve comme secours et pour ces suppressions.
- Correction TypeScript du payload pouvant etre vide avec verification de presence de sender_id/receiver_id. Apercu Messages charge avec liste vide et acces Envois en attente/Discussions de clubs. Aucun message reel envoye ni conversation ouverte pour tester. Reception effective entre deux appareils restant a verifier.
- TypeScript, garde native, formatage et exports Expo Android/iOS/web passes. Sources synchronisees dans FootNation. Aucune archive installable produite.


### Liens dans les conversations - 8 septembre 2026

- Texte des messages rendu par MessageText en composants Text natifs selectionnables ; detection des liens HTTP/HTTPS/www, soulignement et role accessible lien. Texte, retours a la ligne et ponctuation conserves. Parentheses equilibrees des chemins conservees, ponctuation finale hors lien.
- Activation explicite seulement : URL FootNation HTTPS normalisee vers route native via notificationPath, autre URL web vers navigateur systeme via Linking. Erreur d ouverture visible et nouvelle tentative au toucher. Aucun apercu distant ni ouverture automatique ; messages masques ne transmettent que le texte Message masque au composant.
- Quatre tests purs : restitution exacte du texte et URLs multiples, ponctuation/parentheses, rejet des URL avec identifiants et protocoles non web, texte vide/ordinaire/adresses invalides preserves. Aucun message reel cree ou ouvert pour tester ; liens tactiles/selection/lecteurs d ecran sur appareils restent a verifier.
- Suite complete 173 tests (8 coeur et 165 Vitest), TypeScript, garde native, formatage et exports Expo Android/iOS/web passes. Sources synchronisees dans FootNation. Aucune archive installable produite.


### Integrite des mises a jour de messages - 8 septembre 2026

- Audit confirme trois politiques messages, aucune restriction de colonnes ni trigger : un destinataire autorise a UPDATE pouvait aussi changer texte/auteur/date/moderation. Inspection du site : updates courants de read_at et actions du MessageModerationTab administratif.
- Migration 20260908045000_native_message_update_integrity deployee/journalisee. Trigger BEFORE UPDATE invocateur avec search_path vide, comparaison de toutes les colonnes JSON hors read_at pour utilisateur ordinaire : identite, participants, contenu, date et moderation immuables. Read_at seulement par destinataire, horodatage serveur lors de premiere lecture, valeur existante conservee lors d une nouvelle date non nulle ; remise a NULL autorisee pour le destinataire.
- Administrateur is_site_admin peut modifier uniquement les champs de moderation en plus, toujours sous les politiques de lignes existantes ; auteur/date du blocage fixes par serveur, remise a zero des metadonnees lors du deblocage. Aucun droit administratif de lecture/update globale ajoute : les limites des politiques existantes restent applicables. Roles serveur postgres/service_role/supabase_admin conservent la maintenance. Ce trigger traite UPDATE seulement, pas l integrite des champs a l insertion.
- Tests PostgreSQL jetables passes : lecture destinataire, refus contenu/auteur/date/moderation ordinaires, conservation de premiere date, remise non lue, expediteur sans UPDATE, moderation administrateur autorisee avec attribution serveur, contenu toujours immutable, nettoyage du deblocage et maintenance serveur. Verification distante du trigger et de sa definition apres deploiement. Aucun message reel modifie en test.
- Sources et migration synchronisees dans FootNation. Aucun nouvel export requis pour cette etape serveur/tests ; aucune archive installable produite.


### Integrite a la creation des messages - 8 septembre 2026

- Audit de depart confirme seul trigger UPDATE de migration 45. Migration 20260908046000_native_message_insert_integrity deployee/journalisee : trigger BEFORE INSERT invocateur, search_path vide, expediteur authentifie obligatoire ; created_at serveur, read_at NULL, is_blocked false et metadonnees de moderation NULL. Identifiant, destinataire et texte exact conserves. Roles de maintenance serveur gardent leur fonctionnement.
- Aucune modification des messages existants, politiques ou regles de relation ; cette etape ne pretend pas ajouter la verification serveur des relations/blocages. Les mises a jour restent protegees par migration 45.
- Fixture PostgreSQL jetable execute aussi tous les tests 45 puis verifie normalisation de dates/lecture/moderation forgees, conservation du texte avec espaces, refus d usurpation expediteur et insertion anonyme, unicite de l identifiant, lecture legitime apres insertion et import serveur historique conserve. Verification distante des deux triggers et de leurs definitions apres deploiement. Aucun message reel insere ou modifie en test.
- Sources et migration synchronisees dans FootNation. Aucun nouvel export requis pour cette etape serveur/tests ; aucune archive installable produite.


### Autorisation serveur des envois prives - 8 septembre 2026

- Audit messages confirme INSERT auparavant limite au seul expediteur. Audit connections/user_blocks confirme champs, visibilite des relations et lecture des blocages dans les deux sens par les participants. Le site Messages selectionne relations acceptees ou destinataire administrateur, comme le formulaire natif.
- Migration 20260908047000_native_message_send_permission deployee/journalisee : politique INSERT restrictive authenticated, expediteur courant, absence de blocage dans les deux sens, relation enregistree accepted dans un sens ou l autre OU profil destinataire administrateur visible sous RLS. Blocage prioritaire y compris pour destinataire administrateur. Pas de nouvelle restriction SELECT ni modification d historique. Les controles et politiques de creation/modification des relations ne sont pas modifies par cette migration.
- Tests PostgreSQL jetables incluant aussi 45/46 passes : sans relation/pending refuses, accepted inverse autorisee, destinataire administrateur autorise sans relation, blocage inverse et blocage administrateur refuses, relation retiree refuse nouvel envoi mais histoire conservee. Verification distante de la nouvelle politique et maintien des precedentes. Aucun message, lien de relation ou blocage reel cree/modifie en test.
- Client : refus serveur 42501 lors de l insertion explique en francais, proposition stable conservee pour verification/reprise. Relecture d une proposition deja recue reste possible meme si les droits d envoi ont change depuis, sans nouvelle insertion. Validation sur appareils et scenarios de changement simultane de droits restent a verifier.
- TypeScript, garde native, formatage et exports Expo Android/iOS/web passes. Sources et migration synchronisees dans FootNation. Aucune archive installable produite.


### Consentement des relations - 8 septembre 2026

- Audit distant : six politiques connections, INSERT propre demandeur sans restriction de statut, UPDATE par chacun des deux participants, aucun trigger applicatif. Le site cree pending et propose accept/reject au destinataire ; le serveur permettait jusque-la creation accepted et auto-acceptation par demandeur.
- Migration 20260908048000_native_connection_consent deployee/journalisee : trigger INSERT/UPDATE invocateur, search_path vide. Invitation nouvelle pending du compte courant, auto-invitation refusee, date serveur. Identite/participants/date immuables ensuite, seul destinataire peut passer pending vers accepted/rejected. Reprise sans changement du statut acceptee ; transition vers NULL refusee par condition IS NOT TRUE. Roles serveur conservent maintenance. Aucune relation existante requalifiee ni supprimee.
- Fixture execute tests messages 45/46/47 puis creation accepted directe refusee, auto-invitation refusee, date serveur, demandeur ne peut accepter, changer destinataire ni passer statut NULL, pending ne permet pas message, acceptation destinataire et reprise, retour accepted->pending refuse, message autorise apres acceptation, retrait conserve et refus destinataire empeche nouveau message. Derniere version reexecutee apres durcissement du traitement NULL.
- Verification distante du trigger et maintien des contraintes/politiques. Aucun compte ni relation/message reel cree ou modifie en test. Les doublons historiques entre deux sens et le parcours de nouvelle demande apres refus ne sont pas modifies dans cette etape.
- Sources et migration synchronisees dans FootNation. Aucun nouvel export requis pour ces changements serveur/tests ; aucune archive installable produite.


### Interface des invitations refusees et reprises - 8 septembre 2026

- ProfileActions distingue Invitation refusee au lieu de proposer une insertion qui echouerait sur la cle unique ; suppression explicite de cette invitation via confirmation existante avant nouvelle demande. Erreurs de lecture relation/suivi visibles avec bouton Reessayer. Etat du composant isole par compte/profil.
- Creation/acceptation : compte re-verifie, relecture fraiche, comparaison de l invitation attendue et actuelle via connectionIntent. Invitation entrante remplacee/retiree/refusee ou participants differents refuses ; envoi deja pending propre ou relation deja accepted reconnus sans nouvelle ecriture. Une intention initiale de demande ne se transforme pas automatiquement en acceptation d une invitation entrante apparue entre-temps.
- UPDATE acceptation limite a ID, expediteur, destinataire et statut pending, resultat non vide requis ; insertion pending avec resultat requis. Invalidation des autorisations de conversation apres succes. Boutons de relation limites pendant mutation concurrente de retrait/connexion. Les mutations suivre/ne plus suivre et la gestion des doublons historiques reciproques ne sont pas refondues ici.
- Cinq tests couvrent creation/reprise, acceptation/reprise, invitation remplacee/retiree/refusee, intention stale et autre compte. Suite complete 178 tests (8 coeur et 170 Vitest), TypeScript, garde native et formatage passes. Aucune invitation ou relation reelle modifiee pour tester ; parcours connecte sur appareils restant a valider.
- Exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation. Aucune archive installable produite.


### Reprise du suivi de profils - 8 septembre 2026

- Audit backend/audit-profile-follow.py confirme unicite follower_id/followed_id, deux cles etrangeres, insertion propre follower et suppression propre follower. Aucune migration serveur necessaire.
- ProfileActions reutilise applyClubFollowIntent via alias generique pour le suivi des profils : intention following/expectedId figee, compte re-verifie, relecture propre paire, insertion deja recue reconnue, suppression limitee a ID attendu et paire. Un abonnement recree sous un autre ID n est pas retire par une ancienne intention.
- Erreur avec Reessayer la meme action de suivi ou Annuler et actualiser ; bouton normal indisponible pendant chargement/erreur de lecture. Le toggle ne change plus de sens au simple rafraichissement apres perte de reponse. Cache propre suivi invalide apres succes.
- Verification par suite complete existante incluant les tests du helper reutilise (perte de reponse, retrait deja effectue et remplacement). Aucun abonnement reel cree/supprime pour tester ; reprise reseau entre appareils restant a verifier.
- Suite complete 178 tests, TypeScript, garde native, formatage et exports Expo Android/iOS/web passes. Sources synchronisees dans FootNation ; aucune archive installable produite.


### Retrait de relations et preparation EAS - 8 septembre 2026

- EAS CLI 23.2.0 installe dans le cache npm local apres liberation d espace externe. Verification whoami : aucun compte connecte. Connexion Expo demandee pour poursuivre la liaison et les compilations ; aucun projet EAS, certificat ni build distant cree. README actualise.
- ProfileActions fige la relation au moment de demander confirmation du retrait. Compte re-verifie, lecture fraiche puis suppression conditionnelle sur ID, deux participants et statut. Une invitation acceptee ou remplacee entre-temps demande annulation/actualisation avant nouvelle confirmation ; une ancienne intention ne supprime pas la nouvelle relation.
- Reprise apres perte de reponse reconnait un retrait deja effectue. Erreur conserve le meme instantane pour Reessayer le meme retrait. Annuler efface l erreur et recharge la relation. Confirmation conservee si le cache ne contient plus la ligne pendant la reprise ; connexion/acceptation indisponible tant que cette confirmation est ouverte.
- Six tests supplementaires : instantane exact, retrait deja effectue, invitation remplacee/acceptee, reponse perdue, changement pendant DELETE conditionnel, echec persistant et autre compte. Suite coeur 8 et Vitest 176 passes (184 au total). Aucun lien de relation reel modifie pour tester. Pas de migration serveur necessaire ; doublons reciproques historiques non traites.
- TypeScript, garde native, formatage et exports Expo Android/iOS/web passes sur les sources finales. Sources synchronisees dans FootNation. Aucune archive installable produite ; validation sur appareils restant a faire.


### Relations reciproques et retrait atomique - 8 septembre 2026

- Audit read-only du RPC reseau et comptage agrege : une paire reciproque existe avec deux liens accepted. Aucune identite ni contenu de membre extrait. Conversation utilise deja accepted + limit(1) ; ProfileActions utilisait maybeSingle et pouvait echouer pour cette paire.
- ProfileActions lit toutes les lignes de la paire. Selection deterministe : accepted, puis invitation entrante pending, sortante pending, puis refusee. Cache relationship-v2 distingue la nouvelle forme. Le reseau deduplique les profils affiches par identifiant et montre les erreurs survenues apres chargement ; pagination automatique stoppee en erreur.
- Migration 20260908049000_native_connection_removal deployee et journalisee : RPC invocateur auth obligatoire, search_path vide, execution anonyme retiree. Instantane de 1 ou 2 lignes valide (ID, participants, statut), verrous de lignes ordonnes, comparaison de tous les liens actuels avant DELETE. Une relation nouvelle ou un statut modifie provoque 40001 sans retrait partiel. DELETE limite aux IDs confirmes et a la paire du compte courant sous RLS ; une insertion ulterieure d un autre ID n est pas supprimee. Reprise d un retrait termine renvoie 0 sans nouvelle ecriture.
- Confirmation explicite du retrait de la relation et des invitations avec ce membre. Le client transmet toutes les lignes affichees et conserve cet instantane en cas d erreur ; aucun nettoyage automatique des donnees existantes. Trois tests de selection ajoutent relations croisees, priorite et stabilite. Fixture PostgreSQL jetable execute aussi les tests 45-48 puis verifie retrait des deux liens, refus sans retrait partiel pour instantane incomplet/statut change, autre destinataire, snapshot nul, reprise, invitation remplacee et acces anonyme refuse.
- Verification distante : RPC present, invocateur, search_path vide, execute authenticated uniquement parmi les roles clients testes, journal 49 present ; la paire reciproque existante reste intacte. Tests sur appareils et concurrence entre sessions reelles restent a valider. TypeScript, garde native, formatage, 8 tests coeur et 179 Vitest passes (187 au total).
- Exports Expo Android/iOS/web termines avec succes ; sources et migration synchronisees dans FootNation. Aucune archive installable produite. Connexion au compte Expo toujours attendue.


### Refus des invitations conforme au site - 8 septembre 2026

- Verification du site src/hooks/useConnections.ts : rejectConnectionRequest enregistre rejected. Le bouton natif Refuser declenchait auparavant le retrait de la paire. ProfileActions propose maintenant une confirmation de refus et un UPDATE rejected limite a la seule invitation entrante pending, ID et participants attendus. Les autres invitations de la paire restent intactes ; retirer une relation demeure une action distincte.
- Compte re-verifie, lecture fraiche et instantane conserve pour reprise. Refus deja enregistre reconnu, y compris apres reponse perdue. Invitation supprimee, remplacee ou acceptee refuse la reprise. Confirmation ouverte empeche une acceptation simultanee depuis le meme ecran ; annulation efface l erreur et actualise le profil.
- Cinq tests supplementaires : refus exact, perte de reponse, refus deja effectue, remplacement/retrait/acceptation, demandeur non autorise et echec de mise a jour. Migration 48 existante protege deja la transition cote serveur ; aucune nouvelle migration necessaire et aucune invitation reelle modifiee pour tester. Tests sur appareils encore necessaires.
- Suite coeur 8 et Vitest 184 passes (192 au total). Verification TypeScript et garde native passes.
- Formatage et exports Expo Android/iOS/web passes. Sources synchronisees dans FootNation. Aucune archive installable produite ; connexion Expo et essais sur telephones restent a effectuer.


### Invitations dans les notifications - 8 septembre 2026

- Comparaison avec useNotifications du site : les demandes entrantes viennent de connections et etaient absentes de la liste native basee sur notifications. Nouvel onglet Invitations dans Notifications, reutilisant get_profile_connections pending du compte courant avec pagination 30 et visibilite des profils existante. Nom/avatar/date et acces au profil pour accepter/refuser ; aucune lecture ou reponse implicite en ouvrant la liste.
- NotificationsContent isole par compte ; requete active actualisee au retour sur ecran. Erreur initiale avec reprise, erreur apres donnees chargees conservee, pagination et actualisation disponibles dans les trois vues. Type created_at ajoute au resultat useConnections deja retourne par le RPC.
- Verification read-only dans le navigateur local : onglets Toutes/Non lues/Invitations visibles, bascule Invitations et etat Aucune invitation en attente confirme pour le compte connecte. Aucun message ouvert, aucune notification marquee lue, aucune invitation creee/acceptee/refusee pour tester. Parcours avec cartes remplies et appareils restant a valider.
- TypeScript, garde native et formatage passes. Aucun nouveau test pur pour cet assemblage d interface ; suite precedente de 192 tests non reexecutee. Compteur cloche conserve les notifications stockees seulement. Les autres categories agregees du site (reactions/commentaires/abonnements/stories, etc.) et push natif restent a integrer ; cette etape ne declare pas la parite complete des notifications.
- Exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation. Aucune archive installable produite.


### Activite sociale du compte - 8 septembre 2026

- Nouvelle page native account-activity accessible depuis Notifications. Six categories : abonnements, reactions post_reactions, anciens likes, commentaires de publications, likes de shorts et commentaires de shorts. Chaque categorie filtre le destinataire/proprietaire avant pagination 30, exclut ses propres actions, trie date et ID, et ouvre le profil ou contenu exact. Aucun evenement artificiel ni marquage lu implicite.
- Projections verifiees read-only sur UUID nul : profile_followers, likes, post_comments, short_likes et short_comments valides. Jointure source post_reactions -> user_id non disponible ; nouvelle implementation resout les auteurs par une lecture profiles explicite et limitee aux IDs de la page, sous RLS, avec Un membre si profil indisponible. Jointure source story_views -> story_id egalement non disponible ; vues de stories encore non integrees.
- Etat par compte, actualisation au retour, erreurs visibles avec reprise, historique pagine et deduplication des lignes affichees. Pas d utilisation de secret serveur. Les categories sont des historiques d activite ; elles ne sont pas encore fusionnees au flux chronologique ni au compteur des notifications non lues. Push toujours absent.
- Trois tests du chargeur : filtrage destinataire/exclusion propre auteur avant pagination pour les six categories, auteurs visibles et profil indisponible, propagation des erreurs de source/profils. Suite 8 coeur et 187 Vitest passes (195 au total), TypeScript, garde native et formatage passes.
- Apercu navigateur read-only : page, six categories, etats vides Abonnements et Reactions affiches pour le compte connecte. Aucune interaction sociale, publication ou lecture de message modifiee pour tester. Listes peuplees et navigation sur appareils restant a valider.
- Exports Expo Android/iOS/web termines avec succes. Sources synchronisees dans FootNation. Aucune archive installable produite.


### Enregistrement et activite des vues de stories - 8 septembre 2026

- Audit metadata confirme stories existe mais story_views absente, cause de la jointure source invalide. Migration 20260908050000_native_story_views deployee : table UUID, FK story/profil avec cascade, unique story_id/viewer_id, date serveur. RLS SELECT spectateur ou auteur de story ; INSERT propre spectateur pour story active, autre auteur, sans blocage dans les deux sens. Grants clients : SELECT authenticated, INSERT seulement story_id/viewer_id ; pas de date/ID forgeable, UPDATE/DELETE clients ni acces anonyme. Service_role conserve maintenance.
- Fixture PostgreSQL jetable passe : vue unique/reprise ON CONFLICT DO NOTHING, date serveur, date ou spectateur forges refuses, UPDATE refuse, auteur lit, tiers ne lit pas, propre vue/expiration/blocage refuses, anonyme refuse, suppression story cascade. Aucun enregistrement de vue reelle ni backfill historique.
- StoryImage : image chargee, detail au premier plan et application active durant delai d une seconde, compte re-verifie, nouvelle verification expiration avant upsert ignoreDuplicates. Nettoyage du timer au changement de contexte et garde apres verification de session, erreur avec reprise manuelle. Propre story non comptee. Aucun enregistrement dans le rail ni sur les vignettes de liste. Verification sur appareils/focus/background/reseau encore requise.
- Detail story verifie aussi les blocages dans les deux sens avant affichage depuis un lien direct. Activite du compte ajoute Vues de stories avec jointure FK nouvellement disponible ; liens vers detail existant (story expiree indique indisponibilite). Aucun compteur push ni fusion des notifications non lues ajoute.
- Suite 8 coeur et 187 Vitest passes (195 au total, test du chargeur couvre maintenant sept categories). TypeScript, garde native et formatage passes. Apercu read-only : categorie Vues de stories et etat vide confirmes ; aucune story reelle ouverte pour tester. Audit distant confirme colonnes, FK et politiques apres deploiement.
- Exports Expo Android/iOS/web reussis. Sources et migration synchronisees dans FootNation ; aucune archive installable produite.


### Cycle de vie des vues et reprise des images de stories - 8 septembre 2026

- Extraction scheduleStoryView : admissibilite verifiee au depart, apres delai et apres authentification ; compte attendu, auteur different, expiration valide et contexte courant requis. Nettoyage annule le timer et neutralise les retours async apres fermeture. Une requete deja envoyee ne peut pas etre retiree ; les retours de cette requete ne modifient plus l ancien ecran.
- StoryImage tient le contexte de premier plan/application/image dans des refs mises a jour directement dans les evenements, sans attendre le rendu React. Erreur de chargement image visible et reprise par remontage de l image ; image en erreur ne compte pas comme vue.
- Sept tests a horloge simulee : delai complet, annulation avant delai, perte de contexte avant timer, annulation durant authentification, session changee, propre story/expiration/date invalide/invisibilite initiale, erreur reseau et retour obsolete. Aucune story reelle ouverte et aucune vue reelle creee pour tester.
- Suite 8 coeur et 194 Vitest passes (202 au total), TypeScript, garde native et formatage passes. Comportements reels des evenements iOS/Android et reseau sur appareils restent a valider ; aucune nouvelle migration serveur.
- Exports Expo Android/iOS/web termines avec succes. Sources synchronisees dans FootNation. Aucune archive installable produite.


### Reprise des preferences et caches de blocage - 8 septembre 2026

- Nouvelle verification EAS whoami : Not logged in ; la connexion demandee reste necessaire pour lier le projet et compiler une archive distante. Aucune nouvelle demande de mot de passe, creation de projet ou compilation EAS.
- AccountSettings expose Reessayer la meme preference en reutilisant key/value de la mutation echouee, et Annuler et actualiser. Les interrupteurs sont indisponibles pendant cette erreur pour ne pas transformer une reprise en un autre choix ; chargement en erreur propose aussi une reprise. Les preferences serveur et le texte signalant le push absent restent inchanges.
- Blocage/deblocage via Report et AccountSettings invalide maintenant l ensemble des requetes, comme les changements de confidentialite. Corrige les anciennes cles relationship/network qui ne correspondaient plus aux requetes relationship-v2/people/connections et couvre les stories/detail deja en cache. Requetes actives rechargees, requetes inactives marquees a actualiser.
- TypeScript, garde native et formatage passes. Aucune preference, relation ni aucun blocage reel modifie pour tester. Aucun test nouveau pour ces changements d interface/cache ; suite precedente de 202 tests non reexecutee. Reprise reseau et changement de blocage sur appareils restant a verifier.
- Exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation. Aucune archive installable produite.


### Liens entrants natifs - 8 septembre 2026

- Inspection Expo Router installe : redirectSystemPath recoit les URL initiales et les evenements de lien. Ajout app/+native-intent.tsx avec incomingPath : schemes footnation et com.footnation.app, chemins relatifs et HTTPS FootNation normalises via notificationPath (anciens clubs/matchs/actus), parametres et fragments conserves sans journalisation.
- URL malformee, identifiants, port sur scheme custom, origine ou protocole non pris en charge redirigent vers link-unavailable, page native avec retour accueil. Transports exp/exps/exp+footnation-native preserves uniquement en mode developpement afin de conserver Expo Go/dev-client. La gestion native-intent ne s applique pas au routage web.
- Cinq tests supplementaires : deux schemes et variantes a trois slashs/racine, parametres OAuth et recuperation, URL web/relatives, entrees malformees/non fiables, transports de developpement. Suite 8 coeur et 199 Vitest passes (207 au total), TypeScript, garde native et formatage passes.
- Aucun nouveau domaine associe, fichier de verification universal/app links, callback d authentification execute ou signature configure. Reception par le systeme et retour OAuth reel restent a tester sur builds installes. Documentation Expo native-intent consultee et code du routeur local inspecte avant integration.
- Page Lien indisponible verifiee dans l apercu web avec message et retour accueil. Exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation. Aucune archive installable produite.


### Recuperation du mot de passe - 8 septembre 2026

- ResetPassword isole son formulaire par compte et mode recovery. Avant updateUser, getUser verifie que le compte correspond toujours a celui du formulaire. Session absente en mode recovery explique le lien requis et propose de demander un nouveau lien ; chargement auth respecte.
- Confirmation du nouveau mot de passe via accountChangePayload commun aux reglages, champs figes pendant mutation, erreurs effacees a edition, valeurs de mot de passe effacees apres succes. Ecran de reussite avec sortie accueil/connexion, nouvelle adresse possible apres demande de lien.
- makeRedirectUri utilise maintenant path auth/callback et queryParams recovery=1, selon les types et implementation du package Expo installe. Validation email egalement appliquee dans mutation, pas seulement au bouton.
- Suite existante 8 coeur et 199 Vitest passe (207 au total), dont validation mot de passe/confirmation partagee et preservation parametres de recuperation dans les liens entrants. TypeScript, garde native et formatage passes. Apercu read-only recovery confirme deux champs vides et bouton d enregistrement indisponible ; aucun email, code d authentification ni mot de passe reel utilise ou modifie pour tester. Parcours email et appareil complet encore a valider.
- Exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation. Aucune archive installable produite.


### Liste native des abonnes et abonnements - 8 septembre 2026

- Comparaison de l inventaire source avec routes natives : Followers du site non present ; ajout route followers et entree Mon espace. Deux onglets personnels Abonnes/Abonnements, compte requis, compteurs exacts et pages de 30, tri date/ID, profil/role/club/date de suivi et navigation vers profil pour gerer le suivi.
- Jointures FK identiques a la page source, projetees explicitement avec champs minimaux. Verifications read-only UUID nul des deux projections : HTTP 200. Profils masques ou supprimes restants sous RLS presentent Compte indisponible et ne sont pas ouvrables. Les lignes restent comptees, la pagination repose sur le nombre de relations serveur.
- Etat isole par compte, actualisation au retour/gestuelle, erreurs/reprise et pagination explicites. ProfileActions invalide la nouvelle liste personnelle apres modification du suivi. Aucun abonnement reel cree ou retire pour tester.
- TypeScript, garde native et formatage passes ; pas de nouveau test pur pour cet assemblage d interface/requetes. Suite precedente de 207 tests non reexecutee. Apercu read-only valide Abonnes vide (0) ; listes peuplees et interactions sur appareil restent a valider. L inventaire complet contient encore des routes et fonctions non reprises, en particulier recherche globale, centres/geo, aide et outils avances.
- Onglet Abonnements vide (0) confirme egalement. Exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation ; aucune archive installable produite.


### Compatibilite des routes de club et Jobs - 8 septembre 2026

- Ajout club/[id]/admin et admin/club/[id] qui reutilisent ClubAdmin et son controle de droits, sans changement d autorisation. Reprise jobs/create, jobs/my-offers et jobs/[id] vers la redirection opportunities existante, identique aux Navigate du site source.
- Rapport docs/native-route-coverage.json : comparaison des formes exactes des 113 routes source avec les fichiers natifs, noms de parametres dynamiques normalises. 83 formes correspondent directement. Ce nombre ne mesure pas la parite fonctionnelle et ne compte pas comme correspondance une route statique source geree par une route generique native (par exemple classements) ; routes geo/wildcard et fonctionnalites necessitent analyse distincte.
- L espace membre source club/:id/member est specifique au club ; il n est pas redirige vers une liste personnelle generique qui perdrait ce contexte. Cette reprise reste ouverte.
- TypeScript, garde native et formatage passes. Apercu read-only du lien club/UUID-nul/admin montre l ecran d administration et refus du compte sans droits, aucune 404 ni operation d administration effectuee. Aucun nouveau test pur pour ces fichiers de reexport ; suite precedente de 207 tests non reexecutee.
- Navigation jobs/create vers opportunities confirmee dans l apercu sans publication. Exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation ; aucune archive installable produite.


### Recherche globale native - 8 septembre 2026

- Ajout route search depuis la loupe d accueil et Mon espace. Parametres q/type du site repris, categories Tout/Profils/Clubs/Publications/Evenements, requetes apres 300 ms, acces aux fiches et pagination 20 par categorie. Tout lit les quatre categories en parallele et conserve pagination si au moins une en a encore ; resultats affiches uniques par categorie/ID.
- Champs du site repris : nom/pseudo/club/poste des profils (ville ajoutee), nom/ville/departement des clubs (nom court ajoute), texte des publications, titre/description/lieux des evenements. Valeurs PostgREST OR entierement quotees, jokers LIKE echappes. Evenements published seulement ; RLS existante conservee. Blocages dans les deux sens exclus avant pagination pour profils/auteurs de posts/organisateurs ; profils suspendus filtres avec conservation de pagination brute.
- Page authentifiee coherente avec la recherche complete annoncee sur l accueil natif. Recommandations personnalisees et categories de suggestions presentes sur la page web sans recherche ne sont pas reprises ici. Rapport de routes actualise pour search ; correspondance de route ne prouve pas parite complete.
- Projections et champs filtres des quatre tables verifies avec UUID nul (HTTP 200). Apercu read-only search?q=Drumettaz&type=all confirme vrais resultats profils/clubs et cinq onglets ; aucun profil ouvert ni action sociale effectuee pour tester.
- Cinq tests supplementaires : vide/non connecte sans requete, ponctuation/jokers, blocages et statut avant pagination, page complete filtree pour suspension, propagation d erreur. Suite 8 coeur et 204 Vitest passes (212 au total), TypeScript, garde native et formatage passes. Autres categories peuplees, pagination et interaction sur appareils restent a valider.
- Exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation ; aucune archive installable produite.


### Centres de foot a 5 - 8 septembre 2026

- Source FiveSideCentersPage utilise type=five_center, distinct du classement indoor par mots-cles de l annuaire general. Projection type/slug/logo valide sur backend. Nouvelle route centres-foot-5 et acces depuis annuaire/Mon espace, reutilisant composants natifs avec filtre exact additionnel dans useClubs et cle de cache distincte.
- Page specialisee garde type=five_center lors de recherche/reinitialisation ; nom/nom court/ville/departement, comptage exact et pages de 30 (la source limite a 500). Annuaire general conserve ses filtres existants. Erreurs apres chargement visibles, pagination automatique stoppee en erreur et bouton explicite Afficher davantage disponible.
- Apercu read-only confirme 274 centres et premiere page de 30 avec bouton de suite. Aucun centre, suivi ou contenu reel modifie pour tester. Regroupements et liens geographiques de la page source encore a reprendre avec les pages departement/ville.
- TypeScript, garde native et formatage passes. Aucun nouveau test pur pour cet assemblage ; suite precedente de 212 tests non reexecutee. Rapport de routes actualise pour centres-foot-5. Verification sur appareils encore necessaire.
- Filtre departement 69 confirme dans l apercu : 15 centres du Rhone, sans ouverture de fiche ni mutation. Exports Expo Android/iOS/web reussis (dist-native). Sources synchronisees dans FootNation ; aucune archive installable produite.

### Espace membre specifique au club — 8 septembre 2026

- Ajout club/[id]/member et entree depuis la fiche club. Premiere reprise native : mes appartenances actives, championnat de l equipe approuvee principale (sinon premiere approuvee), effectifs approuves du club et calendrier du club. Compte requis, etats et caches par compte/club/onglet, verification getUser et appartenance avant chaque chargement de section, actualisation au focus et erreurs explicites. Profil rattache au club admis comme dans le site ; aucune equipe arbitraire choisie en absence d affectation approuvee.
- Audit read-only backend/audit-club-member-space.py : club_matches ne contient ni team_id ni opponent/location, mais opponent_name/venue/category. Calendrier explicitement du club, sans inventer un filtrage par equipe. club_attendance_sessions ne contient pas title, et ses lectures sont reservees aux administrateurs. Sortie d equipe du site modifie team_members mais aucune politique de modification personnelle n existe. Ces fonctions necessitent une reprise backend avant activation ; aucune politique ni appartenance reelle modifiee ici.
- Quatre projections REST verifiees avec UUID nul, HTTP 200, dont les jointures equipes/profils des effectifs. Effectifs et classements pagines par 30 avec tri stable ; profils invisibles affiches indisponibles sans lien. Tests de decision d acces : pending/rejected seuls refuses, priorite approuvee/principale, rattachement sans equipe sans equipe inventee. Suite 8 coeur + 207 Vitest = 215 tests passes, TypeScript, garde native et formatage passes.
- Apercu authentifie en lecture seule : club non membre affiche Acces reserve et retour fiche. Affichage peuple comme membre approuve et tests appareil restent a faire. Reprise encore partielle : recherche d effectif, presences, statistiques, messagerie contextualisee et depart d equipe non implementes dans cet espace. Rapport de correspondance de route actualise ; il ne prouve pas parite fonctionnelle.
- Exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation ; aucune archive installable produite.

### Statistiques de l espace membre — 8 septembre 2026

- Onglet Statistiques specifique au club : matchs termines, matchs avec score exploitable, victoires/nuls/defaites et buts marques/encaisses. Perimetre affiche toutes categories et saisons. Matchs incomplets (score absent/invalide ou domicile/exterieur inconnu) comptes parmi les termines mais exclus du bilan, avec avertissement quantifie.
- loadClubMatchTotals partage avec ClubStats administrateur, sans acces aux joueurs actifs depuis l espace membre. Lecture des matchs finished de ce club par pages de 500, ordre ID ; autorisation avant chaque page, erreurs sans bilan partiel. Ecran membre isole par compte/club, actualise au focus et manuellement, masque les anciennes donnees en cas d erreur.
- Quatre tests supplementaires : domicile/exterieur, nul 0-0 et scores incomplets ; 501 matchs et portee/ordre/pagination ; retrait d acces en cours de chargement ; erreur serveur. Suite 8 coeur + 211 Vitest = 219 tests passes. TypeScript, garde native et formatage passes. Projection club_matches et politique SELECT publique confirmees par l audit du tour precedent, aucun droit backend change ni match reel modifie pour tester. Affichage avec un compte membre sur appareil reste a verifier.
- Les presences, la messagerie contextualisee et la sortie d equipe de cet espace restent a reprendre ; l application complete et les archives natives restent non finalisees.
- Exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation ; aucune archive installable produite.

### Messagerie contextualisee dans l espace membre — 8 septembre 2026

- Onglet Messagerie reutilise la liste native de discussions et ses liens club-chat/[id], avec filtre exact du club dans la jointure interne avant pagination. Seuls les groupes dont le compte est membre sont proposes, selon les droits existants. La liste globale conserve tous les clubs du compte ; cache distingue compte et club, composant global remonte au changement de compte.
- loadClubChatGroups verifie session pour liste globale et appartenance au club pour liste contextualisee avant chaque page. Actualisation au focus/manuelle, erreur avec reprise masque les anciennes lignes, pages de 30 triees joined_at/ID. Aucune conversation reelle ouverte, aucun message envoye ou marque lu pour tester.
- Projection REST avec jointure interne groupe/club et deux filtres verifiee avec UUID nul : HTTP 200. Quatre tests supplementaires : filtres avant pagination/jointure interne, appartenance retiree sans lecture, liste globale/session changee, propagation erreur serveur. Suite 8 coeur + 215 Vitest = 223 tests passes, TypeScript, garde native et formatage passes. Parcours peuple et appareils restent a verifier.
- Cette integration donne acces a la messagerie native existante depuis le club ; presences et sortie d equipe restent a implementer dans cet espace membre. Aucun droit serveur modifie.
- Apercu liste globale vide confirme, sans ouverture de discussion. Exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation ; aucune archive installable produite.

### Presences de l espace membre — 8 septembre 2026

- Migration 51 get_native_member_attendance : lecture ciblee des seances du club, champs id/category/session_type/session_date seulement. Fonction STABLE SECURITY DEFINER search_path vide, auth.uid obligatoire, profil rattache au club ou appartenance active approved a une equipe de ce club. Aucun droit de table modifie ; notes et created_by non retournes. Pagination validee 1–100, offset positif, ordre session_date DESC NULLS LAST puis ID.
- Tests PostgreSQL en base jetable passes : profil rattache, membre approuve, club tiers refuse, pending/inactif/session absente/anon refuses, pagination et ordre, limites, notes et auteur absents, acces direct table toujours ferme. Migration appliquee avec garde sur les deux politiques existantes, transaction avec journal 20260908051000, copie dans supabase/migrations du projet source.
- Onglet Presences reprend la liste de seances du site avec les champs reels session_type et session_date, categories, types traduits, page de 30, actualisation focus/manuelle, session comparee au compte de l ecran avant RPC. N expose ni presence individuelle d un autre joueur ni notes internes. Aucune seance ou appartenance reelle modifiee pour tester.
- TypeScript, garde native et formatage passes. Pas de nouveau test pur pour cet assemblage : derniere suite de 223 tests non reexecutee. Controle d acces serveur teste par fixture SQL ; rendu peuple et appareils restent a valider. Sortie d equipe reste a implementer, application complete encore non finalisee.
- Verification distante : journal 51 present, signature limitee aux quatre champs, execution anon interdite/authenticated autorisee et politiques de table inchangees. Appel REST anonyme UUID nul refuse (401/42501). Exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation ; aucune archive installable produite.

### Depart d equipe — 8 septembre 2026

- Migration 52 leave_native_team : membre courant seulement, club et appartenance precis, verrou profil puis appartenance comme le flux administrateur, comparaison updated_at avant modification. Desactive is_active/is_primary, status rejected et date serveur left_at. Autres appartenances et linked_club_id inchanges. Appartenance deja quittee retourne sans ecriture pour reprise apres reponse perdue ; reactivation recente invalide l ancienne demande.
- Audit distant team_members : aucun trigger non interne avant migration. Ajout native_team_member_version avant chaque UPDATE, timestamp serveur strictement croissant, pour detecter les modifications et reactivations effectuees par tous les flux. Aucun backfill ni modification de lignes existantes lors du deploiement. Les droits de table restent inchanges ; RPC SECURITY DEFINER search_path vide, execution authenticated seulement.
- Fixture PostgreSQL jetable passee : autre compte/club refuses, version obsolete refusee, depart complet, autre equipe et profil conserves, retry sans seconde ecriture, reactivation protegeant contre ancienne demande, session absente et anon refuses. Migration appliquee et journalisee 20260908052000 ; signature, permissions et trigger verifies a distance, copie source supabase/migrations realisee. Aucun membre reel n a quitte une equipe pour tester.
- Onglet Parametres liste les equipes actives et demande confirmation explicite du nom de l equipe. Session reverifiee avant mutation, copie de version conservee pour retry, message de conflit invite annuler/actualiser, boutons figes pendant traitement. Succes invalide caches et revient a la fiche club. TypeScript et suite 8 coeur + 215 Vitest = 223 tests passes ; tests SQL additionnels ci-dessus. Rendu peuple, depart reel et appareils restent non verifies.
- Formatage passe. Exports Expo Android/iOS/web reussis, regeneres apres precision du texte de confirmation. Sources synchronisees dans FootNation ; aucune archive installable produite. L application complete reste non finalisee, notamment builds installables/push/parcours appareils et fonctions restantes de l inventaire.

### Recherche des effectifs membres — 8 septembre 2026

- Ajout champ nom/pseudo/role dans Effectifs, requete apres temporisation existante, terme dans la cle de cache. Migration 53 get_native_member_roster filtre sur le serveur avant pagination, club precis, appartenances actives approved, tri ID stable. strpos/lower/btrim pour recherche litterale sans jokers ; memes champs de recherche que le site.
- RPC STABLE SECURITY INVOKER/search_path vide, auth et appartenance/rattachement verifies, RLS des profils conservee. Projection minimale, profil masque reste NULL et son nom ne peut pas correspondre a une recherche. Pagination 1–100/offset positif. Aucun droit de table ni profil/appartenance reel modifie.
- Fixture PostgreSQL jetable passee apres correction syntaxique du nom de sortie position : portee club/active/approved, recherche avant pagination, page suivante vide, casse/espaces, % et _ litteraux, recherche de profil masque impossible et profil NULL, autre club/session absente/anon refuses, limite bornee. Migration 20260908053000 appliquee et journalisee, copie source supabase/migrations.
- TypeScript, garde native et formatage passes. Tests de cette modification portes par fixture SQL ; derniere suite applicative de 223 tests non reexecutee. Recherche peuplee avec compte membre et appareils restent a verifier. EAS whoami recontrole ce tour : Not logged in, versions installables toujours en attente de connexion Expo.
- Verification distante : journal 53 present, fonction invoker avec search_path vide et execution anon interdite/authenticated autorisee. Exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation ; aucune archive installable produite.

### Annuaires par departement — 8 septembre 2026

- Copie du referentiel departements du site dans src/data/french-departments.ts. Liste native clubs-departement avec recherche nom/code/region et page clubs-departement/[combined] : code valide, URL canonique et etat inconnu explicite. Liens entrants historiques clubs-departement-nom-code normalises par notificationPath, origine de confiance et parametres/fragment conserves.
- Annuaire reutilise avec departement fixe dans requete, titre/region, compteur exact/pages de 30 et liens autres departements de la region. Reinitialiser recherche/type ne retire pas le contexte departement. Choix de departement accessible depuis annuaire general et centres. Regroupement source des principales villes et pages ville encore a reprendre ; les pages departement ne prouvent pas la parite geographique complete.
- Trois tests ajoutes : boucle des liens canoniques et unicite des codes, Corse/DOM/zero initial/inconnus, normalisation anciens liens et rejet origine externe. Suite 8 coeur + 218 Vitest = 226 tests passes. Erreur de fermeture JSX corrigee avant validation finale TypeScript ; garde native et formatage passes. Apercu read-only Rhone confirme 258 entrees et liens voisins, sans ouverture de fiche ni mutation.
- Recherche Bessenay verifiee dans le Rhone (1 resultat), reinitialisation revient aux 258 entrees du meme departement. Exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation ; aucune archive installable produite.

### Annuaires par ville — 8 septembre 2026

- Reprise CityClubsPage et citySlug du site : ville et departement dans le lien, normalisation accents/casse/apostrophes. Route native clubs-ville/[combined], anciens liens clubs-ville-... geres par notificationPath et route legacy pour entree web directe ; noms inconnus hors ces familles restent NotFound. Ancien lien departement egalement pris en charge en entree web.
- Lecture des clubs d un departement par pages de 500, tri nom/ID, puis regroupement par slug de ville (variantes de casse/accents reunies). Annuaire ville avec logo, nom, recherche locale, affichage progressif 30, retour departement et huit villes voisines. Douze principales villes ajoutees au departement. Pas de limite implicite a la premiere page de 1000 lignes ; erreur de page intermediaire ne retourne pas un resultat partiel.
- Projection REST validee UUID nul HTTP 200. Apercu read-only ancien lien clubs-ville-bessenay-69 redirige vers /clubs-ville/bessenay-69, affiche un club avec logo et huit villes du Rhone. Aucun club ouvert ou modifie pour tester. Autres familles publiques city/football et contenus editoriaux ne sont pas couverts par cette seule reprise.
- Trois tests ajoutes : normalisation/regroupement, 501 clubs charges avant regroupement et filtre departement, erreur de deuxieme page propagee. Garde JSX a signale une condition booleenne a expliciter ; corrigee puis suite complete 8 coeur + 221 Vitest = 229 tests passes. TypeScript et formatage passes ; essais appareils et tres grandes listes restent a valider.
- Exports Expo Android/iOS/web reussis, regeneres apres correction JSX. Sources synchronisees dans FootNation ; aucune archive installable produite.

### Organisations natives — 8 septembre 2026

- Reprise page Organizations, annuaire public et creation compte requis, depuis Mon espace. Liste pages de 30 tri created_at/ID, logo/type/description/adresse/departement/site/email, actualisation focus/manuelle et erreurs explicites. Projection backend validee UUID nul HTTP 200, annuaire actuellement vide dans apercu.
- Formulaire reprend nom/type/description/site/departement/adresse/email du site. Validation nom/type, code connu, email optionnel et URL http(s) sans identifiants ; coordonnees publiques indiquees. UUID stable par formulaire et createProContent pour relire le meme contenu avant retry, session reverifiee, snapshot fige apres soumission et onglets figes pendant mutation, invalidation liste puis retour apres succes.
- Audit metadata organizations : SELECT public, INSERT proprietaire, UPDATE/DELETE proprietaire, pas de trigger. verified est directement modifiable par proprietaire : badge volontairement non affiche dans cette premiere reprise tant que son attribution serveur n est pas securisee. La reprise du statut verifie reste donc ouverte, aucune regle de table changee ici. Aucun contenu reel cree/modifie ni email/site ouvert pour tester.
- Trois tests supplementaires validation/normalisation/exclusion statut verifie, champs invalides, URL actives/identifiants refusees. Suite 8 coeur + 224 Vitest = 232 tests passes, TypeScript/garde native/formatage passes. Apercu read-only annuaire vide et formulaire six champs, trois types, bouton creation verifies ; creation reelle et appareils restent a valider.
- Exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation ; aucune archive installable produite.

### Verification des organisations — 8 septembre 2026

- Audit distant prealable : organizations vide (0/0 verifies), aucun trigger et aucune fonction publique faisant reference a organizations. Migration 54 native_organization_integrity ajoute trigger invoker/search_path vide : creation par compte courant, verified false et date serveur ; identifiant/createur/date/statut non modifiables par client. Seuls roles serveur privilegies postgres/service_role/supabase_admin peuvent attribuer verified.
- Changement des champs d identite nom/type/site/adresse/email/departement retire la verification precedente ; modification de description seule la conserve. Aucun statut historique reinitialise (garde refuse de deployer si verified historique existe). Aucun changement des quatre politiques de table.
- Fixture PostgreSQL jetable passee : tentative verified true/NULL, date et createur forges, identifiant/date modifies, autre proprietaire, attribution serveur puis invalidation a changement d identite, maintien sur description. Suppression de profil avec FK ON DELETE SET NULL testee et preservee. Migration appliquee et journalisee 20260908054000, trigger/permissions/politiques et compte toujours 0 verifies a distance, copie source effectuee.
- Annuaire natif affiche Organisation verifiee seulement pour verified === true, champ ajoute a projection. TypeScript, garde native et formatage passes. Pas de nouveau test pur pour cette condition ; derniere suite applicative de 232 tests non reexecutee. Aucun compte ni organisation reelle cree/modifie/verifie pour tester ; rendu peuple et workflow administratif de verification sur appareil restent a valider.
- Exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation ; aucune archive installable produite.

### Centre d aide natif — 8 septembre 2026

- Reprise route help et entree Mon espace, cinq questions du site (profil, Premium OPEN, club, Story, suppression), recherche texte sans distinction accents/casse, accordions accessibles et liens directs. Contact et messagerie reveles a la demande, raccourcis confidentialite/reseau/securite des mineurs, couleurs natives FootNation.
- Reponses adaptees aux ecrans reels : creation Story avec photo/legende/lieu/hashtags, suppression actuelle par formulaire de demande seulement. PremiumSection source retourne null et usePremium declare fonctionnalites gratuites ; anciens tarifs 1€/10€ du Help non repris. Pas de promesse de support 9h–18h : le lien source ouvre simplement messages. Verification web du domaine docs.foot-nation.com a echoue ; lien externe non valide non reproduit, guides presents dans FAQ et contact propose. Le portail externe de documentation n est donc pas migre.
- TypeScript, garde native (apres explicitation booleenne de l affichage support) et formatage passes. Pas de tests unitaires reproduisant ce contenu ; derniere suite de 232 tests non reexecutee. Apercu read-only cinq questions et recherche supprimer ramenant une question verifies ; aucune demande de contact/suppression, aucune story ni conversation ouverte pour tester.
- Le parcours natif de suppression immediate de compte reste absent : la FAQ decrit la demande actuelle sans pretendre satisfaire cette fonctionnalite. La migration complete et les tests appareils restent ouverts.
- Ouverture de la reponse suppression et lien vers formulaire confirmes sans action. Exports Expo Android/iOS/web reussis, regeneres apres correction booleenne. Sources synchronisees dans FootNation ; aucune archive installable produite.

### Entree du tableau de bord des clubs — 8 septembre 2026

- Source /club-dashboard ne transmet aucun parametre de club alors que ClubAdminDashboard attend useParams.id ; composant historique utilise aussi table clubs, outils Footeo et bouton modifier annonce bientot disponible. Reprise native du point d entree via selecteur des affectations club_admins du compte, puis administration FFF native existante. Parametres optionnels id/clubId ouvrent directement ClubAdmin et son controle de droits.
- Page club-dashboard depuis Mon espace : auth, cache/etat par compte, getUser avant lecture, filtre profile_id avant pagination 30 tri created_at/ID ; resolution uniquement des fiches fff_clubs de cette page. Affectation orpheline conservee avec fiche indisponible, aucun UUID null envoye en filtre, erreurs/reprise/focus. Aucun droit nouveau ni creation d affectation.
- Quatre tests supplementaires : portee compte/pagination/IDs de page, session changee sans lecture, orphelin sans UUID invalide, erreur fiche propagee. Suite 8 coeur + 228 Vitest = 236 tests passes, TypeScript/garde native/formatage passes. Projections club_admins et fff_clubs verifiees UUID nul HTTP 200. Apercu read-only compte sans affectation affiche Aucun club administre et recherche de club.
- Import Footeo et outils historiques bases sur table clubs ne sont pas portes par ce simple point d entree ; la parite fonctionnelle de ces fonctions reste a traiter. Aucun club/admin reel modifie pour tester ; liste peuplee et appareils restent a valider.
- Lien club-dashboard?id=UUID-nul redirige vers administration native avec refus du compte sans droits confirme. Exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation ; aucune archive installable produite.

### Profils publics de talents — 8 septembre 2026

- Ajout route talent/[slug], consultable sans AuthGate. Reprise lookup source slug puis UUID strict seulement si absent, is_published true dans les deux lectures, erreurs non masquees et profils suspendus refuses. Cache par slug/compte, actualisation au focus. Champs selectionnes explicitement pour presentation/parcours/football, sans email/telephone/date de naissance personnels.
- Affichage couverture/avatar/nom/role/poste/niveau/ville/club, bio, nationalite/taille/poids/pied/competences si disponibles, sections CV parcours/distinctions/certifications/technique/points forts. CTA profil connecte ou connexion/inscription ; pas de faux contenu de remplacement. Layouts publics specialises des comptes organisation et certains contenus editoriaux/FAQ source restent a reprendre, ce point d entree ne prouve pas une parite totale de PublicPlayerProfile.
- Quatre tests ajoutes : slug/publication/projection, UUID secours valide/publication et absence de secours pour nonUUID, erreur conservee, suspension/vide. Suite 8 coeur + 232 Vitest = 240 tests passes, TypeScript/garde native/formatage passes. Projection publique et filtres slug/ID verifies anon UUID nul HTTP 200. Apercu read-only identifiant absent affiche Profil indisponible sans porte de connexion ; aucun profil reel ouvert ni vue enregistree pour tester. Rendu peuple et appareils restent a valider.
- Exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation ; aucune archive installable produite.

### Profils publics professionnels — 8 septembre 2026

- Reprise des informations de base des layouts source ClubProfile/BusinessProfile/InstitutionProfile dans talent/[slug] via OrganizationDetails natif commun. Projection ajoute account_type et champs professionnels nom/description/secteur/type/niveau/adresse/contact/site ; email/telephone personnels et date de naissance toujours non demandes. Regles published/suspension/RLS inchangees.
- Entete utilise le nom du type de compte actif, avec repli nom du profil ; champs professionnels residuels d un compte personnel n influencent pas son nom. Les rubriques football et CV joueur ne sont pas affichees aux comptes club/business/institution. Description generale et couverture conservees, libelles secteur/type/niveau traduits par listes existantes.
- Test additionnel noms des trois types, compte personnel et nom professionnel blanc. Suite 8 coeur + 233 Vitest = 241 tests passes, TypeScript/garde native/formatage passes. Projection anonyme complete avec UUID nul/published HTTP 200 ; aucun profil reel ouvert ou modifie pour tester. Rendu professionnel peuple, interactions de contact, badges/liaisons de club specifiques des layouts source et tests appareils restent a valider/completer.
- Exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation ; aucune archive installable produite.

### Contacts professionnels et partage public — 8 septembre 2026

- OrganizationDetails commun aux profils connectes/publics propose email professionnel, telephone et recherche cartographique pour les champs du type de compte actif. Valeurs selectionnables conservees ; ouverture uniquement au toucher, et erreur avec possibilite de copier si application indisponible. Aucun contact personnel ajoute a la projection.
- Numeros nationaux/internationaux normalises, caracteres de commande et numeros invalides refuses ; email valide et encode sans parametres additionnels, adresse encodee dans une URL cartographique fixe. Profil public partageable via feuille systeme avec URL FootNation slug/UUID encodee ; lien toujours visible et selectionnable, annulation web sans faux succes.
- Quatre tests supplementaires sur normalisation/rejets, email, adresse et URL publique. TypeScript, controle JSX natif, formatage et suite complete 8 coeur + 237 Vitest = 245 tests passes (52 fichiers Vitest). Aucun appel, email ou partage reel effectue pour tester. Ouverture des applications externes et rendu peuple restent a verifier sur appareils Android/iOS.
- Exports Expo Android/iOS/web reussis. Sources synchronisees dans FootNation ; aucune archive installable produite.

### Identite et club des profils — 8 septembre 2026

- Comparaison PublicPlayerProfile et layouts professionnels source : reprise badge Profil verifie strictement is_verified === true, type Club/Entreprise-Marque/Institution et bouton explicite Voir le club associe vers fiche native pour linked_club_id UUID valide. La fiche publique reste consultable ; la redirection automatique du layout ClubProfile source devient un acces volontaire pour conserver ses informations et son partage. Le lien ne declare pas le club verifie.
- Composant ProfileIdentity partage entre profils publics et connectes. Profils connectes utilisent desormais le nom professionnel du type actif, comme la vue publique ; rubriques competences/CV joueur masquees pour les organisations. Aucun statut attribue/modifie, controle serveur d autorite existant migration 11 conserve. Projection publique ajoute uniquement is_verified et linked_club_id ; lecture anonyme sur UUID absent HTTP 200.
- TypeScript, garde JSX native et formatage passes ; cinq tests existants publicTalent reexecutes et passes (publication, suspension, recherche, erreurs, nom professionnel). Derniere suite complete 245 tests passee au lot precedent, non reexecutee pour cet affichage. Aucun profil reel modifie ni consultation de conversation/story effectuee. Rendu peuple et navigation sur appareils restent a valider.
- Exports Expo Android/iOS/web reussis ; sources synchronisees dans FootNation. Aucune archive Android/iOS installable produite.

### Retour au profil partage apres connexion — 8 septembre 2026

- Profil public transmet une destination next a connexion/inscription. Connexion par mot de passe et Google reprennent cette fiche au lieu de l accueil ; navigation connexion-inscription et mode signup conservent ce contexte. Confirmation email et callback OAuth incluent next dans URI AuthSession, revalidee avant navigation. Les liens entrants conservent deja les parametres encodes.
- authReturnPath accepte uniquement /talent/un-segment, normalise son encodage, refuse URL externe, autres routes, query/hash, slash/backslash encodes, controles, segments de traversee et encodages invalides. Aucun retour vers une route a effet implicite depuis ce parametre. Recuperation de mot de passe et parcours de parrainage gardent leur priorite ; sans destination le comportement accueil/settings existant reste conserve. Le retour apres parrainage ou apres mot de passe oublie ne couvre pas encore ce contexte.
- TypeScript, controle natif, formatage et suite complete 8 coeur + 239 Vitest = 247 tests passes, 53 fichiers Vitest. Deux tests nouveaux sur destination canonique et rejets. Aucun compte cree, email envoye ou OAuth reel declenche pour tester. Validation des redirections Supabase avec parametre next et aller-retour reel sur appareils restent a effectuer ; les tests locaux ne prouvent pas cette configuration distante.
- Exports Expo Android/iOS/web reussis ; sources synchronisees dans FootNation. Aucune archive installable produite.

### Retour apres recuperation du mot de passe — 8 septembre 2026

- Le bouton Mot de passe oublie de Login transmet maintenant la destination publique valide a ResetPassword. La demande email encode next avec recovery=1 dans URI callback ; authCallbackPath impose toujours la recuperation avant le parrainage et conserve uniquement un retour public autorise. Aucun changement aux controles de session ou a la validation du nouveau mot de passe.
- Nouvelle demande de lien, retour a connexion apres envoi et bouton apres changement reussi conservent ce contexte. Bouton Retrouver le profil partage affiche seulement apres succes du changement lorsqu une destination existe ; sans destination accueil habituel. Etat du formulaire reinitialise si compte/mode/destination changent.
- Test additionnel sur priorite recuperation/parrainage/retour et rejet destination externe ; suite complete 8 coeur + 240 Vitest = 248 tests passes, 53 fichiers Vitest. TypeScript, garde native et formatage passes. Aucun email envoye ni mot de passe reel modifie. Aller-retour email reel, autorisation distante de callback avec next et appareils restent a valider. Retour apres parrainage reste distinct et non prolonge par ce changement.
- Exports Expo Android/iOS/web reussis ; sources synchronisees dans FootNation. Aucune archive installable produite.

### Retour apres parrainage — 8 septembre 2026

- Inscription avec session immediate et callback de confirmation conservent maintenant la destination publique valide dans route referral?apply=1. Ecran Parrainage propose Retrouver le profil partage, meme si le contenu attend un profil complete ou rencontre une erreur. La navigation est volontaire et ne depend pas de la creation du propre lien de parrainage. Traitement existant d attribution inchange ; aucune attribution nouvelle executee pour tester.
- Destination revalidee a l affichage, toujours limitee aux profils publics. Test additionnel sur aller-retour du slug accentue/encode via parametre de parrainage et rejet d URL externe. Tests de priorite recuperation ajustes, priorite conservee. Suite complete 8 coeur + 241 Vitest = 249 tests passes ; TypeScript, garde native et formatage passes. Aucun parrainage, partage ou inscription reel effectue pour tester. Rendu sur appareils et parcours de confirmation externe restent a valider.
- Exports Expo Android/iOS/web reussis ; sources synchronisees dans FootNation. Aucune archive installable produite.

### Partage des fiches clubs — 8 septembre 2026

- Ajout bouton Partager ce club sur fiche native FFF avec nom et URL publique /club/slug (secours UUID). Route source FffClubDetail et native acceptent toutes deux slug/UUID. Les segments sont encodes, origine FootNation fixe ; aucun parametre administratif ajoute au lien.
- Extraction composant PublicLinkShare commun au club et au profil : feuille Share native uniquement au toucher, lien selectionnable permanent, erreur de partage avec indication de copie, annulation web ignoree sans faux succes. Etat reinitialise quand identifiant change.
- Test supplementaire URL club slug/UUID et encodage caracteres de query/chemin. Suite complete 8 coeur + 242 Vitest = 250 tests passes, TypeScript/garde native/formatage passes. Aucun partage reel effectue ; feuille systeme et ouverture sur appareils restent a verifier, associations universelles de domaine toujours non validees.
- Exports Expo Android/iOS/web reussis ; sources synchronisees dans FootNation. Aucune archive installable produite.

### Verification des projets natifs generes — 8 septembre 2026

- Controle EAS CLI 23.2.0 : Not logged in. xcode-select pointe sur /Library/Developer/CommandLineTools, pas Xcode complet ; adb absent du PATH. Aucun build distant lance ni identifiant EAS invente.
- Copie temporaire /private/tmp/footnation-native-preflight-ni7l0qg3 sans .env.local, sans Git ni exports, dependances locales reutilisees. expo prebuild --no-install reussit pour Android et iOS ; dossiers natifs sources et historiques non modifies. Cette verification valide generation/config plugins, pas CocoaPods/Gradle/compilation/signature.
- Inspection AndroidManifest et Info.plist generes : schemas com.footnation.app/footnation presents, permissions camera/micro presentes. Textes iOS finals etaient ceux image-picker et omettaient appels ; harmonises dans les deux plugins pour publications/videos/appels. SecureStore natif utilise WHEN_UNLOCKED_THIS_DEVICE_ONLY sans requireAuthentication ; declaration Face ID anglaise inutile desactivee via faceIDPermission false. Sauvegardes SecureStore laissees configurees par plugin.
- Second prebuild reussi apres correction ; assertions sur Info.plist confirment descriptions camera/micro incluant appels et absence NSFaceIDUsageDescription. Formatage passe. Aucun changement JavaScript fonctionnel ; derniere suite complete 250 tests non reexecutee, pas de nouvel export JS pour ce changement de permissions natives. Les permissions visibles et archives installables doivent encore etre testees sur appareils.

### Connexion : demandes concurrentes — 8 septembre 2026

- Inspection Login : Enter pouvait appeler signInWithPassword pendant une demande deja en cours, avant meme le rendu disabled. Ajout verrou synchrone useRef commun aux deux methodes, libere dans finally apres erreur/succes/annulation Google. Soumission clavier vide ignoree. Verrou local a l instance de cet ecran, ne pretend pas annuler une requete au demontage.
- Etat distingue password/google : indicateur sur bouton reellement utilise, autres actions/edition des identifiants desactivees pendant attente. Inscription et mot de passe oublie ne lancent plus une autre navigation par leurs boutons pendant cette attente. Retour public existant conserve.
- TypeScript, controle JSX natif et formatage passes. Aucun test reproduisant seulement le rendu ajoute ; derniere suite complete 250 tests non reexecutee. Aucun login, OAuth, inscription ou email reel execute pour tester ; verification des appuis repetes avec reseau lent sur appareil reste a effectuer.
- Exports Expo Android/iOS/web reussis ; sources synchronisees dans FootNation. Aucune archive installable produite.

### Verification des parcours de retour dans l apercu — 8 septembre 2026

- Navigation CUA sur localhost:8081, sans saisie ni soumission : login?next=talent/UUID-nul -> bouton inscription -> signup garde next -> J ai deja un compte -> login garde next -> Mot de passe oublie -> reset-password garde next. Arbre accessibilite confirme libelles, champs et boutons de soumission vides desactives.
- Route referral avec next vers UUID-nul, sans apply=1 : bouton Retrouver le profil partage visible ; clic ouvre exactement talent/UUID-nul et etat Profil indisponible attendu. Aucun code applique/cree, partage ou profil reel consulte. Route referral avec next externe https://example.com : aucun bouton de retour propose et aucune navigation externe. Apercu retabli sur fiche fictive.
- Ces verifications prouvent la navigation des boutons dans apercu web, pas la soumission Supabase, OAuth/email, clavier logiciel ou feuille systeme sur appareils. Aucun changement de code pour ce lot ; aucun nouvel export ni repetition des tests unitaires.

### Audit du transport de notifications natives — 8 septembre 2026

- Nouveau audit-native-push.py read-only, sans contenu membre ni tokens : seule table notifications, aucun registre public push/device, aucun trigger utilisateur sur notifications, aucune fonction publique nommee push/notif. Extensions pg_cron/pg_net presentes. Inspection fonction source connection-notifications : email Resend, pas transport push.
- Reference Expo Notifications SDK 57 lue ; projet EAS et configuration native requis pour obtention du token et envoi reel. Application garde son indication d indisponibilite push, aucun changement de preference ni permission demande, aucun envoi effectue.
- docs/native-push-implementation.md consigne les preuves et les etapes completes registre/permissions/file/envoi/recus/revocation/compte/navigation/tests appareils. La presence des extensions ne valide ni planification ni credentials. Backend et client push restent a implementer ; cet audit ne pretend pas les rendre fonctionnels. Aucun export/test applicatif necessaire pour ce lot de lecture et documentation.

### Registre prive des appareils push — 8 septembre 2026

- Migration 55 native_push_registry : table native_push_installations RLS sans droits directs anon/authenticated, acces serveur privilegie. Deux RPC definer search_path vide : inscription compte auth courant, validation token Expo/projet/installation/plateforme, lease serveur neuf, expiration 30 jours, quota 10, renouvellement et transfert atomiques sous verrou transactionnel. Token unique par projet ; possession du token sert de capacite de transfert, pas attestation physique. Identifiant seul ne permet pas de remplacer jeton/projet d un autre compte.
- Revocation uniquement compte courant + installation + lease exact ; ancien lease ne retire pas inscription recente, autre compte refuse, suppression de compte cascade. Aucun trigger sur notifications ni envoi/planification.
- Fixture PostgreSQL jetable native-push-registry.sql passee : token/plateforme invalides, clients directs et anon refuses, ancien lease, autre compte, transfert sans doublon, dates serveur/expiration, suppression, quota et renouvellement a quota. Audit precedent absence registre, garde deployment absence objets. Migration appliquee et journalisee 20260908055000 ; verification distante RLS=true, table vide, droits client directs false, RPC authenticated seuls/definer/search_path vide.
- Copie migration source et synchronisation mobile effectuees. Aucun appareil reel inscrit ni push envoye. Client permissions/inscription/revocation, preferences, worker/tickets/recus et appareils restent a implementer/valider. Aucun changement applicatif, pas de nouveaux exports ou repetition suite JavaScript pour cette migration.

### Protocole de retrait push et adaptateur natif — 9 septembre 2026

- Relecture indépendante du client en cours : révocation avec lease inconnu appelait register, pouvant recréer une inscription après désactivation. Remplacé par UUID d opération durable fourni avant RPC et journal serveur native_push_intents ; reprise sans prolonger, inscription révoquée/remplacée/expirée refusée. Révocation avant inscription et répétée confirmée sans nouvelle inscription. Ancienne RPC register 55 fermée aux clients.
- Migration 56 et fixture conçues/testées par agent de revue, inspectées puis déployées sous garde migration55 présente/registre vide/objets56 absents. Journal 20260909056000 et métadonnées confirmés : deux tables vides, RLS, clients sans droits directs, nouvelles RPC authenticated seules, definer/search_path vide, ancienne RPC non exécutable client. Ne pas modifier migration55/56 ni supprimer les tombstones sans protocole de péremption des requêtes.
- Expo Notifications 57.0.17 installé et plugin couleur FootNation/canal footnation. Adaptateur natif : projet EAS avant permission, canal Android, stockage sécurisé, jeton validé, UUID opération, JWT getUser vérifié puis fixé dans en-tête RPC. Révocation exige data === true ; erreurs locales génériques évitent d afficher le jeton. Version web sans permission. Gestionnaire sérialisé pending/active/revoking, aucun effacement d ancien compte, aucune réinscription pendant retrait.
- Neuf nouveaux tests applicatifs : intention avant réseau, échec stockage, inscription ambiguë, retrait/reprise, concurrence, session, ancien compte/remplacement et perte confirmation. Suite complète 8 cœur + 251 Vitest = 259 tests passée ; TypeScript/garde native/formatage passés. Assertion data de révocation ajoutée après suite, TypeScript revalidé ; aucun nouveau comportement de transport réel testé.
- Prebuild isolé /private/tmp/footnation-push-prebuild-xgp_bbjr sans .env.local et sans installation réussi. Entitlement iOS development, canal/couleur Android vérifiés dans sorties natives. Pas de compilation/signature. UI, préférences, signout/reprise changement de compte, worker et reçus non raccordés ; fonction reste explicitement indisponible. Aucun appareil réel inscrit, aucun push ni email envoyé.
- Exports Expo Android/iOS/web réussis, sources synchronisées dans FootNation et migration56 copiée. Aucune archive installable produite.

### Préférences push et déconnexion sûres — 9 septembre 2026

- L écran Compte et confidentialité raccorde désormais la préférence push à l adaptateur natif. Désactivation : préférence serveur false avant révocation. Activation : inscription de l appareil avant préférence true ; si la sauvegarde finale échoue, tentative de révocation compensatoire. L interface recharge ensuite la valeur serveur et n autorise pas une nouvelle activation lorsque `EXPO_PUBLIC_NATIVE_PUSH_ENABLED` est false. Une valeur déjà active reste désactivable depuis le Web.
- La déconnexion explicite révoque l installation avant `signOut` et conserve la session si la révocation échoue, afin que l utilisateur puisse relancer. La déconnexion obligatoire d un compte suspendu tente la révocation puis ferme toujours la session ; le futur service d envoi devra filtrer les comptes suspendus indépendamment de l état local.
- Ajout de tests unitaires sur ordre des préférences, compensation, échecs de révocation, changements de session avant et après RPC et conservation du journal. Suite complète : 8 tests cœur et 258 Vitest, soit 266 tests passés dans 56 fichiers Vitest. TypeScript, contrôle natif et formatage passés. `expo install --check` confirme l alignement Expo 57.0.21 et Expo Router 57.0.20.
- Export Android/iOS/Web régénéré avec succès. Prebuild isolé `/private/tmp/footnation-prebuild-ThO4hB` réussi après les mises à jour : entitlement iOS `development`, canal Android `footnation` et couleur `#E91E8C` vérifiés. Cela ne constitue ni une compilation Gradle/CocoaPods, ni une signature, ni une livraison sur appareil.
- `npm audit --omit=dev` relève 16 dépendances transitives modérées, zéro haute et zéro critique. Les remédiations forcées proposées rétrograderaient Expo ou Expo Router et casseraient la compatibilité SDK 57 ; elles ne sont pas appliquées. Aucun appareil réel inscrit, aucune permission demandée et aucun push envoyé. Worker, tickets/reçus Expo, credentials APNs/FCM, réception/clic, renouvellement et récupération d un ancien journal restent à réaliser avant activation publique.

### Ouverture vérifiée des notifications push — 9 septembre 2026

- PushResponseBridge est monté dans le layout racine natif et absent du bundle Web. Il traite la dernière réponse au démarrage, les nouveaux clics et une reprise au retour au premier plan. Le handler de premier plan affiche bannière et centre de notifications sans son ni modification automatique du badge.
- Le payload ne peut fournir qu un notificationId UUID. Avant navigation, le client revalide le JWT, exige le même compte, relit la ligne notifications avec id et receiver_id puis normalise uniquement son lien FootNation stocké. Une URL externe est ignorée. Aucun clic ne marque la notification ni une conversation comme lue. Réponse consommée effacée pour éviter une navigation répétée ; erreur réseau conservée pour reprise.
- Quatre tests couvrent identifiant invalide, absence de session, changement de compte, lien FootNation et redirection externe. Suite complète : 8 tests cœur et 262 Vitest, soit 270 tests dans 57 fichiers Vitest. TypeScript, contrôle natif et formatage passent. Exports Android, iOS et Web régénérés après montage réel du pont.
- Le pont reste inactif tant que le flag, le projectId EAS et le transport complet ne sont pas prêts. Aucun push réel, permission, modification de préférence ou lecture automatique n a été déclenché. La file d envoi n est volontairement pas déployée seule afin de ne pas accumuler de tâches sans worker ni reçus.

### Design Instagram et palette de référence — 9 septembre 2026

- Nouvelle direction visuelle demandée par l utilisateur : fond bleu nuit `#151A30`, surfaces `#1C223B`/`#242C48`, dégradé `#4B8DF8` → `#835F9C` → `#E32636`, textes clairs. Boutons principaux arrondis avec voile sombre pour assurer le contraste du texte blanc (4,75:1 au bout bleu). Palette centralisée ; les anciens noms de tokens texte sont conservés pour appliquer le thème aux écrans existants.
- Accueil : en-tête compact, stories rondes, création de publication avec bouton dégradé, onglets Pour vous/Mon réseau et accès Shorts/Clubs. Publications : auteur, média pleine largeur sans recadrage destructif, actions cœur/commentaires/partage/favoris, légendes et hashtags. Les six réactions, la modification et les requêtes existantes sont conservées ; aucun contenu de démonstration ajouté.
- Profil : couverture compacte, avatar superposé, identité et rubriques conservées ; titre de couverture limité à deux lignes et retour disponible sur son propre profil. Réseau : filtres rôle/département repliables, compteur actif, réinitialisation et lignes de membres compactes. Navigation à cinq onglets, libellés lisibles et zones tactiles adaptées aux petits écrans.
- Formulaires, messages reçus, fonds vidéo/stories/appels et états d erreur adaptés au thème sombre. Le QR garde volontairement son tracé foncé sur fond blanc pour la lecture ; le CV imprimé garde sa présentation papier. Barre de statut claire et configuration système sombre.
- Vérifications visuelles dans l aperçu connecté à 390 × 844 et 320 × 740 : accueil, navigation, profil personnel, espace personnel, réseau et filtres, opportunités, clubs, ouverture/fermeture du panneau de réactions. Aucun message, réaction, favori, publication, permission ou modification de profil effectué pour tester. Taille temporaire du navigateur réinitialisée après contrôle.
- Suite complète passée après la refonte principale : 8 tests cœur et 262 Vitest, soit 270 tests dans 57 fichiers Vitest. TypeScript, garde JSX native, formatage et `git diff --check` revalidés après les finitions. Les contrôles de rendu web ne remplacent pas les essais de gestes, clavier et zones système sur appareils.
- Prebuild isolé réussi dans `/private/tmp/footnation-design-prebuild-R2JTrn`, sans fichiers `.env`, installation de dépendances, compilation ou signature. `UIUserInterfaceStyle = Dark` confirmé dans Info.plist ; Android génère `expo_system_ui_user_interface_style = dark` et `activityBackground = #151A30`. Aucun dossier natif historique modifié.
- Exports finaux Android, iOS et Web réussis ; sources synchronisées dans `footzone-main/mobile-expo`. Aucune archive installable produite pour cette refonte visuelle.

### Qualité mobile, hors ligne et suivi des erreurs — 9 septembre 2026

- Harmonisation des composants partagés : titres accessibles, boutons avec noms stables et états busy/disabled, contrôles de 44 points minimum, champs nommés, filtres avec nom et valeur, cases cochées et picker sombre. Compensation clavier iOS partagée et listes de recherche, Login sans double compensation, parcours Suivant dans connexion/inscription. Navigation ajustée sous 360 points.
- Fil et profils : lecteur vidéo monté seulement lorsqu il est visible, un lecteur maximum par liste, libéré hors page et en arrière-plan, position conservée pendant la vie du parent. Shorts garde son seul lecteur visible. Chargement vidéo par replaceAsync, état attente/erreur et réessai ; pagination du fil/Shorts protégée contre doublons, concurrence et répétition automatique après échec. Photos, contenus, réactions et parcours Replay conservés.
- Expo Network 57.0.1 raccorde onlineManager et focusManager. Bannière hors ligne, cache en mémoire visible et reprise des lectures. MutationCache refuse les écritures connues hors ligne avant mutationFn ; networkMode always + retry false empêchent la file de publication différée. Les écritures déjà envoyées restent du ressort de leur protocole existant.
- Auth : mémoire de profil par compte, état unverified distinct de missing, profil validé conservé pendant la coupure, vérification après reconnexion, invalidation des générations au changement de compte. Suspension confirmée masque l accès et efface le cache ; après attente de révocation, la déconnexion vérifie à nouveau le compte courant. Aucun cache persistant ajouté.
- Sentry React Native ~7.11.0 aligné SDK57 : erreurs JS non interceptées, rendu/routes, React Query, profil et vidéo raccordés. Collecte désactivée sans DSN + flag explicite et en développement. Filtre par liste de champs autorisés sans données membres, messages, variables, URLs complètes ou journaux ; Debug IDs normalisés avec les frames, déduplication et plafond 20/minute. Transport natif désactivé, donc aucun crash OS suivi dans ce lot. Échec du SDK sans effet sur la navigation.
- Configuration conditionnelle app.config.js et Metro ; contrôle de build exige DSN/org/projet/jeton si collecte activée, valeurs masquées. Aucun compte/projet Sentry, alerte, token ou envoi distant configuré. La réception et la symbolication réelles restent à valider avant activation. Voir docs/error-monitoring.md.
- 318 tests passés (8 cœur + 310 Vitest, 62 fichiers), TypeScript/garde JSX/formatage/diff passés, dépendances Expo alignées. Tests ajoutés sur les courses réseau, écritures sans rejeu, isolation du profil, pagination/vidéos et filtrage/activation Sentry. Aucun compte, message, réaction, publication ou permission réelle modifié pour tester.
- CUA à 320 × 740 et 390 × 844 : opportunités, formulaire de publication, filtres réseau et focus de fenêtre de choix ; mesure des commandes. Dans le fil, zéro vidéo hors écran, un lecteur visible chargé et en pause, puis zéro après retour en haut. Réglage de viewport réinitialisé et onglet temporaire fermé. Le contrôle iOS/Android réel est listé dans docs/mobile-quality.md ; simctl et adb indisponibles ici.
- Exports Android/iOS/Web réussis. Prebuilds isolés dans /private/tmp/footnation-final-native-prebuild-k6zosJ : iOS Dark ; Android adjustResize/dark/fond #151A30 ; Expo Network autolinké. Flag Sentry absent sans hooks, flag activé avec placeholders non secrets produit scripts Gradle/Xcode ; aucun upload/pod install/build/signature. Dossiers natifs historiques inchangés.
- Source maps Web générées en contrôle local dans /tmp/footnation-monitoring-maps.oPpP8n : même Debug ID dans bundle/map confirmé, aucun upload. Frontière de récupération écran conservée sous AuthProvider pour maintenir l invalidation lors des changements de compte ; QueryClient attaché au montage du layout pour repartir avec un cache neuf après récupération de toute la racine.

### Nouvelle capture Instagram — 9 septembre 2026, 20 h 37

La nouvelle référence remplace la direction sombre précédente : fond blanc, texte noir, en-tête « Pour vous » avec choix du fil, bouton +, cœur des notifications, stories de 90 points et publications bord à bord avec auteur superposé. Le dégradé bleu-violet-rouge de FootNation reste utilisé pour les accents. Aucun faux compte ou contenu Instagram n'est ajouté.

La barre flottante ouvre Accueil, Shorts, Messages, Explorer et Mon profil. Explorer et le menu du profil conservent les accès Réseau, Opportunités et Clubs ; les URL publiques sont inchangées. Le clavier masque la barre et supprime la réserve de hauteur, sans compter deux fois la zone sûre inférieure. Expo Blur utilise une cible par écran sur iOS et Android 12+, avec repli translucide sur les anciens Android et fond opaque si l'option iOS de réduction de transparence est activée.

Contrôles Web réalisés à 320 × 740 et 390 × 844 : proportions, choix du fil, destinations, recherche de messages avec saisie séquentielle et focus conservé, états accessibles des onglets et libération du lecteur en quittant Shorts. Les dossiers natifs locaux ont été régénérés en thème clair. Le prebuild et l'autolinking ont aussi été vérifiés isolément, sans secrets ni installation. Voir `docs/mobile-quality.md` pour les validations et les essais restant sur appareils.

### Invitation du réseau après authentification — 9 septembre 2026, 21 h 16

Écran natif inspiré de la capture : header bleu vers navy, badge, lien personnel sélectionnable, Copier/Partager, WhatsApp/Facebook/Instagram/TikTok/SMS/Autre et sortie libre. Présentation après connexion explicite réussie ou confirmation d’inscription, une fois le profil complété. Dédoublonnage du double retour OAuth ; pas de nouveau prompt sur renouvellement de jeton ou restauration de session. Récupération du mot de passe, formulaires de compte et appels prioritaires. Accès manuel ajouté à Mon espace et Parrainage.

Le lien UUID conserve l’inscription et l’attribution du site sans créer de code à l’affichage. Expo Clipboard ajouté ; les partages restent des actions explicites du membre dans les applications choisies. Aucun envoi, compte de test, attribution distante ou déploiement réalisé pour vérifier cette fonctionnalité. Les récompenses non implémentées ne sont pas promises. 364 tests, TypeScript, garde native et prebuild local validés ; détails de la recette Web et des essais appareils dans `docs/mobile-quality.md`.

### Ballon en rotation sphérique — 9 septembre 2026, 21 h 23

L’icône Accueil devient un ballon de 34 points aux drapeaux FootNation. Une géométrie de 32 panneaux est projetée sur une sphère, animée sur l’axe vertical avec Reanimated ; les surfaces arrière sont masquées, la lumière et l’ombre restent fixes. Cette version remplace le premier essai de rotation plane. Le ballon conserve la navigation et son libellé accessible, attend la préférence Réduire les animations et s’arrête en arrière-plan. Aucun module ou service externe ajouté pour ce rendu.

Six tests géométriques supplémentaires passent, soit 370 tests au total avec les changements d’invitation. Vérification visuelle à taille réelle dans l’aperçu Web ; performances et préférences système à confirmer sur iPhone et Android.

La sélection de motifs est ensuite limitée à la liste fournie par le propriétaire : France prioritaire, Bosnie, Algérie, Europe, Angleterre, Brésil et Argentine. La France reste centrale au démarrage et plus fréquente ; l’Angleterre porte sa croix rouge sur blanc et la Bosnie son triangle jaune et ses étoiles sur bleu. Les autres drapeaux du premier rendu sont retirés.

Quatre tests ciblés supplémentaires valident cette sélection, les motifs et leur confinement aux panneaux. La suite complète passe à 374 tests (8 cœur + 366 Vitest), avec TypeScript, garde native et formatage validés. France sur 15 des 32 panneaux ; revue indépendante et aperçu visuel confirmés.

### Navigation orientée publication — 9 septembre 2026, 22 h 03

Nouvel ordre : Accueil avec le ballon, Shorts, gros bouton « + », Recherche, Mon profil. Le bouton central ouvre l’éditeur existant `/compose`, sans nouvel onglet fictif. Messages conserve sa route et son entrée dans Mon espace. L’onglet personnel ouvre le compte connecté et utilise sa photo lorsqu’elle est disponible, avec repli sur l’icône si elle manque ou ne charge pas ; un profil d’un autre compte n’est jamais utilisé comme avatar de navigation.

Contrôles Web à 320 et 390 px, cibles de 52 × 49 px minimum à 320, accès à l’éditeur puis retour sans publication, profil personnel et recherche vérifiés. TypeScript, formatage et garde native validés. Aucun profil, message ou contenu publié pour tester.

### Raccourcis de l’accueil — 9 septembre 2026

Bouton Opportunité en haut à gauche, Messagerie et burger vers Mon espace en haut à droite. Le fil et ses notifications restent sur une seconde ligne. Les trois routes existantes sont conservées ; aucun service ni dépendance ajouté. Menu du fil borné à la hauteur disponible et défilable sur écran court. Contrôles des destinations à 320/390 px et de la sélection du fil en paysage à 740 × 320 ; cibles de 44 px minimum. Détails dans `docs/mobile-quality.md`.

Retouche suivante : suppression du texte visible Messagerie, icônes messages/notifications/burger de 24 points réunies sur la ligne d’Opportunité, fil centré seul dessous. Bandeau ramené à 98 points hors zone sûre à taille de texte standard, tout en gardant les cibles de 44 points et les libellés accessibles. Vérification visuelle Web à 320/390 px, destinations et menu du fil contrôlés sans écriture distante.

### Fil plein écran et menu du compte — 9 septembre 2026

Le fil connecté présente une publication par écran après l’introduction regroupant le bandeau et les stories. Snap natif par offsets et Web sur cellules explicites ; hauteur mesurée, ancrage par identifiant conservé à la rotation/actualisation, texte intégral dans une feuille et commandes compactes en paysage. Une seule vidéo peut être active ; les feuilles/menu suspendent son affichage. Le rendu standard des autres listes est conservé.

Le burger Accueil/Profil ouvre le panneau latéral de compte inspiré des deux captures : identité, série de connexions et vues réelles, partage/invitation, sept raccourcis, réseau/opportunités/notifications, paramètres/déconnexion. Les autres outils restent disponibles. Aucune valeur de démonstration, récompense fictive ou nouvelle écriture de statistique. Partage natif avec repli copie Web et gestion des annulations. Suite complète de 382 tests et contrôles statiques validés ; recette Web et limites sur appareils détaillées dans `docs/mobile-quality.md`.

### Matchs et profils dans l’accueil — 9 septembre 2026

Bandeau de scores des grands clubs au-dessus des stories : directs, résultats récents, horaires, accès au détail daté. Correction du paramètre date du service FootNation (GET avec query string) et de la lecture des statuts terminaux. Le secours SportsDB du service ne couvre que quelques rencontres par jour sur les dates contrôlées ; un adaptateur ESPN public complète les grands championnats européens sans clé ni dépendance. Le résultat d’un fournisseur n’est jamais converti en zéro par défaut. Les fiches ESPN ne présentent pas de sondage FootNation puisque ces identifiants n’existent pas dans les sondages du backend.

Profils réels et stories regroupées par auteur, expiration vérifiée localement, actions distinctes avatar/nom/ajout, priorité aux membres avec photo et nom renseigné. Les lectures suivent la session, les blocages dans les deux sens, la confidentialité et les suspensions ; aucune story ni récompense fictive. L’exception administrateur des règles de visibilité du backend reste inchangée.

À la demande suivante, les abréviations des clubs sont remplacées par leurs logos avec repli en cas d’image absente. Défilement continu à 22 points/seconde, pause/reprise et glissement manuel ; la boucle et son retour au début ont été constatés dans l’aperçu Web. Respect de la réduction des animations, pause au focus, à la manipulation et lorsque l’introduction n’est plus visible. Les 454 tests passent, ainsi que TypeScript, le garde natif, le formatage et les exports Android/iOS/Web. Les vérifications sur téléphones restent à effectuer.

### Thèmes et contenu d’abord — 10 septembre 2026

La dernière planche « DO / DON’T » remplace la disposition précédente : retrait de l’opportunité isolée en haut et de la rangée de cinq filtres. Pour vous / Mon réseau précèdent les stories compactes ; la première publication partage le premier écran avec cette introduction. Les scores défilants arrivent après elle, au-dessus de la publication suivante. Opportunités, Clubs et les autres outils restent accessibles depuis Explorer et le menu du compte. Les icônes de navigation demandées sont conservées.

Palette claire/sombre, polices Inter locales, fournisseur de thème avec préférence persistée sur l’appareil et sélecteur dans Compte et confidentialité. Les écrans/components consomment le thème par hooks ; aucune identité de composant, donnée membre ou mutation métier n’est remplacée pour changer d’apparence. Configuration Expo et projets natifs synchronisés sur `automatic`. Une nouvelle compilation native est nécessaire pour prendre en compte la configuration iOS/Android.
