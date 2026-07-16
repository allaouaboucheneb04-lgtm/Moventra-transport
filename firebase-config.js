export const firebaseConfig = {
  apiKey: "AIzaSyBeDOLjFyONjv06dUc4b_R0lQ4AlSBPU2U",
  authDomain: "moventra-fe20f.firebaseapp.com",
  projectId: "moventra-fe20f",
  storageBucket: "moventra-fe20f.firebasestorage.app",
  messagingSenderId: "634208041846",
  appId: "1:634208041846:web:37bf64bed692efd5f31857",
  measurementId: "G-N0LFJ6JQXB"
};

export const ROLES_COLLECTION = "users";
export const QUOTES_COLLECTION = "demandes_soumission";
export const TASKS_COLLECTION = "taches";


// IMPORTANT: Remplace par ta clé VAPID Firebase Cloud Messaging.
// Firebase Console > Project settings > Cloud Messaging > Web Push certificates > Generate key pair

export const VAPID_KEY = ""; // À générer dans Firebase Moventra si FCM est utilisé
