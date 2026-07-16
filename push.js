// Moventra Transport - OneSignal Web SDK v16
const MOVENTRA_ONESIGNAL_APP_ID = "b7dc3eab-b127-47dd-9ad4-71295880fd34";
const MOVENTRA_PUSH_ORIGIN = "https://www.moventratransport.ca";


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

    let finished = false;
    const failTimer = setTimeout(() => {
      if (!finished) {
        didierLoadPromise = null;
        reject(new Error("Le SDK OneSignal n’a pas démarré. Vérifie la connexion et recharge l’application."));
      }
    }, 20000);

    window.OneSignalDeferred.push(async function(OneSignal) {
      try {
        try {
          await OneSignal.init({
            appId: MOVENTRA_ONESIGNAL_APP_ID,
            serviceWorkerPath: "/OneSignalSDKWorker.js",
            serviceWorkerParam: { scope: "/" },
            notifyButton: { enable: false },
            welcomeNotification: { disable: true }
          });
        } catch (initError) {
          const msg = String(initError?.message || initError || "").toLowerCase();
          if (!msg.includes("already initialized") &&
              !msg.includes("already been initialized") &&
              !msg.includes("déjà initialisé")) {
            throw initError;
          }
          console.info("[Moventra Push] SDK déjà initialisé : instance réutilisée.");
        }

        finished = true;
        clearTimeout(failTimer);
        window.moventraPushState.ready = true;
        window.moventraPushState.loading = false;
        window.moventraPushState.oneSignal = OneSignal;
        window.moventraPushState.error = "";

        const id = didierGetSubId(OneSignal);
        if (id) {
          window.moventraPushState.lastSubscriptionId = id;
          saveSubscriptionToFirestore(id);
        }

        try {
          OneSignal.User.PushSubscription.addEventListener("change", function(event) {
            console.log("[Moventra Push] Subscription changed", event);
            const newId = didierGetSubId(OneSignal);
            if (newId) {
              window.moventraPushState.lastSubscriptionId = newId;
              didierPushStatus("✅ Notifications activées.", true);
              saveSubscriptionToFirestore(newId);
            }
          });
        } catch (e) {
          console.warn("[Moventra Push] Listener:", e);
        }

        resolve(OneSignal);
      } catch (e) {
        finished = true;
        clearTimeout(failTimer);
        window.moventraPushState.error = e.message || String(e);
        window.moventraPushState.loading = false;
        didierLoadPromise = null;
        didierPushStatus("Erreur init OneSignal: " + window.moventraPushState.error, false);
        reject(e);
      }
    });

    // Le SDK est désormais chargé directement dans le HTML avec le snippet officiel.
    // Secours uniquement si une page ancienne n’a pas encore la balise SDK.
    if (!document.querySelector('script[src*="OneSignalSDK.page.js"]')) {
      const sdk = document.createElement("script");
      sdk.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
      sdk.defer = true;
      sdk.dataset.moventraOneSignalSdk = "1";
      sdk.onerror = () => {
        finished = true;
        clearTimeout(failTimer);
        didierLoadPromise = null;
        reject(new Error("Impossible de télécharger le SDK OneSignal."));
      };
      document.head.appendChild(sdk);
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
    return false;
  }

  window.moventraPushState.loading = true;
  didierSetButton("Activation...");

  try {
    if (!("Notification" in window)) {
      didierPushStatus("Ce navigateur ne supporte pas les notifications. Ouvre Moventra depuis l’icône installée sur l’iPhone.", false);
      return false;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS && !didierPushStandalone()) {
      didierPushStatus("Sur iPhone, ouvre Moventra depuis l’icône ajoutée à l’écran d’accueil.", false);
      return false;
    }

    // Le SDK est préchargé au démarrage de la page. La demande OneSignal
    // doit être déclenchée depuis le clic de l’utilisateur pour iOS.
    didierPushStatus("Préparation de OneSignal...");
    const OneSignal = await waitForOneSignal(25000);

    let permission = OneSignal.Notifications.permission
      ? "granted"
      : Notification.permission;

    if (permission === "default") {
      didierPushStatus("Demande d’autorisation iPhone...");
      const granted = await OneSignal.Notifications.requestPermission();
      permission = granted || OneSignal.Notifications.permission || Notification.permission === "granted"
        ? "granted"
        : Notification.permission;
    }

    if (Notification.permission === "denied" || permission === "denied") {
      didierPushStatus("Notifications bloquées. Ouvre Réglages iPhone > Notifications > Moventra Admin, puis active Autoriser les notifications.", false);
      return false;
    }

    if (Notification.permission !== "granted" && !OneSignal.Notifications.permission) {
      didierPushStatus("Autorisation non accordée par l’iPhone.", false);
      return false;
    }

    didierPushStatus("Création de l’abonnement OneSignal...");

    try {
      await OneSignal.User.PushSubscription.optIn();
    } catch (e) {
      console.warn("[Moventra Push] optIn:", e);
    }

    // Attend l’événement réel de création de l’abonnement.
    let id = "";
    let opted = false;
    for (let i = 0; i < 80; i++) {
      id = didierGetSubId(OneSignal);
      opted = Boolean(OneSignal?.User?.PushSubscription?.optedIn);
      if (id || opted) break;
      await new Promise(r => setTimeout(r, 250));
    }

    if (id) {
      window.moventraPushState.lastSubscriptionId = id;
      await saveSubscriptionToFirestore(id);
      didierPushStatus("✅ Notifications du téléphone activées.", true);
      window.dispatchEvent(new CustomEvent("moventra-push-activated"));
      return true;
    }

    // Sur iPhone, la permission peut être accordée quelques secondes avant
    // que OneSignal fournisse l'identifiant d'abonnement. Ne recharge surtout
    // pas la page : le rechargement interrompt précisément cette création.
    if (opted || Notification.permission === "granted" || OneSignal.Notifications.permission) {
      didierPushStatus("✅ Notifications autorisées. OneSignal termine l’abonnement en arrière-plan.", true);
      window.dispatchEvent(new CustomEvent("moventra-push-activated"));
      return true;
    }

    didierPushStatus("Autorisation accordée, mais l’abonnement n’est pas encore prêt. Laisse l’application ouverte quelques secondes puis appuie de nouveau sur la cloche.", false);
    return false;
  } catch (e) {
    console.error("[Moventra Push]", e);
    didierPushStatus("Erreur Push: " + (e.message || e), false);
    return false;
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
    expectedOrigin: MOVENTRA_PUSH_ORIGIN,
    originMatches: location.origin === MOVENTRA_PUSH_ORIGIN,
    href: location.href,
    userAgent: navigator.userAgent,
    standalone: didierPushStandalone(),
    notificationPermission: didierPermissionText(),
    oneSignalReady: window.moventraPushState.ready,
    oneSignalError: window.moventraPushState.error,
    pushSubscriptionId: didierGetSubId(OneSignal),
    pushOptedIn: OneSignal?.User?.PushSubscription?.optedIn || false
  };
  const files = ["OneSignalSDKWorker.js", "push.js", "manifest.json", "admin-manifest.json"];
  info.files = {};
  for (const f of files) {
    try {
      const r = await fetch("/" + f + "?t=" + Date.now(), { cache: "no-store" });
      info.files["/" + f] = r.status + (r.ok ? " OK" : " ERROR");
    } catch(e) {
      info.files["/" + f] = "ERROR " + e.message;
    }
  }
  return info;
};

// Compatibility aliases used by the existing admin/employee pages.
window.didierEloEnablePush = window.moventraEnablePush;
window.didierEloPushDebugInfo = window.moventraPushDebugInfo;
