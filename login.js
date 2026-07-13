import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig, ROLES_COLLECTION } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Une ouverture directe de l’application doit toujours repasser par l’écran de connexion.
sessionStorage.removeItem("moventra_admin_verified");
try {
  await setPersistence(auth, browserSessionPersistence);
  if (auth.currentUser) await signOut(auth);
} catch (error) {
  console.warn("Initialisation connexion", error);
}

const form = document.getElementById("loginForm");
const statusEl = document.getElementById("status");
const btn = document.getElementById("loginBtn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusEl.textContent = "";
  btn.disabled = true;
  btn.textContent = "Connexion...";

  try {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const cred = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, ROLES_COLLECTION, cred.user.uid));

    if (!userDoc.exists()) {
      statusEl.textContent = "Compte connecté, mais aucun rôle trouvé. Ajoute ce UID dans users.";
      statusEl.style.color = "#d21f3c";
      return;
    }

    const profile = userDoc.data();
    if (profile.role === "admin") {
      sessionStorage.setItem("moventra_admin_verified", JSON.stringify({ uid: cred.user.uid, role: "admin", at: Date.now() }));
      window.location.replace("admin.html?v=adminfix-20260713-1");
    } else if (profile.role === "employe") {
      sessionStorage.setItem("moventra_admin_verified", JSON.stringify({ uid: cred.user.uid, role: "employe", at: Date.now() }));
      window.location.href = "employe.html";
    } else {
      statusEl.textContent = "Rôle non autorisé.";
      statusEl.style.color = "#d21f3c";
    }
  } catch (error) {
    console.error(error);
    statusEl.textContent = "Erreur de connexion. Vérifie email / mot de passe.";
    statusEl.style.color = "#d21f3c";
  } finally {
    btn.disabled = false;
    btn.textContent = "Se connecter";
  }
});
