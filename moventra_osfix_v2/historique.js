import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, doc, getDoc, collection, getDocs,
  query, where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig, ROLES_COLLECTION, TASKS_COLLECTION } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentRole = null;

const $ = (id) => document.getElementById(id);

onAuthStateChanged(auth, async (user) => {
  if (!user) return window.location.href = "login.html";

  currentUser = user;
  $("userEmail").textContent = user.email || user.uid;

  const roleSnap = await getDoc(doc(db, ROLES_COLLECTION, user.uid));
  if (!roleSnap.exists()) {
    alert("Accès refusé.");
    return window.location.href = "login.html";
  }

  currentRole = roleSnap.data().role;

  if (currentRole === "admin") {
    $("employeeBack").style.display = "none";
  } else if (currentRole === "employe") {
    $("adminBack").style.display = "none";
  } else {
    alert("Accès refusé.");
    return window.location.href = "login.html";
  }

  await loadHistory();
});

$("logoutBtn").onclick = async () => {
  await signOut(auth);
  window.location.href = "login.html";
};

$("refreshHistory").onclick = loadHistory;

async function loadHistory() {
  const list = $("historyList");
  list.innerHTML = "<p>Chargement...</p>";

  let q;
  if (currentRole === "admin") {
    q = query(collection(db, TASKS_COLLECTION), where("status", "==", "terminé"));
  } else {
    q = query(
      collection(db, TASKS_COLLECTION),
      where("status", "==", "terminé"),
      where("employeeId", "==", currentUser.uid)
    );
  }

  const snap = await getDocs(q);
  const tasks = [];
  snap.forEach((d) => tasks.push({ id: d.id, ...d.data() }));

  tasks.sort((a, b) => {
    const da = a.completedAt?.seconds || a.updatedAt?.seconds || 0;
    const db = b.completedAt?.seconds || b.updatedAt?.seconds || 0;
    return db - da;
  });

  if (!tasks.length) {
    list.innerHTML = "<p>Aucun travail terminé pour le moment.</p>";
    return;
  }

  list.innerHTML = tasks.map(taskCard).join("");
}

function taskCard(t) {
  const completed = t.completedAt?.toDate
    ? t.completedAt.toDate().toLocaleString("fr-CA")
    : "-";

  return `
    <article class="adminCard historyCard">
      <div class="cardTop">
        <h3>${escapeHtml(t.clientName || "Client")}</h3>
        <span class="status done">Terminé</span>
      </div>
      <p><b>Employé:</b> ${escapeHtml(t.employeeName || "-")}</p>
      <p><b>Service:</b> ${escapeHtml(t.service || "-")}</p>
      <p><b>Adresse:</b> ${mapLink(t.address)}</p>
      <p><b>Téléphone:</b> ${phoneLink(t.phone)}</p>
      <p><b>Date demandée:</b> ${escapeHtml(t.date || "-")}</p>
      <p><b>Note employé:</b> ${escapeHtml(t.notes || "-")}</p>
      <p><b>Terminé le:</b> ${escapeHtml(completed)}</p>
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
