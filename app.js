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
      details: data.message || ""
    })
  });

  if (!response.ok) {
    throw new Error(`Webhook Make HTTP ${response.status}`);
  }
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());

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
      status: "nouveau",
      source: "site_moventra",
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, "demandes_soumission"), submission);

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
        details: data.message || "",
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
