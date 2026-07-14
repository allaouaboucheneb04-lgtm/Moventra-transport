console.log("Moventra admin-v3 chargé 20260713-0055");
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, collection, getDocs,
  addDoc, updateDoc, serverTimestamp, query, orderBy, onSnapshot, where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig, ROLES_COLLECTION, QUOTES_COLLECTION, TASKS_COLLECTION } from "./firebase-config.js";

const INVITES_COLLECTION = "invites";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let employees = [];
let currentUser = null;
let firstAdminSnapshot = true;
let allQuotes = [];
let activeFilter = "tous";
let searchQuery = "";

const $ = (id) => document.getElementById(id);

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function showDebug(message, error = false) {
  let box = $("adminDebugBox");
  if (!box) {
    box = document.createElement("div");
    box.id = "adminDebugBox";
    box.className = "notificationStatus";
    const main = document.querySelector(".adminMain");
    if (main) main.prepend(box);
  }
  box.style.color = error ? "#d21f3c" : "#078b45";
  box.textContent = message;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    sessionStorage.removeItem("moventra_admin_verified");
    location.replace("login.html?required=1");
    return;
  }

  let verifiedSession = null;
  try { verifiedSession = JSON.parse(sessionStorage.getItem("moventra_admin_verified") || "null"); } catch (_) {}
  if (!verifiedSession || verifiedSession.uid !== user.uid) {
    sessionStorage.removeItem("moventra_admin_verified");
    await signOut(auth);
    location.replace("login.html?required=1");
    return;
  }

  currentUser = user;
  setText("adminEmail", user.email || user.uid);

  const logoutBtn = $("logoutBtn");
  if (logoutBtn) {
    logoutBtn.onclick = async () => { sessionStorage.removeItem("moventra_admin_verified"); await signOut(auth); location.replace("login.html"); };
  }

  const notifBtn = $("enableNotificationsBtn");
  if (notifBtn) {
    notifBtn.onclick = async () => {
      try {
        notifBtn.disabled = true;
        notifBtn.textContent = "Activation...";
        const mod = await import("./notifications.js");
        await mod.initNotifications(app, db, user, "admin");
      } catch (error) {
        console.error(error);
        alert("Erreur notifications: " + (error.message || error));
      } finally {
        notifBtn.disabled = false;
        notifBtn.textContent = "🔔 Notifications";
      }
    };
  }

  const refreshQuotes = $("refreshQuotes");
  if (refreshQuotes) refreshQuotes.onclick = loadQuotes;

  const refreshTasks = $("refreshTasks");
  if (refreshTasks) refreshTasks.onclick = loadTasks;

  // Filtres
  document.querySelectorAll("[data-filter]").forEach(btn => {
    btn.onclick = () => {
      activeFilter = btn.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderQuotes();
    };
  });

  // Recherche
  const searchInput = $("searchQuotes");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      searchQuery = searchInput.value.toLowerCase().trim();
      renderQuotes();
    });
  }

  try {
    const roleSnap = await getDoc(doc(db, ROLES_COLLECTION, user.uid));
    if (!roleSnap.exists() || roleSnap.data().role !== "admin") {
      alert("Accès admin refusé.");
      sessionStorage.removeItem("moventra_admin_verified");
      await signOut(auth);
      location.replace("login.html");
      return;
    }
    await loadAll();
    setupRealtimeQuotes();
    loadStats();
    loadDashboardOverview();
  } catch (error) {
    console.error(error);
    showDebug("Erreur chargement admin: " + (error.code || error.message || error), true);
  }
});

async function loadAll() {
  const results = await Promise.allSettled([
    loadEmployees(), loadQuotes(), loadTasks(), loadSocialLinks()
  ]);
  const failed = results.filter(r => r.status === "rejected");
  if (failed.length) {
    console.error("Chargements admin échoués", failed);
    showDebug("Admin connecté, mais certains modules n'ont pas chargé. Ouvre Debug pour le détail.", true);
  }
}

async function loadEmployees() {
  try {
    const snap = await getDocs(collection(db, ROLES_COLLECTION));
    employees = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.role === "employe") employees.push({ id: d.id, ...data });
    });
    setText("countEmployees", employees.length);
  } catch (error) {
    console.error("loadEmployees", error);
    setText("countEmployees", "!");
  }
}

