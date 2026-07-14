import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

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
const storage = getStorage(app);

if (window.emailjs) {
  emailjs.init("AuecG8oUqCqCiggFv");
}

const form = document.getElementById("quoteForm");
const statusEl = document.getElementById("formStatus");
const submitBtn = document.getElementById("submitBtn");

const photoInput = document.getElementById("submissionPhotos");
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

photoInput?.addEventListener("change", () => {
  const files = [...photoInput.files].slice(0, 6);
  if (photoInput.files.length > 6) alert("Maximum 6 photos.");
  const preview = document.getElementById("photoPreview");
  preview.innerHTML = "";
  files.forEach((file) => {
    const img = document.createElement("img");
    img.alt = file.name;
    img.src = URL.createObjectURL(file);
    img.onload = () => URL.revokeObjectURL(img.src);
    preview.appendChild(img);
  });
});

async function uploadSubmissionPhotos(submissionId, files) {
  const selected = files.slice(0, 6);
  const urls = [];
  for (let i = 0; i < selected.length; i++) {
    const file = selected[i];
    if (!file.type.startsWith("image/")) continue;
    if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name} dépasse 5 Mo.`);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageRef = ref(storage, `submission-photos/${submissionId}/${Date.now()}-${i}-${safeName}`);
    await uploadBytes(storageRef, file, { contentType: file.type });
    urls.push(await getDownloadURL(storageRef));
  }
  return urls;
}

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

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const raw = new FormData(form);
  const data = {};
  for (const [key, value] of raw.entries()) {
    if (key === "photos" || key.startsWith("inv_")) continue;
    data[key] = typeof value === "string" ? value : "";
  }
  const { inventory, estimate } = inventorySnapshot();
  data.inventory = inventory;
  data.inventoryEstimate = estimate;
  const photoFiles = photoInput ? [...photoInput.files].slice(0, 6) : [];

  submitBtn.disabled = true;
  submitBtn.textContent = "Envoi en cours...";
  statusEl.textContent = "";

  try {
    const submission = {
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
      photos: [],
      status: "nouveau",
      source: "site_moventra",
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, "demandes_soumission"), submission);
    if (photoFiles.length) {
      statusEl.textContent = "Téléversement des photos…";
      const photoUrls = await uploadSubmissionPhotos(docRef.id, photoFiles);
      await updateDoc(doc(db, "demandes_soumission", docRef.id), { photos: photoUrls });
    }

    const secondaryTasks = [sendMoventraWebhook(data, docRef.id)];
    if (window.emailjs) {
      secondaryTasks.push(emailjs.send("service_o6bm6tl", "template_c0smolo", {
        nom: data.name || "",
        telephone: data.phone || "",
        email: data.email || "",
        service: data.service || "",
        date: data.date || "",
        typeLogement: data.propertyType || "",
        depart: data.address || "",
        destination: data.destination || "",
        etageDepart: data.startFloor || "",
        etageArrivee: data.endFloor || "",
        details: `${data.message || ""}\n\nInventaire estimé : ${estimate.volumeM3} m³ · ${estimate.truck} · ${estimate.crew} déménageurs · ${estimate.duration}`,
        submissionId: docRef.id
      }));
    }

    const results = await Promise.allSettled(secondaryTasks);
    results.forEach((result) => {
      if (result.status === "rejected") {
        console.warn("Service secondaire non envoyé :", result.reason);
      }
    });

    statusEl.textContent = "✅ Demande envoyée avec succès. Moventra vous contactera rapidement.";
    statusEl.style.color = "#078b45";
    form.reset();
    inventoryRows.forEach(row=>{const i=row.querySelector('input[type="hidden"]'),o=row.querySelector('output');i.value=0;o.value=0;o.textContent='0'});
    document.getElementById("photoPreview").innerHTML = "";
    refreshInventoryEstimate();
  } catch (error) {
    console.error(error);
    statusEl.textContent = "❌ La demande n’a pas pu être enregistrée. Réessayez ou appelez Moventra.";
    statusEl.style.color = "#d21f3c";
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
