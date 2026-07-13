// Moventra Transport - OneSignal Web SDK v16
const MOVENTRA_ONESIGNAL_APP_ID = "b7dc3eab-b127-47dd-9ad4-71295880fd34";

window.moventraPushState = window.moventraPushState || {
  ready: false,
  loading: false,
  error: "",
  oneSignal: null,
  lastSubscriptionId: ""
};

function didierPushStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function didierPushStatus(message, ok = true) {
  let el = document.getElementById("notificationStatus") || document.getElementById("adminDebugBox");
  if (!el) {
    el = document.createElement("p");
    el.id = "notificationStatus";
    el.className = "notificationStatus";
    const main = document.querySelector(".adminMain") || document.querySelector("main") || document.body;
    main.prepend(el);
  }
  el.textContent = message;
  el.style.color = ok ? "#078b45" : "#d21f3c";
  console.log("[Moventra Push]", message);
}

function didierPermissionText() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function didierSetButton(text) {
  const btn = document.getElementById("enableNotificationsBtn");
  if (btn) btn.textContent = text;
}

function didierGetSubId(OneSignal) {
  return OneSignal?.User?.PushSubscription?.id ||
         OneSignal?.User?.PushSubscription?.token ||
         window.moventraPushState.lastSubscriptionId ||
         "";
}

// Sauvegarde le Subscription ID dans Firestore pour ciblage précis
async function saveSubscriptionToFirestore(subscriptionId) {
  try {
    const uid = window.didierCurrentUserId;
    if (!uid || !subscriptionId) return;

    // Import Firebase dynamiquement
    const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    const { getFirestore, doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
    const { firebaseConfig } = await import("./firebase-config.js");

    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    const db = getFirestore(app);

    await updateDoc(doc(db, "users", uid), {
      oneSignalId: subscriptionId,
      oneSignalUpdatedAt: new Date().toISOString()
    });
    console.log("[Moventra Push] Subscription ID sauvegardé dans Firestore:", subscriptionId);
  } catch(e) {
    console.warn("[Moventra Push] Impossible de sauvegarder dans Firestore:", e);
  }
}

let didierLoadPromise = null;

function loadOneSignalSdkOnce() {
  if (window.moventraPushState.ready && window.moventraPushState.oneSignal) {
    return Promise.resolve(window.moventraPushState.oneSignal);
  }
  if (didierLoadPromise) return didierLoadPromise;

  didierLoadPromise = new Promise((resolve, reject) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];

    window.OneSignalDeferred.push(async function(OneSignal) {
      try {
        await OneSignal.init({
          appId: MOVENTRA_ONESIGNAL_APP_ID,
          serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js",
          serviceWorkerParam: { scope: "/Moventra-transport/push/onesignal/" },
          notifyButton: { enable: false },
          welcomeNotification: { disable: true }
        });

        window.moventraPushState.ready = true;
        window.moventraPushState.loading = false;
        window.moventraPushState.oneSignal = OneSignal;

        const id = didierGetSubId(OneSignal);
        if (id) {
          window.moventraPushState.lastSubscriptionId = id;
          saveSubscriptionToFirestore(id);
        }

        try {
          OneSignal.User.PushSubscription.addEventListener("change", function(event) {
            console.log("PushSubscription changed", event);
            const newId = didierGetSubId(OneSignal);
            if (newId) {
              window.moventraPushState.lastSubscriptionId = newId;
              didierPushStatus("✅ Notifications activées. ID: " + newId, true);
              saveSubscriptionToFirestore(newId);
            }
          });
        } catch(e) {
          console.warn("listener error", e);
        }

        resolve(OneSignal);
      } catch(e) {
        window.moventraPushState.error = e.message || String(e);
        window.moventraPushState.loading = false;
        didierLoadPromise = null;
        didierPushStatus("Erreur init OneSignal: " + window.moventraPushState.error, false);
        reject(e);
      }
    });

    if (!document.querySelector('script[src*="OneSignalSDK.page.js"]')) {
      const s = document.createElement("script");
      s.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
      s.async = true;
      s.onerror = () => { didierLoadPromise = null; reject(new Error("Impossible de charger OneSignalSDK.page.js")); };
      document.head.appendChild(s);
    }
  });

  return didierLoadPromise;
}

async function waitForOneSignal(maxMs = 15000) {
  if (window.moventraPushState.ready && window.moventraPushState.oneSignal) return window.moventraPushState.oneSignal;
  const p = loadOneSignalSdkOnce();
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("OneSignal ne charge pas. Recharge l'app puis réessaie.")), maxMs)
  );
  return Promise.race([p, timeout]);
}