// ========== STATS ==========
async function loadStats() {
  try {
    const snap = await getDocs(collection(db, QUOTES_COLLECTION));
    const docs = [];
    snap.forEach(d => docs.push(d.data()));

    const now = new Date();
    const thisWeek = docs.filter(d => {
      if (!d.createdAt) return false;
      const date = d.createdAt.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
      const diff = (now - date) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    });
    const thisMonth = docs.filter(d => {
      if (!d.createdAt) return false;
      const date = d.createdAt.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    });

    setText("statWeek", thisWeek.length);
    setText("statMonth", thisMonth.length);
    setText("statTotal", docs.length);

    // Top service
    const services = {};
    docs.forEach(d => {
      const s = d.service || "Autre";
      services[s] = (services[s] || 0) + 1;
    });
    const topService = Object.entries(services).sort((a, b) => b[1] - a[1])[0];
    setText("statTopService", topService ? topService[0] : "-");
  } catch (e) {
    console.warn("Stats error", e);
  }
}

// ========== INVITE ==========
const inviteForm = $("inviteForm");
if (inviteForm) {
  inviteForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const code = crypto.randomUUID().slice(0, 8).toUpperCase();
    const cleanEmail = data.email.trim().toLowerCase();
    const link = `${location.origin}${location.pathname.replace("admin.html", "")}invite.html?code=${code}`;

    try {
      await setDoc(doc(db, INVITES_COLLECTION, code), {
        code, name: data.name.trim(), email: cleanEmail, role: "employe",
        status: "pending", createdAt: serverTimestamp(), createdBy: currentUser.uid, inviteLink: link
      });
      const status = $("inviteStatus");
      if (status) { status.textContent = "✅ Invitation créée."; status.style.color = "#078b45"; }
      if ($("inviteResult")) $("inviteResult").hidden = false;
      if ($("inviteLink")) $("inviteLink").value = link;

      // Email invite link
      const emailBtn = $("emailInvite");
      if (emailBtn) emailBtn.href = `mailto:${cleanEmail}?subject=Invitation%20Moventra%20Transport&body=Voici%20ton%20lien%20d%27invitation%20:%20${encodeURIComponent(link)}`;

      e.target.reset();
    } catch (error) {
      const status = $("inviteStatus");
      if (status) { status.textContent = "❌ Erreur création invitation."; status.style.color = "#d21f3c"; }
    }
  });
}

const copyInvite = $("copyInvite");
if (copyInvite) {
  copyInvite.onclick = async () => {
    await navigator.clipboard.writeText($("inviteLink").value);
    $("inviteStatus").textContent = "✅ Lien copié.";
    $("inviteStatus").style.color = "#078b45";
  };
}

// ========== QUOTES ==========
async function loadQuotes() {
  const list = $("quotesList");
  if (!list) return;
  list.innerHTML = "<p>Chargement...</p>";

  try {
    let snap;
    try {
      snap = await getDocs(query(collection(db, QUOTES_COLLECTION), orderBy("createdAt", "desc")));
    } catch (e) {
      snap = await getDocs(collection(db, QUOTES_COLLECTION));
    }

    allQuotes = [];
    snap.forEach((d) => allQuotes.push({ id: d.id, ...d.data() }));
    setText("countQuotes", allQuotes.length);
    showDebug("Admin connecté. Soumissions: " + allQuotes.length);
    renderQuotes();
  } catch (error) {
    console.error("loadQuotes", error);
    setText("countQuotes", "!");
    list.innerHTML = `<p style="color:#d21f3c;font-weight:900;">Erreur chargement soumissions: ${escapeHtml(error.code || error.message || String(error))}</p>`;
    showDebug("Erreur soumissions: " + (error.code || error.message || error), true);
  }
}

