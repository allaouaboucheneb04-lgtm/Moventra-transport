import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, doc, getDoc, collection, getDocs,
  updateDoc, serverTimestamp, query, where, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig, ROLES_COLLECTION, TASKS_COLLECTION } from "./firebase-config.js";
import { initNotifications, showLocalNotification } from "./notifications.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

const $ = (id) => document.getElementById(id);

onAuthStateChanged(auth, async (user) => {
  if (!user) return window.location.href = "login.html";

  currentUser = user;
  $("employeeEmail").textContent = user.email || user.uid;

  const roleSnap = await getDoc(doc(db, ROLES_COLLECTION, user.uid));
  if (!roleSnap.exists() || roleSnap.data().role !== "employe") {
    alert("Accès employé refusé.");
    return window.location.href = "login.html";
  }

  await loadTasks();
  await loadProfile();
  setupEmployeeRealtimeNotifications();

  const notifBtn = document.getElementById("enableNotificationsBtn");
  if (notifBtn) notifBtn.onclick = () => initNotifications(app, db, user, "employe");
});

$("logoutBtn").onclick = async () => {
  await signOut(auth);
  window.location.href = "login.html";
};

$("refreshTasks").onclick = loadTasks;

async function loadTasks() {
  const list = $("tasksList");
  list.innerHTML = "<p>Chargement...</p>";

  const snap = await getDocs(query(collection(db, TASKS_COLLECTION), where("employeeId", "==", currentUser.uid)));
  const tasks = [];
  snap.forEach((d) => {
    const data = d.data();
    if (data.status !== "terminé") {
      tasks.push({ id: d.id, ...data });
    }
  });

  if (!tasks.length) {
    list.innerHTML = "<p>Aucun travail assigné pour le moment.</p>";
    return;
  }

  list.innerHTML = tasks.map(taskCard).join("");

  list.querySelectorAll("[data-status]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const note = document.querySelector(`[data-note="${btn.dataset.task}"]`)?.value || "";
      const updateData = {
        status: btn.dataset.status,
        notes: note,
        updatedAt: serverTimestamp()
      };

      if (btn.dataset.status === "terminé") {
        updateData.completedAt = serverTimestamp();
      }

      await updateDoc(doc(db, TASKS_COLLECTION, btn.dataset.task), updateData);
      await loadTasks();
    });
  });
}

function taskCard(t) {
  const isStarted = t.status === "en cours";
  const mainButtonLabel = isStarted ? "Terminé" : "Commencer";
  const mainButtonStatus = isStarted ? "terminé" : "en cours";

  return `
    <article class="adminCard">
      <div class="cardTop">
        <h3>${escapeHtml(t.clientName || "Client")}</h3>
        <span class="status">${escapeHtml(t.status || "assigné")}</span>
      </div>
      <p><b>Service:</b> ${escapeHtml(t.service || "-")}</p>
      <p><b>Adresse:</b> ${mapLink(t.address)}</p>
      <p><b>Date:</b> ${escapeHtml(t.date || "-")}</p>
      <p><b>Téléphone:</b> <a href="tel:${escapeHtml(t.phone || "")}">${escapeHtml(t.phone || "-")}</a></p>
      <p><b>Message:</b> ${escapeHtml(t.message || "-")}</p>

      <label class="noteLabel">Note employé
        <textarea data-note="${t.id}" placeholder="Ajouter une note...">${escapeHtml(t.notes || "")}</textarea>
      </label>

      <div class="assignRow oneButton">
        <button class="smallBtn ${isStarted ? "ok" : ""}" data-task="${t.id}" data-status="${mainButtonStatus}">
          ${mainButtonLabel}
        </button>
      </div>
    </article>
  `;
}


function phoneLink(phone) {
  if (!phone) return "-";
  const clean = String(phone).replace(/[^\d+]/g, "");
  return `<a href="tel:${clean}">${escapeHtml(phone)}</a>`;
}

