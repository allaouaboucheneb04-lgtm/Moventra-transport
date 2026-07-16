import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig, ROLES_COLLECTION } from "./firebase-config.js";

const INVITES_COLLECTION = "invites";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const params = new URLSearchParams(location.search);
const code = (params.get("code") || "").trim().toUpperCase();

const info = document.getElementById("inviteInfo");
const form = document.getElementById("inviteSignupForm");
const statusEl = document.getElementById("status");
const btn = document.getElementById("createBtn");

let invite = null;

async function loadInvite() {
  if (!code) {
    info.textContent = "Lien d’invitation invalide.";
    return;
  }

  const snap = await getDoc(doc(db, INVITES_COLLECTION, code));

  if (!snap.exists()) {
    info.textContent = "Invitation introuvable ou expirée.";
    return;
  }

  invite = snap.data();

  if (invite.status === "accepted") {
    info.textContent = "Cette invitation a déjà été utilisée.";
    return;
  }

  info.textContent = `Invitation pour ${invite.name || invite.email}. Créez votre mot de passe.`;
  document.getElementById("name").value = invite.name || "";
  document.getElementById("email").value = invite.email || "";
  form.hidden = false;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  btn.disabled = true;
  btn.textContent = "Création...";
  statusEl.textContent = "";

  try {
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value;

    if (email !== String(invite.email || "").toLowerCase()) {
      throw new Error("Email différent de l’invitation.");
    }

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });

    await setDoc(doc(db, ROLES_COLLECTION, cred.user.uid), {
      name,
      email,
      role: "employe",
      active: true,
      inviteCode: code,
      createdAt: serverTimestamp()
    });

    await updateDoc(doc(db, INVITES_COLLECTION, code), {
      status: "accepted",
      acceptedAt: serverTimestamp(),
      uid: cred.user.uid
    });

    statusEl.textContent = "✅ Compte créé. Redirection...";
    statusEl.style.color = "#078b45";

    setTimeout(() => window.location.href = "employe.html", 900);
  } catch (error) {
    console.error(error);
    statusEl.textContent = "❌ Impossible de créer le compte. Email déjà utilisé ou invitation invalide.";
    statusEl.style.color = "#d21f3c";
  } finally {
    btn.disabled = false;
    btn.textContent = "Créer mon compte";
  }
});

loadInvite();
