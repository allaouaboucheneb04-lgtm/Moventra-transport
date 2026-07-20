MOVENTRA — CONFIGURATION ONESIGNAL PROPRE

Domaine : https://www.moventratransport.ca
App ID : b7dc3eab-b127-47dd-9ad4-71295880fd34
Worker : https://www.moventratransport.ca/OneSignalSDKWorker.js
Scope : /
Build : onesignal-clean-20260719-1

Fichiers actifs :
- push.js : unique initialisation et abonnement
- OneSignalSDKWorker.js : worker officiel v16
- admin-nav.js : cloche et notifications internes
- debug.html : diagnostic en lecture seule

Dans OneSignal > Web Settings :
- Site URL : https://www.moventratransport.ca
- Service worker filename : OneSignalSDKWorker.js
- Registration scope : /

Après publication : supprimer l’ancienne icône, nettoyer les données Safari du domaine, ouvrir /login.html, ajouter à l’écran d’accueil et tester la cloche.