function mapLink(address) {
  if (!address) return "-";
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return `<a href="${url}" target="_blank" rel="noopener">${escapeHtml(address)}</a>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}


let firstEmployeeSnapshot = true;

function setupEmployeeRealtimeNotifications() {
  try {
    const q = query(
      collection(db, TASKS_COLLECTION),
      where("employeeId", "==", currentUser.uid)
    );

    onSnapshot(q, (snap) => {
      if (firstEmployeeSnapshot) {
        firstEmployeeSnapshot = false;
        return;
      }

      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          const t = change.doc.data();
          showLocalNotification(
            "Nouveau travail assigné",
            `${t.service || "Service"} - ${t.address || "Adresse"}`
          );
          loadTasks();
        }

        if (change.type === "modified") {
          loadTasks();
        }
      });
    });
  } catch (error) {
    console.error("Realtime employee notification error:", error);
  }
}

window.addEventListener("load", () => {
  const b = document.getElementById("enableNotificationsBtn");
  if (b) {
    b.addEventListener("click", (e) => {
      if (window.didierEloEnablePush) {
        e.preventDefault();
        window.didierEloEnablePush();
      }
    }, true);
  }
});

// ========== PROFIL EMPLOYÉ ==========

async function loadProfile() {
  try {
    const snap = await getDoc(doc(db, ROLES_COLLECTION, currentUser.uid));
    if (!snap.exists()) return;
    const data = snap.data();

    // Remplir la vue
    setText("viewName", data.name || "Non renseigné");
    setText("viewPhone", data.phone || "Non renseigné");
    setText("viewAddress", data.address || "Non renseigné");
    setText("viewTransport", data.transport || "Non renseigné");
    setText("viewZone", data.zone || "Non renseigné");
    setText("viewAvailability", data.availability || "Non renseigné");

    // Remplir le formulaire
    setVal("profileName", data.name || "");
    setVal("profilePhone", data.phone || "");
    setVal("profileAddress", data.address || "");
    setVal("profileTransport", data.transport || "");
    setVal("profileZone", data.zone || "");
    setVal("profileAvailability", data.availability || "");
    setVal("profileNote", data.employeeNote || "");
  } catch(e) {
    console.warn("loadProfile", e);
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

// Bouton Modifier
const editProfileBtn = document.getElementById("editProfileBtn");
if (editProfileBtn) {
  editProfileBtn.onclick = () => {
    document.getElementById("profileView").style.display = "none";
    document.getElementById("profileForm").style.display = "block";
    editProfileBtn.style.display = "none";
  };
}

// Bouton Annuler
const cancelProfileBtn = document.getElementById("cancelProfileBtn");
if (cancelProfileBtn) {
  cancelProfileBtn.onclick = () => {
    document.getElementById("profileView").style.display = "block";
    document.getElementById("profileForm").style.display = "none";
    document.getElementById("editProfileBtn").style.display = "";
  };
}

// Sauvegarder profil
const profileForm = document.getElementById("profileForm");
if (profileForm) {
  profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = document.getElementById("profileStatus");
    status.textContent = "Sauvegarde...";
    status.style.color = "#006bd6";

    try {
      const profileData = {
        name: document.getElementById("profileName").value.trim(),
        phone: document.getElementById("profilePhone").value.trim(),
        address: document.getElementById("profileAddress").value.trim(),
        transport: document.getElementById("profileTransport").value,
        zone: document.getElementById("profileZone").value,
        availability: document.getElementById("profileAvailability").value,
        employeeNote: document.getElementById("profileNote").value.trim(),
        profileUpdatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, ROLES_COLLECTION, currentUser.uid), profileData);

      status.textContent = "✅ Profil sauvegardé !";
      status.style.color = "#078b45";

      await loadProfile();

      setTimeout(() => {
        document.getElementById("profileView").style.display = "block";
        document.getElementById("profileForm").style.display = "none";
        document.getElementById("editProfileBtn").style.display = "";
        status.textContent = "";
      }, 1500);
    } catch(err) {
      status.textContent = "❌ Erreur: " + err.message;
      status.style.color = "#d21f3c";
    }
  });
}
