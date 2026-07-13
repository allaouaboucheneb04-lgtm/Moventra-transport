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
  if (!user) { location.replace("login.html"); return; }

  currentUser = user;
  setText("adminEmail", user.email || user.uid);

  const logoutBtn = $("logoutBtn");
  if (logoutBtn) {
    logoutBtn.onclick = async () => { await signOut(auth); location.replace("login.html"); };
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
      await signOut(auth);
      location.replace("login.html");
      return;
    }
    await loadAll();
    setupRealtimeQuotes();
    loadStats();
  } catch (error) {
    console.error(error);
    showDebug("Erreur chargement admin. Vérifie les rules Firestore.", true);
  }
});

async function loadAll() {
  await loadEmployees();
  await loadQuotes();
  await loadTasks();
  await loadSocialLinks();
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
      if (emailBtn) emailBtn.href = `mailto:${cleanEmail}?subject=Invitation%20Didier.Elo&body=Voici%20ton%20lien%20d%27invitation%20:%20${encodeURIComponent(link)}`;

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
    list.innerHTML = `<p style="color:#d21f3c;font-weight:900;">Erreur chargement soumissions.</p>`;
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
      (q.name || "").toLowerCase().includes(searchQuery) ||
      (q.service || "").toLowerCase().includes(searchQuery) ||
      (q.phone || "").toLowerCase().includes(searchQuery) ||
      (q.email || "").toLowerCase().includes(searchQuery)
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
        quoteId, clientName: q.name || "", phone: q.phone || "", email: q.email || "",
        service: q.service || "", address: q.address || "", date: q.date || "",
        message: q.message || "", employeeId: emp.id,
        employeeName: emp.name || emp.email || "Employé",
        employeeEmail: emp.email || "", status: "assigné", notes: "",
        createdAt: serverTimestamp(), assignedBy: currentUser.uid
      });

      await updateDoc(doc(db, QUOTES_COLLECTION, quoteId), {
        status: "assigné", assignedTo: emp.id, assignedToName: emp.name || emp.email || "Employé"
      });

      // Email confirmation au client
      if (q.email) {
        try {
          if (window.emailjs) {
            await window.emailjs.send("service_yxizoav", "template_confirmation", {
              to: q.email, clientName: q.name || "Client",
              service: q.service || "Service",
              employeeName: emp.name || emp.email,
              date: q.date || "à confirmer"
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
  });
}

function quoteCard(q) {
  const options = employees.map(e => `<option value="${e.id}">${escapeHtml(e.name || e.email)}</option>`).join("");
  const statusClass = q.status === "assigné" ? "status assigned" : q.status === "terminé" ? "status done" : q.status === "annulé" ? "status cancelled" : "status";
  const dateStr = q.createdAt ? formatDate(q.createdAt) : "";
  const montant = q.montantAdmin ? `<p class="montantAdmin">💰 Montant estimé : <strong>${escapeHtml(String(q.montantAdmin))}$</strong> <span>(visible admin seulement)</span></p>` : "";

  return `
    <article class="adminCard">
      <div class="cardTop">
        <h3>${escapeHtml(q.name || "Sans nom")}</h3>
        <span class="${statusClass}">${escapeHtml(q.status || "nouveau")}</span>
      </div>
      ${dateStr ? `<p class="cardDate">📅 ${dateStr}</p>` : ""}
      <p><b>Service:</b> ${escapeHtml(q.service || "-")}</p>
      <p><b>Téléphone:</b> ${phoneLink(q.phone)}</p>
      <p><b>Email:</b> ${emailLink(q.email)}</p>
      <p><b>Adresse:</b> ${mapLink(q.address)}</p>
      <p><b>Date souhaitée:</b> ${escapeHtml(q.date || "-")}</p>
      <p><b>Message:</b> ${escapeHtml(q.message || "-")}</p>
      ${montant}

      <!-- Montant admin -->
      <div class="montantAdminRow">
        <input type="number" class="montantInput" data-quote-id="${q.id}"
          placeholder="Montant estimé ($)" value="${q.montantAdmin || ""}"
          min="0" step="0.01">
        <button class="smallBtn" data-save-montant="${q.id}">💾 Montant</button>
      </div>

      <!-- Note admin -->
      <div class="noteAdminRow">
        <input type="text" class="noteInput" data-quote-id="${q.id}"
          placeholder="Note interne (visible admin seulement)..."
          value="${escapeHtml(q.noteAdmin || "")}">
        <button class="smallBtn" data-save-note="${q.id}">💾 Note</button>
      </div>

      <!-- Assigner -->
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
      <p><b>Adresse:</b> ${mapLink(t.address)}</p>
      <p><b>Téléphone:</b> ${phoneLink(t.phone)}</p>
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
const adminMenuToggle = document.getElementById("adminMenuToggle");
const adminMenuDropdown = document.getElementById("adminMenuDropdown");

if (adminMenuToggle && adminMenuDropdown) {
  adminMenuToggle.onclick = (e) => {
    e.stopPropagation();
    adminMenuDropdown.classList.toggle("open");
  };
  document.addEventListener("click", () => adminMenuDropdown.classList.remove("open"));
  adminMenuDropdown.addEventListener("click", e => e.stopPropagation());
}

// Câbler boutons mobile
const logoutBtnMobile = document.getElementById("logoutBtnMobile");
if (logoutBtnMobile) {
  logoutBtnMobile.onclick = async () => {
    const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");
    await signOut(getAuth());
    location.replace("login.html");
  };
}

const notifBtnMobile = document.getElementById("enableNotificationsBtnMobile");
if (notifBtnMobile) {
  notifBtnMobile.onclick = async () => {
    if (window.didierEloEnablePush) window.didierEloEnablePush();
  };
}