function renderQuotes() {
  const list = $("quotesList");
  if (!list) return;

  let filtered = allQuotes;

  // Toujours cacher les annulés sauf si filtre explicite
  if (activeFilter === "tous") {
    filtered = filtered.filter(q => (q.status || "nouveau") !== "annulé");
  } else {
    filtered = filtered.filter(q => (q.status || "nouveau") === activeFilter);
  }

  // Recherche
  if (searchQuery) {
    filtered = filtered.filter(q =>
      quoteValue(q, "name", "nom").toLowerCase().includes(searchQuery) ||
      quoteValue(q, "service").toLowerCase().includes(searchQuery) ||
      quoteValue(q, "phone", "telephone").toLowerCase().includes(searchQuery) ||
      quoteValue(q, "email", "courriel").toLowerCase().includes(searchQuery) ||
      quoteValue(q, "address", "depart").toLowerCase().includes(searchQuery) ||
      quoteValue(q, "destination").toLowerCase().includes(searchQuery)
    );
  }

  // Compteur filtre
  setText("filterCount", filtered.length + " résultat" + (filtered.length !== 1 ? "s" : ""));

  if (!filtered.length) {
    list.innerHTML = "<p>Aucune soumission pour ce filtre.</p>";
    return;
  }

  list.innerHTML = filtered.map(quoteCard).join("");

  // Bouton Assigner
  list.querySelectorAll("[data-assign]").forEach((btn) => {
    btn.onclick = async () => {
      const quoteId = btn.dataset.assign;
      const select = document.querySelector(`[data-employee-select="${quoteId}"]`);
      const emp = employees.find(e => e.id === select.value);
      if (!emp) { alert("Choisis un employé."); return; }

      const q = allQuotes.find(x => x.id === quoteId);

      await addDoc(collection(db, TASKS_COLLECTION), {
        quoteId,
        clientName: quoteValue(q, "name", "nom"),
        phone: quoteValue(q, "phone", "telephone"),
        email: quoteValue(q, "email", "courriel"),
        service: quoteValue(q, "service"),
        address: quoteValue(q, "address", "depart"),
        destination: quoteValue(q, "destination"),
        date: quoteValue(q, "date"),
        propertyType: quoteValue(q, "propertyType", "typeLogement"),
        startFloor: quoteValue(q, "startFloor", "etageDepart"),
        endFloor: quoteValue(q, "endFloor", "etageArrivee"),
        message: quoteValue(q, "message", "details"),
        employeeId: emp.id,
        employeeName: emp.name || emp.email || "Employé",
        employeeEmail: emp.email || "", status: "assigné", notes: "",
        createdAt: serverTimestamp(), assignedBy: currentUser.uid
      });

      await updateDoc(doc(db, QUOTES_COLLECTION, quoteId), {
        status: "assigné", assignedTo: emp.id, assignedToName: emp.name || emp.email || "Employé"
      });

      // Email confirmation au client
      if (quoteValue(q, "email", "courriel")) {
        try {
          if (window.emailjs) {
            await window.emailjs.send("service_o6bm6tl", "template_c0smolo", {
              to: quoteValue(q, "email", "courriel"),
              clientName: quoteValue(q, "name", "nom") || "Client",
              service: quoteValue(q, "service") || "Service",
              employeeName: emp.name || emp.email,
              date: quoteValue(q, "date") || "à confirmer"
            });
          }
        } catch(e) { console.warn("Email confirmation failed", e); }
      }

      alert("Travail assigné ✅");
      await loadAll();
    };
  });

  // Bouton Annuler
  list.querySelectorAll("[data-annuler]").forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm("Confirmer l'annulation de cette soumission ? Elle disparaîtra de la liste.")) return;
      await updateDoc(doc(db, QUOTES_COLLECTION, btn.dataset.annuler), {
        status: "annulé", annuledAt: serverTimestamp()
      });
      await loadQuotes();
    };
  });

  // Sauvegarder montant admin
  list.querySelectorAll("[data-save-montant]").forEach((btn) => {
    btn.onclick = async () => {
      const quoteId = btn.dataset.saveMontant;
      const input = document.querySelector(`.montantInput[data-quote-id="${quoteId}"]`);
      if (!input) return;
      await updateDoc(doc(db, QUOTES_COLLECTION, quoteId), {
        montantAdmin: input.value.trim()
      });
      btn.textContent = "✅"; setTimeout(() => btn.textContent = "💾 Montant", 2000);
    };
  });

  // Sauvegarder note admin
  list.querySelectorAll("[data-save-note]").forEach((btn) => {
    btn.onclick = async () => {
      const quoteId = btn.dataset.saveNote;
      const input = document.querySelector(`.noteInput[data-quote-id="${quoteId}"]`);
      if (!input) return;
      await updateDoc(doc(db, QUOTES_COLLECTION, quoteId), {
        noteAdmin: input.value.trim()
      });
      btn.textContent = "✅"; setTimeout(() => btn.textContent = "💾 Note", 2000);
    };
  });
}

