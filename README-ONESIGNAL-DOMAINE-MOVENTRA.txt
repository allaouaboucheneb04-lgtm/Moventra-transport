CORRECTION ONESIGNAL — DOMAINE PERSONNALISÉ MOVENTRA

Cette version utilise le domaine à la racine :
https://moventra.ca

Fichiers OneSignal attendus :
https://moventra.ca/OneSignalSDKWorker.js
https://moventra.ca/OneSignalSDKUpdaterWorker.js

Réglages OneSignal obligatoires :
1. Ouvrir l’application OneSignal utilisée par Moventra.
2. Settings > Push & In-App > Web Settings.
3. Site URL : https://moventra.ca
   IMPORTANT : utiliser exactement l’origine réellement affichée dans l’application.
   Si le site redirige vers https://www.moventra.ca, mettre cette adresse et non moventra.ca.
4. Service worker path/filename : OneSignalSDKWorker.js à la racine.
5. Registration scope : /
6. Enregistrer les réglages.

Test iPhone :
1. Supprimer l’ancienne icône de l’écran d’accueil.
2. Ouvrir https://moventra.ca/login.html dans Safari.
3. Partager > Sur l’écran d’accueil.
4. Ouvrir l’icône installée.
5. Appuyer une fois sur la cloche.

Si aucune boîte iOS ne s’affiche encore, ouvrir :
https://moventra.ca/onesignal-check.html
et vérifier que OneSignalSDKWorker.js retourne 200 OK.
