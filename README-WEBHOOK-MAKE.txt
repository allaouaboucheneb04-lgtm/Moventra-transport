MOVENTRA — NOTIFICATIONS SANS PC AVEC MAKE + ONESIGNAL
======================================================

Cette version n'expose PAS la clé privée OneSignal dans GitHub.
Le site enregistre d'abord la soumission dans Firestore, puis l'envoie à un webhook Make.
Make garde la clé privée OneSignal et envoie la notification.

ÉTAPE 1 — CRÉER LE WEBHOOK MAKE
1. Dans Make, crée un nouveau scénario.
2. Ajoute « Webhooks ».
3. Choisis « Custom webhook ».
4. Clique « Add », nomme-le « Moventra - nouvelles soumissions ».
5. Copie l'URL générée (elle commence par https://hook...).

ÉTAPE 2 — METTRE L'URL DANS LE SITE
1. Ouvre le fichier webhook-config.js.
2. Colle l'URL entre les guillemets :
   window.MOVENTRA_WEBHOOK_URL = "https://hook.us2.make.com/TON_URL";
3. Publie les fichiers sur GitHub Pages.

ÉTAPE 3 — FAIRE RECEVOIR UN EXEMPLE À MAKE
1. Dans Make, clique « Run once ».
2. Ouvre le site Moventra et envoie une soumission test.
   OU ouvre webhook-test.html et clique « Envoyer un test ».
3. Make détectera les champs : nom, telephone, service, depart, destination, etc.

ÉTAPE 4 — AJOUTER ONESIGNAL DANS MAKE
Méthode universelle recommandée : module HTTP.
1. Après le webhook, clique + puis ajoute « HTTP > Make a request ».
2. URL : https://api.onesignal.com/notifications
3. Method : POST
4. Headers :
   Authorization = Key TA_REST_API_KEY_ONESIGNAL_MOVENTRA
   Content-Type = application/json
5. Body type : Raw
6. Content type : application/json
7. Body :
{
  "app_id": "a6edf32a-9d3b-4fce-ad98-0c5ccfc43672",
  "included_segments": ["Subscribed Users"],
  "headings": {"fr": "Nouvelle soumission Moventra"},
  "contents": {"fr": "{{1.nom}} — {{1.service}} — {{1.telephone}}"},
  "url": "https://www.moventratransport.ca/admin.html"
}

IMPORTANT : Dans Make, insère les champs reçus du webhook avec l'outil de mapping au lieu de taper littéralement {{1.nom}} si Make utilise un autre numéro de module.

ÉTAPE 5 — TESTER ET ACTIVER
1. Clique « Run once ».
2. Envoie une nouvelle soumission.
3. Vérifie que la notification affiche « Nouvelle soumission Moventra ».
4. Active le scénario (ON).
5. Choisis « Immediately as data arrives » si Make le propose.

SÉCURITÉ
- Ne mets jamais la REST API Key OneSignal dans GitHub, index.html, app.js ou webhook-config.js.
- La configuration Firebase Web visible dans firebase-config.js n'est pas une clé serveur privée.
- Révoque toute ancienne clé OneSignal Didier qui aurait été publiée.

FICHIERS UTILES
- webhook-config.js : URL du webhook Make uniquement.
- webhook-test.html : test sans créer de vraie soumission.
- app.js : enregistre Firestore puis appelle Make.
