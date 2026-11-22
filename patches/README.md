# Navigation iOS — react-native-screens 4.26.2

`react-native-screens-4.26.2-ios-touch.patch` reprend intégralement les trois
fichiers natifs du [correctif officiel #4407](https://github.com/software-mansion/react-native-screens/pull/4407)
pour le [blocage tactile #4361](https://github.com/software-mansion/react-native-screens/issues/4361).
Seuls les chemins `ios/legacy/` sont adaptés en `ios/` pour la version 4.26.2.
Le code reste sous la licence MIT de react-native-screens.

Lors d’un retour de pile combiné à un changement d’onglet, remplacer la vue du
contrôleur UIKit par une capture peut laisser l’ancienne vue au-dessus du contenu
et absorber les appuis. Le correctif conserve la vue et y ajoute la capture,
en respectant sa durée de vie jusqu’à la fin de la transition.

`postinstall` applique le patch local, vérifie son résultat et refuse une version
ou des sources inattendues. Il s’exécute aussi lors de `npm ci` dans EAS et le
workflow de compilation gratuit. Aucun téléchargement n’est effectué par ce script.
Retirer ce backport quand une version compatible Expo inclut le correctif amont.

Il faut **recompiler iOS** ; une mise à jour JavaScript ne modifie pas cette partie
native. Le cas d’origine doit être vérifié sur un iPhone physique : les mainteneurs
indiquent que leur scénario n’est pas reproduit de façon fiable en simulateur.
