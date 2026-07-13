import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const PROFILE_COLLECTIONS = ["users", "utilisateurs", "employes"];

sessionStorage.removeItem("moventra_admin_verified");
try {
  await setPersistence(auth, browserSessionPersistence);
} catch (error) {
  console.warn("Persistance Firebase", error);
}

const form = document.getElementById("loginForm");
const statusEl = document.getElementById("status");
const btn = document.getElementById("loginBtn");

async function findProfile(uid) {
  let lastPermissionError = null;
  for (const collectionName of PROFILE_COLLECTIONS) {
    try {
      const snap = await getDoc(doc(db, collectionName, uid));
      if (snap.exists()) return { collectionName, data: snap.data() };
    } catch (error) {
      if (error?.code === "permission-denied") lastPermissionError = error;
      else console.warn(`Lecture ${collectionName}`, error);
    }
  }
  if (lastPermissionError) throw lastPermissionError;
  return null;
}

function friendlyError(error) {
  const code = error?.code || "";
  if (code === "auth/unauthorized-domain") {
    return "Domaine non autorisé dans Firebase. Ajoute allaouaboucheneb04-lgtm.github.io dans Authentication → Paramètres → Domaines autorisés.";
  }
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
    return "Email ou mot de passe incorrect.";
  }
  if (code === "auth/too-many-requests") return "Trop de tentatives. Attends quelques minutes puis réessaie.";
  if (code === "auth/network-request-failed") return "Problème de connexion Internet.";
  if (code === "permission-denied") return "Connexion réussie, mais Firestore refuse l’accès au profil. Publie les règles Firestore Moventra.";
  return `Erreur de connexion${code ? ` (${code})` : ""}.`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusEl.textContent = "";
  btn.disabled = true;
  btn.textContent = "Connexion...";

  try {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const cred = await signInWithEmailAndPassword(auth, email, password);
    const found = await findProfile(cred.user.uid);

    if (!found) {
      statusEl.textContent = `Compte connecté, mais aucun profil trouvé avec l’UID ${cred.user.uid}. Crée le document dans users (ou utilisateurs) avec cet UID.`;
      statusEl.style.color = "#d21f3c";
      return;
    }

    const profile = found.data;
    if (profile.active === false || profile.actif === false) {
      statusEl.textContent = "Ce compte est désactivé.";
      statusEl.style.color = "#d21f3c";
      return;
    }

    const role = String(profile.role || "").toLowerCase();
    sessionStorage.setItem("moventra_profile_collection", found.collectionName);
    sessionStorage.setItem("moventra_admin_verified", JSON.stringify({ uid: cred.user.uid, role, at: Date.now() }));

    if (role === "admin") {
      window.location.replace("admin.html?v=loginfix-20260713-1");
    } else if (role === "employe" || role === "employee") {
      window.location.replace("employe.html?v=loginfix-20260713-1");
    } else {
      statusEl.textContent = `Rôle non autorisé : ${profile.role || "vide"}.`;
      statusEl.style.color = "#d21f3c";
    }
  } catch (error) {
    console.error("Connexion Moventra", error);
    statusEl.textContent = friendlyError(error);
    statusEl.style.color = "#d21f3c";
  } finally {
    btn.disabled = false;
    btn.textContent = "Se connecter";
  }
});