function quoteValue(q, ...keys) {
  for (const key of keys) {
    const value = q?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function quoteCard(q) {
  const options = employees.map(e => `<option value="${e.id}">${escapeHtml(e.name || e.email)}</option>`).join("");
  const statusClass = q.status === "assigné" ? "status assigned" : q.status === "terminé" ? "status done" : q.status === "annulé" ? "status cancelled" : "status";
  const dateStr = q.createdAt ? formatDate(q.createdAt) : "";
  const montant = q.montantAdmin ? `<p class="montantAdmin">💰 Montant estimé : <strong>${escapeHtml(String(q.montantAdmin))}$</strong> <span>(visible admin seulement)</span></p>` : "";

  const name = quoteValue(q, "name", "nom") || "Sans nom";
  const phone = quoteValue(q, "phone", "telephone");
  const email = quoteValue(q, "email", "courriel");
  const service = quoteValue(q, "service");
  const depart = quoteValue(q, "address", "depart");
  const destination = quoteValue(q, "destination", "arrivalAddress", "adresseArrivee");
  const desiredDate = quoteValue(q, "date", "dateSouhaitee");
  const propertyType = quoteValue(q, "propertyType", "typeLogement");
  const startFloor = quoteValue(q, "startFloor", "etageDepart");
  const endFloor = quoteValue(q, "endFloor", "etageArrivee");
  const message = quoteValue(q, "message", "details");

  return `
    <article class="adminCard">
      <div class="cardTop">
        <h3>${escapeHtml(name)}</h3>
        <span class="${statusClass}">${escapeHtml(q.status || "nouveau")}</span>
      </div>
      ${dateStr ? `<p class="cardDate">🕓 Reçue le ${dateStr}</p>` : ""}

      <div class="quoteDetailsGrid">
        <p><b>📦 Service :</b> ${escapeHtml(service || "-")}</p>
        <p><b>📅 Date souhaitée :</b> ${escapeHtml(desiredDate || "-")}</p>
        <p><b>🏠 Type de logement :</b> ${escapeHtml(propertyType || "-")}</p>
        <p><b>📞 Téléphone :</b> ${phoneLink(phone)}</p>
        <p><b>✉️ Courriel :</b> ${emailLink(email)}</p>
        <p><b>📍 Adresse de départ :</b> ${mapLink(depart)}</p>
        <p><b>🏁 Adresse d’arrivée :</b> ${mapLink(destination)}</p>
        <p><b>⬆️ Étage au départ :</b> ${escapeHtml(startFloor || "-")}</p>
        <p><b>⬇️ Étage à l’arrivée :</b> ${escapeHtml(endFloor || "-")}</p>
      </div>

      <div class="quoteMessage"><b>📝 Détails :</b><br>${escapeHtml(message || "-")}</div>
      <p class="submissionId"><b>Numéro :</b> ${escapeHtml(q.id)}</p>
      ${montant}

      <div class="montantAdminRow">
        <input type="number" class="montantInput" data-quote-id="${q.id}"
          placeholder="Montant estimé ($)" value="${q.montantAdmin || ""}"
          min="0" step="0.01">
        <button class="smallBtn" data-save-montant="${q.id}">💾 Montant</button>
      </div>

      <div class="noteAdminRow">
        <input type="text" class="noteInput" data-quote-id="${q.id}"
          placeholder="Note interne (visible admin seulement)..."
          value="${escapeHtml(q.noteAdmin || "")}">
        <button class="smallBtn" data-save-note="${q.id}">💾 Note</button>
      </div>

      <div class="assignRow" style="margin-top:12px">
        <select data-employee-select="${q.id}">
          <option value="">Choisir employé</option>
          ${options}
        </select>
        <button data-assign="${q.id}" class="smallBtn">✅ Assigner</button>
        <button data-annuler="${q.id}" class="smallBtn danger">🚫 Annuler</button>
      </div>
    </article>
  `;
}

// ========== TASKS ==========
async function loadTasks() {
  const list = $("tasksList");
  if (!list) return;
  list.innerHTML = "<p>Chargement...</p>";

  try {
    let snap;
    try {
      snap = await getDocs(query(collection(db, TASKS_COLLECTION), orderBy("createdAt", "desc")));
    } catch {
      snap = await getDocs(collection(db, TASKS_COLLECTION));
    }

    const docs = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.status !== "terminé") docs.push({ id: d.id, ...data });
    });

    setText("countTasks", docs.length);
    if (!docs.length) { list.innerHTML = "<p>Aucun travail actif.</p>"; return; }

    list.innerHTML = docs.map(taskCard).join("");

    list.querySelectorAll("[data-status]").forEach((btn) => {
      btn.onclick = async () => {
        const updateData = { status: btn.dataset.status, updatedAt: serverTimestamp() };
        if (btn.dataset.status === "terminé") updateData.completedAt = serverTimestamp();
        await updateDoc(doc(db, TASKS_COLLECTION, btn.dataset.task), updateData);
        await loadTasks();
      };
    });
  } catch (error) {
    console.error("loadTasks", error);
    setText("countTasks", "!");
    list.innerHTML = `<p style="color:#d21f3c;font-weight:900;">Erreur chargement travaux.</p>`;
  }
}

