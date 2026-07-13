CORRECTION ONESIGNAL GITHUB PAGES

Le chemin du service worker OneSignal doit être fourni sans slash initial :
Moventra-transport/OneSignalSDKWorker.js

Scope : /Moventra-transport/

Après publication :
1. Ouvrir reset-cache.html et nettoyer les anciens service workers.
2. Supprimer puis réajouter l’application à l’écran d’accueil.
3. Dans OneSignal > Web Configuration, régler Path to service worker files sur /Moventra-transport/ si ce champ est affiché.
