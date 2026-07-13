import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBeDOLjFyONjv06dUc4b_R0lQ4AlSBPU2U",
  authDomain: "moventra-fe20f.firebaseapp.com",
  projectId: "moventra-fe20f",
  storageBucket: "moventra-fe20f.firebasestorage.app",
  messagingSenderId: "634208041846",
  appId: "1:634208041846:web:37bf64bed692efd5f31857",};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

emailjs.init({ publicKey: "n4Ln13zFITFZtnmdL" });

const drawer = document.getElementById("drawer");
document.getElementById("openMenu").onclick = () => drawer.classList.add("open");
document.getElementById("closeMenu").onclick = () => drawer.classList.remove("open");
drawer.querySelectorAll("a").forEach(a => a.onclick = () => drawer.classList.remove("open"));

const form = document.getElementById("quoteForm");
const statusEl = document.getElementById("formStatus");
const submitBtn = document.getElementById("submitBtn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  submitBtn.disabled = true;
  submitBtn.textContent = "Envoi en cours...";
  statusEl.textContent = "";
  try {
    await addDoc(collection(db, "demandes_soumission"), {
      ...data,
      source: "site_moventra",
      createdAt: serverTimestamp()
    });
    await emailjs.send("service_yxizoav", "template_7xcmars", data);
    statusEl.textContent = "✅ Demande envoyée avec succès. Moventra vous contactera rapidement.";
    statusEl.style.color = "#078b45";
    form.reset();
  } catch (error) {
    console.error(error);
    statusEl.textContent = "❌ Erreur d’envoi. Vérifiez Firebase / EmailJS.";
    statusEl.style.color = "#d21f3c";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Envoyer la demande";
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