function taskCard(t) {
  return `
    <article class="adminCard">
      <div class="cardTop">
        <h3>${escapeHtml(t.clientName || "Client")}</h3>
        <span class="status">${escapeHtml(t.status || "-")}</span>
      </div>
      <p><b>Employé:</b> ${escapeHtml(t.employeeName || "-")}</p>
      <p><b>Service:</b> ${escapeHtml(t.service || "-")}</p>
      <p><b>Départ:</b> ${mapLink(t.address)}</p>
      <p><b>Destination:</b> ${mapLink(t.destination)}</p>
      <p><b>Date:</b> ${escapeHtml(t.date || "-")}</p>
      <p><b>Logement:</b> ${escapeHtml(t.propertyType || "-")}</p>
      <p><b>Étages:</b> ${escapeHtml(t.startFloor || "-")} → ${escapeHtml(t.endFloor || "-")}</p>
      <p><b>Téléphone:</b> ${phoneLink(t.phone)}</p>
      <p><b>Détails:</b> ${escapeHtml(t.message || "-")}</p>
      <div class="assignRow threeBtn">
        <button class="smallBtn grey" data-task="${t.id}" data-status="assigné">Assigné</button>
        <button class="smallBtn orange" data-task="${t.id}" data-status="en cours">En cours</button>
        <button class="smallBtn ok" data-task="${t.id}" data-status="terminé">✅ Terminé</button>
      </div>
    </article>
  `;
}

// ========== REALTIME ==========
function setupRealtimeQuotes() {
  try {
    const q = query(collection(db, QUOTES_COLLECTION), orderBy("createdAt", "desc"));
    onSnapshot(q, (snap) => {
      if (firstAdminSnapshot) { firstAdminSnapshot = false; return; }
      snap.docChanges().forEach((change) => {
        if (change.type === "added") loadQuotes();
      });
    }, (error) => console.warn("Realtime désactivé:", error));
  } catch (error) {
    console.warn("Realtime impossible:", error);
  }
}

