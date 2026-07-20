import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBeDOLjFyONjv06dUc4b_R0lQ4AlSBPU2U",
  authDomain: "moventra-fe20f.firebaseapp.com",
  projectId: "moventra-fe20f",
  storageBucket: "moventra-fe20f.firebasestorage.app",
  messagingSenderId: "634208041846",
  appId: "1:634208041846:web:37bf64bed692efd5f31857",
  measurementId: "G-N0LFJ6JQXB"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

if (window.emailjs) {
  emailjs.init("AuecG8oUqCqCiggFv");
}

const form = document.getElementById("quoteForm");
const statusEl = document.getElementById("formStatus");
const submitBtn = document.getElementById("submitBtn");

const inventoryRows = [...document.querySelectorAll(".counterRow[data-item]")];

function inventorySnapshot() {
  const inventory = {};
  let volume = 0;
  let heavyItems = 0;
  inventoryRows.forEach((row) => {
    const qty = Number(row.querySelector('input[type="hidden"]').value) || 0;
    inventory[row.dataset.item] = {
      label: row.dataset.label,
      qty,
      volumeUnit: Number(row.dataset.volume) || 0,
      heavy: row.dataset.heavy === "1"
    };
    volume += qty * (Number(row.dataset.volume) || 0);
    if (row.dataset.heavy === "1") heavyItems += qty;
  });
  const rooms = Number(form?.elements?.rooms?.value) || 0;
  // Une petite marge pour les effets personnels qui ne sont pas détaillés.
  volume += rooms * 0.75;
  const rounded = Math.round(volume * 10) / 10;
  const truck = rounded <= 10 ? "Camion 16 pieds" : rounded <= 22 ? "Camion 20 pieds" : rounded <= 35 ? "Camion 26 pieds" : "Deux voyages ou grand camion";
  const crew = heavyItems > 0 || rounded > 22 ? 3 : rounded > 8 ? 2 : 2;
  const hoursMin = Math.max(2, Math.ceil(rounded / Math.max(2.7, crew * 1.55)));
  const hoursMax = hoursMin + (heavyItems ? 2 : 1);
  return { inventory, estimate: { volumeM3: rounded, truck, crew, duration: `${hoursMin} à ${hoursMax} heures`, heavyItems } };
}

function refreshInventoryEstimate() {
  const { estimate } = inventorySnapshot();
  const vol = document.getElementById("estimatedVolume");
  const crew = document.getElementById("estimatedCrew");
  if (vol) vol.textContent = `${estimate.volumeM3} m³`;
  if (crew) crew.textContent = estimate.volumeM3 ? `${estimate.truck} · ${estimate.crew} déménageurs · ${estimate.duration}` : "Ajoutez vos articles";
}

inventoryRows.forEach((row) => {
  const input = row.querySelector('input[type="hidden"]');
  const output = row.querySelector("output");
  row.querySelector("[data-minus]").addEventListener("click", () => {
    input.value = Math.max(0, (Number(input.value) || 0) - 1);
    output.value = input.value;
    output.textContent = input.value;
    refreshInventoryEstimate();
  });
  row.querySelector("[data-plus]").addEventListener("click", () => {
    input.value = Math.min(99, (Number(input.value) || 0) + 1);
    output.value = input.value;
    output.textContent = input.value;
    refreshInventoryEstimate();
  });
});
form?.elements?.rooms?.addEventListener("input", refreshInventoryEstimate);

async function sendMoventraWebhook(data, submissionId) {
  const url = String(window.MOVENTRA_WEBHOOK_URL || "").trim();
  if (!url) {
    console.warn("Webhook Make non configuré.");
    return;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "nouvelle_soumission_moventra",
      submissionId,
      createdAt: new Date().toISOString(),
      nom: data.name || "",
      telephone: data.phone || "",
      email: data.email || "",
      service: data.service || "",
      depart: data.address || "",
      destination: data.destination || "",
      date: data.date || "",
      typeLogement: data.propertyType || "",
      etageDepart: data.startFloor || "",
      etageArrivee: data.endFloor || "",
      details: data.message || "",
      rooms: data.rooms || "",
      startElevator: data.startElevator || "",
      endElevator: data.endElevator || "",
      doorDistance: data.doorDistance || "",
      inventory: data.inventory || {},
      inventoryEstimate: data.inventoryEstimate || {}
    })
  });

  if (!response.ok) {
    throw new Error(`Webhook Make HTTP ${response.status}`);
  }
}

function createEstimationNumber() {
  const year = new Date().getFullYear();
  const stamp = Date.now().toString(36).slice(-5).toUpperCase();
  const random = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `EST-${year}-${stamp}${random}`;
}

