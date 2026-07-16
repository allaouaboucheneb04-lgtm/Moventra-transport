// Moventra Transport — OneSignal Web SDK v16
// Configuration unique pour https://www.moventratransport.ca
const MOVENTRA_ONESIGNAL_APP_ID = "a6edf32a-9d3b-4fce-ad98-0c5ccfc43672";
const MOVENTRA_PUSH_ORIGIN = "https://www.moventratransport.ca";

window.moventraPushState = window.moventraPushState || {
  ready: false,
  loading: false,
  error: "",
  oneSignal: null,
  lastSubscriptionId: ""
};

function moventraIsStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function moventraPushStatus(message, ok = true) {
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

function moventraSetButton(text) {
  const btn = document.getElementById("enableNotificationsBtn");
  if (btn) btn.textContent = text;
}

function moventraSubscriptionId(OneSignal) {
  return OneSignal?.User?.PushSubscription?.id ||
         OneSignal?.User?.PushSubscription?.token ||
         window.moventraPushState.lastSubscriptionId || "";
}

async function saveSubscriptionToFirestore(subscriptionId) {
  try {
    const uid = window.didierCurrentUserId;
    if (!uid || !subscriptionId) return;

    const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    const { getFirestore, doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
    const { firebaseConfig } = await import("./firebase-config.js");
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    const db = getFirestore(app);

    await updateDoc(doc(db, "users", uid), {
      oneSignalId: subscriptionId,
      oneSignalUpdatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.warn("[Moventra Push] Sauvegarde Firestore ignorée:", error);
  }
}

let moventraInitPromise = null;

function initMoventraOneSignal() {
  if (window.moventraPushState.ready && window.moventraPushState.oneSignal) {
    return Promise.resolve(window.moventraPushState.oneSignal);
  }
  if (moventraInitPromise) return moventraInitPromise;

  moventraInitPromise = new Promise((resolve, reject) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];

    const timer = setTimeout(() => {
      moventraInitPromise = null;
      reject(new Error("Le SDK OneSignal n’a pas terminé son initialisation."));
    }, 30000);

    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.init({
          appId: MOVENTRA_ONESIGNAL_APP_ID,
          // Le chemin est relatif à la racine, comme recommandé par OneSignal.
          serviceWorkerPath: "OneSignalSDKWorker.js",
          serviceWorkerParam: { scope: "/" },
          notifyButton: { enable: false },
          welcomeNotification: { disable: true },
          allowLocalhostAsSecureOrigin: false
        });

        clearTimeout(timer);
        window.moventraPushState.ready = true;
        window.moventraPushState.oneSignal = OneSignal;
        window.moventraPushState.error = "";

        const updateState = async () => {
          const id = moventraSubscriptionId(OneSignal);
          if (id) {
            window.moventraPushState.lastSubscriptionId = id;
            await saveSubscriptionToFirestore(id);
          }
          window.dispatchEvent(new CustomEvent("moventra-push-state-changed", {
            detail: {
              id,
              optedIn: Boolean(OneSignal.User?.PushSubscription?.optedIn),
              permission: Boolean(OneSignal.Notifications?.permission)
            }
          }));
        };

        try {
          OneSignal.User.PushSubscription.addEventListener("change", updateState);
          OneSignal.Notifications.addEventListener("permissionChange", updateState);
        } catch (listenerError) {
          console.warn("[Moventra Push] Listener OneSignal:", listenerError);
        }

        await updateState();
        resolve(OneSignal);
      } catch (error) {
        clearTimeout(timer);
        window.moventraPushState.ready = false;
        window.moventraPushState.oneSignal = null;
        window.moventraPushState.error = error?.message || String(error);
        moventraInitPromise = null;
        reject(error);
      }
    });

    // Secours pour les pages qui n'ont pas encore la balise officielle du SDK.
    if (!document.querySelector('script[src*="OneSignalSDK.page.js"]')) {
      const sdk = document.createElement("script");
      sdk.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
      sdk.defer = true;
      sdk.dataset.moventraOneSignalSdk = "1";
      sdk.onerror = () => {
        clearTimeout(timer);
        moventraInitPromise = null;
        reject(new Error("Impossible de télécharger le SDK OneSignal."));
      };
      document.head.appendChild(sdk);
    }
  });

  return moventraInitPromise;
}