loadOneSignalSdkOnce().then((OneSignal) => {
  const id = didierGetSubId(OneSignal);
  const opted = OneSignal?.User?.PushSubscription?.optedIn || false;
  if (id) didierPushStatus("✅ Notifications déjà activées. ID: " + id, true);
  else if (opted || (("Notification" in window) && Notification.permission === "granted")) didierPushStatus("✅ Notifications déjà autorisées.", true);
  else didierPushStatus("Push prêt. Clique 🔔 Notifications.", true);
}).catch(e => console.warn("OneSignal preload failed", e));

window.moventraEnablePush = async function() {
  if (window.moventraPushState.loading) {
    didierPushStatus("Activation déjà en cours...", true);
    return;
  }

  window.moventraPushState.loading = true;
  didierSetButton("Activation...");

  try {
    if (!("Notification" in window)) {
      didierPushStatus("Ce navigateur ne supporte pas les notifications. Ouvre l'icône installée sur iPhone.", false);
      return;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS && !didierPushStandalone()) {
      didierPushStatus("Sur iPhone, ouvre Moventra depuis l’icône ajoutée à l’écran d’accueil, puis reclique sur Notifications.", false);
      return;
    }

    didierPushStatus("Chargement OneSignal...");
    const OneSignal = await waitForOneSignal();

    const currentId = didierGetSubId(OneSignal);
    const currentOpted = OneSignal?.User?.PushSubscription?.optedIn || false;

    if (currentId) {
      window.moventraPushState.lastSubscriptionId = currentId;
      await saveSubscriptionToFirestore(currentId);
      didierPushStatus("✅ Notifications déjà activées. ID: " + currentId, true);
      return;
    }
    if (currentOpted && Notification.permission === "granted") {
      didierPushStatus("✅ Notifications déjà activées.", true);
      return;
    }

    if (Notification.permission === "denied") {
      didierPushStatus("Notifications bloquées. Réglages iPhone > Notifications > Moventra Transport > Autoriser.", false);
      return;
    }

    if (Notification.permission !== "granted") {
      didierPushStatus("Demande autorisation...");
      await OneSignal.Notifications.requestPermission();
      if (Notification.permission !== "granted" && OneSignal.Slidedown?.promptPush) {
        await OneSignal.Slidedown.promptPush();
      }
    }

    const granted = Notification.permission === "granted" || OneSignal.Notifications.permission;
    if (!granted) {
      didierPushStatus("Autorisation non accordée.", false);
      return;
    }

    didierPushStatus("Création abonnement OneSignal...");
    try {
      await OneSignal.User.PushSubscription.optIn();
    } catch(e) {
      console.warn("optIn warning", e);
    }

    let id = "";
    let opted = false;
    for (let i = 0; i < 30; i++) {
      id = didierGetSubId(OneSignal);
      opted = OneSignal?.User?.PushSubscription?.optedIn || false;
      if (id) break;
      await new Promise(r => setTimeout(r, 500));
    }

    if (id) {
      window.moventraPushState.lastSubscriptionId = id;
      await saveSubscriptionToFirestore(id);
      didierPushStatus("✅ Notifications activées. ID: " + id, true);
    } else if (opted || Notification.permission === "granted") {
      didierPushStatus("✅ Notifications activées.", true);
    } else {
      didierPushStatus("❌ Abonnement non créé. Vérifie ta connexion internet et réessaie.", false);
    }
  } catch(e) {
    console.error(e);
    didierPushStatus("Erreur Push: " + (e.message || e), false);
  } finally {
    window.moventraPushState.loading = false;
    didierSetButton("🔔 Notifications");
  }
};

window.moventraPushDebugInfo = async function() {
  try { await waitForOneSignal(5000); } catch(e) { console.warn(e); }
  const OneSignal = window.moventraPushState.oneSignal;
  const info = {
    origin: location.origin,
    href: location.href,
    userAgent: navigator.userAgent,
    standalone: didierPushStandalone(),
    notificationPermission: didierPermissionText(),
    oneSignalReady: window.moventraPushState.ready,
    oneSignalError: window.moventraPushState.error,
    pushSubscriptionId: didierGetSubId(OneSignal),
    pushOptedIn: OneSignal?.User?.PushSubscription?.optedIn || false
  };
  const files = ["push/onesignal/OneSignalSDKWorker.js", "push.js", "manifest.json", "admin-manifest.json"];
  info.files = {};
  for (const f of files) {
    try {
      const r = await fetch("/Moventra-transport/" + f + "?t=" + Date.now(), { cache: "no-store" });
      info.files["/Moventra-transport/" + f] = r.status + (r.ok ? " OK" : " ERROR");
    } catch(e) {
      info.files["/Moventra-transport/" + f] = "ERROR " + e.message;
    }
  }
  return info;
};

// Compatibility aliases used by the existing admin/employee pages.
window.didierEloEnablePush = window.moventraEnablePush;
window.didierEloPushDebugInfo = window.moventraPushDebugInfo;
