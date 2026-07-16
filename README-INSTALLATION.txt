MOVENTRA — INSTALLATION

1) GitHub Pages
- Téléverser le CONTENU de ce dossier à la racine du dépôt Moventra-transport.

2) Firebase Authentication
- Activer Email/Mot de passe.
- Créer le compte admin.
- Dans Firestore, créer utilisateurs/{UID_ADMIN} avec :
  role: "admin"
  email: "adresse-admin"
  actif: true

Pour un employé : créer son compte Authentication puis utilisateurs/{UID} avec role: "employe".

3) Firestore
- Publier le fichier firestore.rules fourni.

4) OneSignal automatique lors d’une soumission
- Installer Firebase CLI sur un ordinateur.
- Dans le dossier : firebase login
- firebase use moventra-fe20f
- firebase functions:secrets:set ONESIGNAL_REST_API_KEY
- Coller la REST API Key PRIVÉE de l’application OneSignal Moventra.
- npm install --prefix functions
- firebase deploy --only functions,firestore:rules

IMPORTANT : ne jamais mettre la REST API Key OneSignal dans GitHub.
Le code public contient seulement l’App ID public, ce qui est normal.

5) iPhone
- Supprimer les anciennes icônes Didier/Moventra.
- Ouvrir le site dans Safari, puis Partager > Sur l’écran d’accueil.
- Ouvrir Moventra Admin et cliquer sur Notifications.