function waitForSubscription(OneSignal, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const currentId = moventraSubscriptionId(OneSignal);
    if (currentId || OneSignal.User?.PushSubscription?.optedIn) {
      resolve({ id: currentId, optedIn: Boolean(OneSignal.User?.PushSubscription?.optedIn) });
      return;
    }

    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { OneSignal.User.PushSubscription.removeEventListener("change", onChange); } catch (_) {}
      resolve(result);
    };
    const onChange = () => {
      const id = moventraSubscriptionId(OneSignal);
      const optedIn = Boolean(OneSignal.User?.PushSubscription?.optedIn);
      if (id || optedIn) finish({ id, optedIn });
    };
    const timer = setTimeout(() => finish({ id: moventraSubscriptionId(OneSignal), optedIn: Boolean(OneSignal.User?.PushSubscription?.optedIn) }), timeoutMs);

    try { OneSignal.User.PushSubscription.addEventListener("change", onChange); } catch (_) {}
    const poll = setInterval(() => {
      if (done) return clearInterval(poll);
      onChange();
    }, 500);
    setTimeout(() => clearInterval(poll), timeoutMs + 1000);
  });
}

window.moventraEnablePush = async function () {
  if (window.moventraPushState.loading) return false;
  window.moventraPushState.loading = true;
  moventraSetButton("Activation...");

  try {
    if (location.origin !== MOVENTRA_PUSH_ORIGIN) {
      throw new Error(`Ouvre l’application depuis ${MOVENTRA_PUSH_ORIGIN}. Domaine actuel : ${location.origin}`);
    }
    if (!("Notification" in window)) {
      throw new Error("Ce navigateur ne prend pas en charge les notifications Web.");
    }
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS && !moventraIsStandalone()) {
      throw new Error("Sur iPhone, ouvre Moventra depuis l’icône ajoutée à l’écran d’accueil.");
    }

    const OneSignal = await initMoventraOneSignal();

    if (!OneSignal.Notifications.permission) {
      moventraPushStatus("Demande d’autorisation iPhone...");
      await OneSignal.Notifications.requestPermission();
    }

    if (!OneSignal.Notifications.permission && Notification.permission !== "granted") {
      if (Notification.permission === "denied") {
        throw new Error("Notifications refusées. Active-les dans Réglages iPhone > Notifications > Moventra Admin.");
      }
      throw new Error("L’autorisation des notifications n’a pas été accordée.");
    }

    moventraPushStatus("Création de l’abonnement OneSignal...");
    await OneSignal.User.PushSubscription.optIn();

    const result = await waitForSubscription(OneSignal, 30000);
    const id = result.id || moventraSubscriptionId(OneSignal);
    const optedIn = result.optedIn || Boolean(OneSignal.User?.PushSubscription?.optedIn);

    if (!id && !optedIn) {
      throw new Error("Permission accordée, mais aucun abonnement OneSignal n’a été créé. Vérifie que l’application OneSignal correspond à l’App ID a6edf32a… et au domaine www.moventratransport.ca.");
    }

    if (id) {
      window.moventraPushState.lastSubscriptionId = id;
      await saveSubscriptionToFirestore(id);
    }
    moventraPushStatus("✅ Notifications du téléphone activées.", true);
    window.dispatchEvent(new CustomEvent("moventra-push-activated"));
    return true;
  } catch (error) {
    console.error("[Moventra Push]", error);
    moventraPushStatus("Erreur Push : " + (error?.message || error), false);
    return false;
  } finally {
    window.moventraPushState.loading = false;
    moventraSetButton("🔔 Notifications");
  }
};

window.moventraPushDebugInfo = async function () {
  try { await initMoventraOneSignal(); } catch (_) {}
  const OneSignal = window.moventraPushState.oneSignal;
  const registration = "serviceWorker" in navigator
    ? await navigator.serviceWorker.getRegistration("/").catch(() => null)
    : null;
  return {
    origin: location.origin,
    expectedOrigin: MOVENTRA_PUSH_ORIGIN,
    originMatches: location.origin === MOVENTRA_PUSH_ORIGIN,
    standalone: moventraIsStandalone(),
    notificationPermission: "Notification" in window ? Notification.permission : "unsupported",
    oneSignalPermission: Boolean(OneSignal?.Notifications?.permission),
    oneSignalReady: window.moventraPushState.ready,
    oneSignalError: window.moventraPushState.error,
    pushSubscriptionId: moventraSubscriptionId(OneSignal),
    pushOptedIn: Boolean(OneSignal?.User?.PushSubscription?.optedIn),
    serviceWorkerScript: registration?.active?.scriptURL || registration?.waiting?.scriptURL || registration?.installing?.scriptURL || ""
  };
};

// Préchargement silencieux. Aucune permission n'est demandée sans clic utilisateur.
initMoventraOneSignal().catch((error) => {
  console.warn("[Moventra Push] Préchargement OneSignal:", error);
});

window.didierEloEnablePush = window.moventraEnablePush;
window.didierEloPushDebugInfo = window.moventraPushDebugInfo;
