import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getMessaging, getToken, onMessage, isSupported } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js";
import { firebaseConfig, VAPID_KEY } from "./firebase-config.js";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function ensureStatus() {
  let el = document.getElementById("notificationStatus");
  if (!el) {
    el = document.createElement("div");
    el.id = "notificationStatus";
    el.className = "notificationStatus";
    const main = document.querySelector(".adminMain") || document.body;
    main.prepend(el);
  }
  return el;
}

function status(message, ok = true) {
  const el = ensureStatus();
  el.textContent = message;
  el.style.color = ok ? "#078b45" : "#d21f3c";
  console.log("[Didier.Elo Push]", message);
}

function getCurrentUser() {
  return new Promise((resolve) => {
    if (auth.currentUser) return resolve(auth.currentUser);
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

async function activatePush(role = "admin") {
  try {
    status("Activation des notifications...");

    const user = await getCurrentUser();
    if (!user) {
      status("Connecte-toi d’abord, puis clique encore sur Notifications.", false);
      return;
    }

    if (!("Notification" in window)) {
      status("Ce navigateur ne supporte pas les notifications.", false);
      return;
    }

    let permission = Notification.permission;
    if (permission !== "granted") {
      permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
      status("Notifications refusées dans les réglages iPhone.", false);
      return;
    }

    if (!("serviceWorker" in navigator)) {
      status("Service Worker non supporté.", false);
      return;
    }

    const supported = await isSupported().catch(() => false);
    if (!supported) {
      status("FCM Web Push non supporté sur ce navigateur.", false);
      return;
    }

    const registration = await navigator.serviceWorker.register("./firebase-messaging-sw.js", { scope: "./" });
    await navigator.serviceWorker.ready;

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });

    if (!token) {
      status("Aucun token reçu de Firebase.", false);
      return;
    }

    await setDoc(doc(db, "notification_tokens", user.uid), {
      uid: user.uid,
      email: user.email || "",
      role,
      token,
      permission: Notification.permission,
      standalone: window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches,
      userAgent: navigator.userAgent,
      updatedAt: serverTimestamp()
    }, { merge: true });

    status("✅ Notifications activées. Appareil enregistré.");
    try {
      new Notification("Didier.Elo", { body: "Notifications activées.", icon: "logo.jpeg" });
    } catch (e) {}

    onMessage(messaging, (payload) => {
      try {
        new Notification(payload.notification?.title || "Didier.Elo", {
          body: payload.notification?.body || "Nouvelle notification",
          icon: "logo.jpeg"
        });
      } catch (e) {}
    });

  } catch (error) {
    console.error(error);
    status("Erreur notifications : " + (error.code || error.message || error), false);
  }
}

window.didierEloActivatePush = activatePush;

window.addEventListener("load", () => {
  const btn = document.getElementById("enableNotificationsBtn");
  if (btn) {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const oldText = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Activation...";
      await activatePush(location.pathname.includes("employe") ? "employe" : "admin");
      btn.disabled = false;
      btn.textContent = oldText || "🔔 Notifications";
    }, true);
  }
});