function removeUndefined(value) {
  if (Array.isArray(value)) return value.map(removeUndefined);
  if (value && typeof value === "object") {
    const clean = {};
    Object.entries(value).forEach(([key, item]) => {
      if (item !== undefined) clean[key] = removeUndefined(item);
    });
    return clean;
  }
  return value;
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const raw = new FormData(form);
  const data = {};
  for (const [key, value] of raw.entries()) {
    if (key.startsWith("inv_")) continue;
    data[key] = typeof value === "string" ? value : "";
  }
  const { inventory, estimate } = inventorySnapshot();
  data.inventory = inventory;
  data.inventoryEstimate = estimate;

  submitBtn.disabled = true;
  submitBtn.textContent = "Envoi en cours...";
  statusEl.textContent = "";

  try {
    const estimationNumber = createEstimationNumber();
    const submission = removeUndefined({
      ...data,
      // Champs canoniques utilisés par l’administration
      nom: data.name || "",
      telephone: data.phone || "",
      courriel: data.email || "",
      depart: data.address || "",
      typeLogement: data.propertyType || "",
      etageDepart: data.startFloor || "",
      etageArrivee: data.endFloor || "",
      details: data.message || "",
      startElevator: data.startElevator || "",
      endElevator: data.endElevator || "",
      rooms: Number(data.rooms) || 0,
      doorDistance: data.doorDistance || "",
      inventoryOther: data.inventoryOther || "",
      inventory,
      inventoryEstimate: estimate,
      status: "nouveau",
      source: "site_moventra",
      estimationNumber,
      createdAt: serverTimestamp()
    });

    const docRef = await addDoc(collection(db, "demandes_soumission"), submission);
    const secondaryTasks = [sendMoventraWebhook(data, docRef.id)];
    if (window.emailjs) {
      const inventoryLines = Object.values(inventory)
        .filter((item) => Number(item.qty) > 0)
        .map((item) => `${item.label} × ${item.qty}`);

      const inventaireTexte = inventoryLines.length
        ? inventoryLines.join("\n")
        : "Aucun article sélectionné";

      const objetsSpeciaux = [
        ...Object.values(inventory)
          .filter((item) => item.heavy && Number(item.qty) > 0)
          .map((item) => `${item.label} × ${item.qty}`),
        data.inventoryOther || ""
      ].filter(Boolean).join("\n") || "Aucun";

      const dateEnvoi = new Intl.DateTimeFormat("fr-CA", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "America/Toronto"
      }).format(new Date());

      const estimateText = `${estimate.volumeM3} m³ · ${estimate.truck} · ${estimate.crew} déménageurs · ${estimate.duration}`;
      const servicesAdditionnels = data.service || "Non précisé";

      secondaryTasks.push(emailjs.send("service_o6bm6tl", "template_c0smolo", {
        submissionId: estimationNumber,
        numero: estimationNumber,
        dateEnvoi,
        date_envoi: dateEnvoi,
        nom: data.name || "Non précisé",
        telephone: data.phone || "Non précisé",
        email: data.email || "Non précisé",
        courriel: data.email || "Non précisé",
        service: data.service || "Non précisé",
        date: data.date || "Non précisée",
        dateSouhaitee: data.date || "Non précisée",
        depart: data.address || "Non précisée",
        adresseDepart: data.address || "Non précisée",
        destination: data.destination || "Non précisée",
        adresseArrivee: data.destination || "Non précisée",
        typeLogement: data.propertyType || "Non précisé",
        typeLogementDepart: data.propertyType || "Non précisé",
        typeLogementArrivee: data.propertyType || "Non précisé",
        etageDepart: data.startFloor || "Non précisé",
        etageArrivee: data.endFloor || "Non précisé",
        ascenseurDepart: data.startElevator || "Non précisé",
        ascenseurArrivee: data.endElevator || "Non précisé",
        startElevator: data.startElevator || "Non précisé",
        endElevator: data.endElevator || "Non précisé",
        pieces: data.rooms || "Non précisé",
        rooms: data.rooms || "Non précisé",
        distancePorte: data.doorDistance || "Non précisée",
        doorDistance: data.doorDistance || "Non précisée",
        inventaire: inventaireTexte,
        inventory: inventaireTexte,
        objetsSpeciaux,
        inventoryOther: data.inventoryOther || "Aucun",
        servicesAdditionnels,
        estimationInventaire: estimateText,
        inventoryEstimate: estimateText,
        volume: `${estimate.volumeM3} m³`,
        camion: estimate.truck,
        demenageurs: String(estimate.crew),
        duree: estimate.duration,
        details: data.message || "Aucun commentaire",
        commentaires: data.message || "Aucun commentaire",
        dashboardUrl: "https://www.moventratransport.ca/admin.html"
      }));
    }

    const results = await Promise.allSettled(secondaryTasks);
    results.forEach((result) => {
      if (result.status === "rejected") {
        console.warn("Service secondaire non envoyé :", result.reason);
      }
    });

    const confirmationData = {
      estimationNumber,
      createdAt: new Date().toISOString(),
      name: data.name || "",
      phone: data.phone || "",
      email: data.email || "",
      service: data.service || "",
      date: data.date || "",
      address: data.address || "",
      destination: data.destination || "",
      propertyType: data.propertyType || "",
      startFloor: data.startFloor || "",
      endFloor: data.endFloor || "",
      startElevator: data.startElevator || "",
      endElevator: data.endElevator || "",
      rooms: data.rooms || "",
      doorDistance: data.doorDistance || "",
      inventoryOther: data.inventoryOther || "",
      message: data.message || "",
      inventory: Object.values(inventory).filter(item => Number(item.qty) > 0),
      estimate
    };
    sessionStorage.setItem("moventraLastSubmission", JSON.stringify(confirmationData));
    window.location.href = `confirmation.html?numero=${encodeURIComponent(estimationNumber)}`;
  } catch (error) {
    console.error("Erreur enregistrement soumission :", error);
    const code = error?.code ? ` (${error.code})` : "";
    const detail = error?.message || "Erreur inconnue";
    statusEl.innerHTML = `❌ La demande n’a pas pu être enregistrée${code}.<br><small>${detail}</small>`;
    statusEl.style.color = "#d21f3c";
    statusEl.scrollIntoView({ behavior: "smooth", block: "center" });
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Envoyer ma demande";
  }
});

const slides = document.querySelectorAll("#homeSlider .slide");
let currentSlide = 0;

if (slides.length) {
  setInterval(() => {
    slides[currentSlide].classList.remove("active");
    currentSlide = (currentSlide + 1) % slides.length;
    slides[currentSlide].classList.add("active");
  }, 3000);
}