// ========== HELPERS ==========
function formatDate(ts) {
  try {
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function phoneLink(phone) {
  if (!phone) return "-";
  const clean = String(phone).replace(/[^\d+]/g, "");
  return `<a href="tel:${clean}" class="callBtn">📞 ${escapeHtml(phone)}</a>`;
}

function emailLink(email) {
  if (!email) return "-";
  return `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`;
}

function mapLink(address) {
  if (!address) return "-";
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return `<a href="${url}" target="_blank" rel="noopener">📍 ${escapeHtml(address)}</a>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}

// ========== RÉSEAUX SOCIAUX ==========
const SOCIAL_DOC = "settings/social";

async function loadSocialLinks() {
  try {
    const snap = await getDoc(doc(db, "settings", "social"));
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.facebook) $("socialFacebook").value = data.facebook;
    if (data.instagram) $("socialInstagram").value = data.instagram;
    if (data.tiktok) $("socialTiktok").value = data.tiktok;
  } catch(e) {
    console.warn("loadSocialLinks", e);
  }
}

async function saveSocialLink(platform, inputId) {
  const value = $(inputId).value.trim();
  const status = $("socialStatus");
  try {
    await setDoc(doc(db, "settings", "social"), { [platform]: value }, { merge: true });
    status.textContent = `✅ ${platform} sauvegardé !`;
    status.style.color = "#078b45";
    setTimeout(() => status.textContent = "", 3000);
  } catch(e) {
    status.textContent = "❌ Erreur sauvegarde.";
    status.style.color = "#d21f3c";
  }
}

// Câbler les boutons après chargement
document.addEventListener("DOMContentLoaded", () => {
  const fb = $("saveFacebook");
  const ig = $("saveInstagram");
  const tt = $("saveTiktok");
  if (fb) fb.onclick = () => saveSocialLink("facebook", "socialFacebook");
  if (ig) ig.onclick = () => saveSocialLink("instagram", "socialInstagram");
  if (tt) tt.onclick = () => saveSocialLink("tiktok", "socialTiktok");
});

// ========== MENU MOBILE BURGER ==========
// Le menu est géré une seule fois par le script intégré dans admin.html.
// Ne pas ajouter un deuxième gestionnaire ici : deux clics successifs
// ouvraient puis refermaient immédiatement le menu sur iPhone.

// Câbler boutons mobile
const logoutBtnMobile = document.getElementById("logoutBtnMobile");
if (logoutBtnMobile) {
  logoutBtnMobile.onclick = async () => {
    const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");
    sessionStorage.removeItem("moventra_admin_verified");
    await signOut(getAuth());
    location.replace("login.html");
  };
}

const notifBtnMobile = document.getElementById("enableNotificationsBtnMobile");
if (notifBtnMobile) {
  notifBtnMobile.onclick = async () => {
    const desktopBtn = document.getElementById("enableNotificationsBtn");
    if (desktopBtn) desktopBtn.click();
  };
}


// ========== TABLEAU DE BORD COMPLET ==========
function asDate(value) {
  if (!value) return null;
  try {
    if (typeof value.toDate === "function") return value.toDate();
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch (_) { return null; }
}
function sameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function sameMonth(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
function dateFromRecord(record) {
  return asDate(record.date || record.serviceDate || record.dateSouhaitee || record.dateSouhaitée || record.startDate || record.createdAt);
}
function moneyCAD(value) {
  return Number(value || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
}
function shortDate(value) {
  const d = asDate(value);
  return d ? d.toLocaleDateString("fr-CA", { day: "numeric", month: "short" }) : "—";
}
function fullDateTime(value) {
  const d = asDate(value);
  return d ? d.toLocaleString("fr-CA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Date inconnue";
}
function recordName(record) {
  return record.name || record.nom || record.clientNom || record.customerName || "Client";
}
function recordService(record) {
  return record.service || record.typeService || record.description || "Service Moventra";
}

async function safeCollection(name) {
  try {
    const snap = await getDocs(collection(db, name));
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
    return rows;
  } catch (error) {
    console.warn("Dashboard collection inaccessible:", name, error.code || error.message);
    return [];
  }
}

async function loadDashboardOverview() {
  const dateEl = $("dashboardDate");
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const [quotes, tasks, invoices, notifications] = await Promise.all([
    safeCollection(QUOTES_COLLECTION),
    safeCollection(TASKS_COLLECTION),
    safeCollection("factures"),
    safeCollection("notifications")
  ]);

  const now = new Date();
  const quotesToday = quotes.filter(q => sameDay(asDate(q.createdAt), now));
  const quotesMonth = quotes.filter(q => sameMonth(asDate(q.createdAt), now));
  const invoicesMonth = invoices.filter(f => sameMonth(asDate(f.createdAt) || asDate(f.date), now));
  const monthlyRevenue = invoicesMonth
    .filter(f => String(f.statut || "").toLowerCase() !== "annulée")
    .reduce((sum, f) => sum + Number(f.total || 0), 0);
  const activeTasks = tasks.filter(t => !["terminé", "annulé"].includes(String(t.status || "").toLowerCase()));
  const tasksToday = tasks.filter(t => sameDay(dateFromRecord(t), now));
  const busyEmployeeIds = new Set(activeTasks.map(t => t.employeeId || t.assignedTo).filter(Boolean));
  const availableEmployees = employees.filter(e => e.active !== false && e.actif !== false && !busyEmployeeIds.has(e.id));
  const unreadNotifications = notifications.filter(n => n.read !== true && n.lu !== true && n.status !== "read");

  setText("dashQuotesToday", quotesToday.length);
  setText("dashQuotesMonth", `${quotesMonth.length} ce mois-ci`);
  setText("dashRevenueMonth", moneyCAD(monthlyRevenue));
  setText("dashInvoicesMonth", `${invoicesMonth.length} facture(s)`);
  setText("dashActiveTasks", activeTasks.length);
  setText("dashTasksToday", `${tasksToday.length} prévue(s) aujourd’hui`);
  setText("dashAvailableEmployees", availableEmployees.length);
  setText("dashEmployeesTotal", `${employees.length} au total`);
  setText("dashUnreadNotifications", unreadNotifications.length);

  const assignedQuotes = quotesMonth.filter(q => ["assigné", "en cours", "terminé"].includes(String(q.status || "").toLowerCase())).length;
  const conversionRate = quotesMonth.length ? Math.round((assignedQuotes / quotesMonth.length) * 100) : 0;
  const paidInvoices = invoicesMonth.filter(f => ["payée", "paye", "payé", "paid"].includes(String(f.statut || "").toLowerCase())).length;
  const paidRate = invoicesMonth.length ? Math.round((paidInvoices / invoicesMonth.length) * 100) : 0;
  setText("dashConversionRate", `${conversionRate} %`);
  setText("dashPaidRate", `${paidRate} %`);
  const conversionBar = $("dashConversionBar"); if (conversionBar) conversionBar.style.width = `${Math.min(100, conversionRate)}%`;
  const paidBar = $("dashPaidBar"); if (paidBar) paidBar.style.width = `${Math.min(100, paidRate)}%`;

  const serviceCounts = {};
  quotesMonth.forEach(q => { const service = recordService(q); serviceCounts[service] = (serviceCounts[service] || 0) + 1; });
  const topService = Object.entries(serviceCounts).sort((a,b) => b[1] - a[1])[0];
  setText("dashTopService", topService ? `${topService[0]} (${topService[1]})` : "Aucune donnée");

  renderDashboardActivity(quotes, tasks, invoices);
  renderDashboardUpcoming(quotes, tasks);
}

function renderDashboardActivity(quotes, tasks, invoices) {
  const box = $("dashboardRecentActivity");
  if (!box) return;
  const items = [
    ...quotes.map(q => ({ type: "quote", icon: "📋", title: `Nouvelle soumission — ${recordName(q)}`, detail: recordService(q), date: asDate(q.createdAt) })),
    ...tasks.map(t => ({ type: "task", icon: "🚚", title: `Mission ${t.status || "assignée"} — ${recordName(t)}`, detail: t.employeeName || t.assignedToName || recordService(t), date: asDate(t.updatedAt) || asDate(t.createdAt) })),
    ...invoices.map(f => ({ type: "invoice", icon: "🧾", title: `Facture ${f.numero || ""} — ${f.clientNom || "Client"}`, detail: `${moneyCAD(f.total)} • ${f.statut || "brouillon"}`, date: asDate(f.updatedAt) || asDate(f.createdAt) || asDate(f.date) }))
  ].filter(i => i.date).sort((a,b) => b.date - a.date).slice(0, 7);
  if (!items.length) { box.innerHTML = '<p class="dashboardEmpty">Aucune activité récente.</p>'; return; }
  box.innerHTML = items.map(i => `<div class="activityItem"><div class="activityIcon">${i.icon}</div><div class="activityText"><strong>${escapeHtml(i.title)}</strong><span>${escapeHtml(i.detail)}</span></div><time class="activityTime">${escapeHtml(fullDateTime(i.date))}</time></div>`).join("");
}

function renderDashboardUpcoming(quotes, tasks) {
  const box = $("dashboardUpcoming");
  if (!box) return;
  const now = new Date(); now.setHours(0,0,0,0);
  const upcoming = [
    ...quotes.map(q => ({ title: `${recordService(q)} — ${recordName(q)}`, detail: `${q.depart || q.address || "Départ à confirmer"}${q.destination ? " → " + q.destination : ""}`, date: dateFromRecord(q), status: q.status || "soumission" })),
    ...tasks.map(t => ({ title: `${recordService(t)} — ${recordName(t)}`, detail: `${t.employeeName || t.assignedToName || "Employé à confirmer"} • ${t.status || "assigné"}`, date: dateFromRecord(t), status: t.status || "mission" }))
  ].filter(i => i.date && i.date >= now && !["terminé", "annulé"].includes(String(i.status).toLowerCase()))
   .sort((a,b) => a.date - b.date).slice(0, 6);
  if (!upcoming.length) { box.innerHTML = '<p class="dashboardEmpty">Aucun rendez-vous à venir.</p>'; return; }
  box.innerHTML = upcoming.map(i => `<div class="upcomingItem"><div class="upcomingDate">${i.date.getDate()}<small>${i.date.toLocaleDateString("fr-CA",{month:"short"})}</small></div><div class="upcomingText"><strong>${escapeHtml(i.title)}</strong><span>${escapeHtml(i.detail)}</span></div></div>`).join("");
}
