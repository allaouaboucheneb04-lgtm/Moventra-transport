// Moventra Transport — configuration OneSignal unique (Web SDK v16)
(() => {
  "use strict";

  const APP_ID = "b7dc3eab-b127-47dd-9ad4-71295880fd34";
  const SAFARI_WEB_ID = "web.onesignal.auto.01d22b73-bccb-4a84-9633-69c73285f3f4";
  const EXPECTED_ORIGIN = "https://www.moventratransport.ca";
  const BUILD = "onesignal-clean-20260719-1";

  const state = window.moventraPushState = window.moventraPushState || {
    initialized: false,
    initializing: false,
    activating: false,
    oneSignal: null,
    error: "",
    subscriptionId: ""
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

  function status(message, ok = true) {
    const el = document.getElementById("notificationStatus") || document.getElementById("adminDebugBox");
    if (el) {
      el.textContent = message;
      el.style.color = ok ? "#078b45" : "#d21f3c";
    }
    console[ok ? "log" : "warn"]("[Moventra OneSignal]", message);
  }

  function getSubscriptionId(OneSignal) {
    return String(OneSignal?.User?.PushSubscription?.id || state.subscriptionId || "");
  }

  function permissionGranted(OneSignal) {
    return Notification.permission === "granted" || OneSignal?.Notifications?.permission === true;
  }

  function subscriptionOptedIn(OneSignal) {
    return OneSignal?.User?.PushSubscription?.optedIn === true;
  }

  async function saveSubscriptionId(id) {
    if (!id || !window.didierCurrentUserId) return;
    try {
      const [{ initializeApp, getApps }, { getFirestore, doc, setDoc }, { firebaseConfig }] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js"),
        import("./firebase-config.js")
      ]);
      const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
      await setDoc(doc(getFirestore(app), "users", window.didierCurrentUserId), {
        oneSignalId: id,
        oneSignalUpdatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.warn("[Moventra OneSignal] Sauvegarde Firestore ignorée:", error);
    }
  }

  let readyResolve;
  let readyReject;
  const readyPromise = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  window.moventraOneSignalReady = readyPromise;

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async function(OneSignal) {
    if (state.initializing || state.initialized) {
      if (state.initialized) readyResolve(OneSignal);
      return;
    }
    state.initializing = true;
    try {
      await OneSignal.init({
        appId: APP_ID,
        safari_web_id: SAFARI_WEB_ID,
        serviceWorkerPath: "OneSignalSDKWorker.js",
        serviceWorkerParam: { scope: "/" },
        notifyButton: { enable: false },
        welcomeNotification: { disable: true }
      });

      state.oneSignal = OneSignal;
      state.initialized = true;
      state.error = "";

      const sync = () => {
        const id = getSubscriptionId(OneSignal);
        if (id) {
          state.subscriptionId = id;
          saveSubscriptionId(id);
        }
        window.dispatchEvent(new CustomEvent("moventra-push-state-change", {
          detail: {
            permission: permissionGranted(OneSignal),
            optedIn: subscriptionOptedIn(OneSignal),
            subscriptionId: id
          }
        }));
      };

      OneSignal.Notifications.addEventListener("permissionChange", sync);
      OneSignal.User.PushSubscription.addEventListener("change", sync);
      sync();
      readyResolve(OneSignal);
    } catch (error) {
      state.error = error?.message || String(error);
      readyReject(error);
      status("Erreur OneSignal : " + state.error, false);
    } finally {
      state.initializing = false;
    }
  });

  async function getOneSignal(timeoutMs = 20000) {
    return Promise.race([
      readyPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Le SDK OneSignal ne s’est pas initialisé.")), timeoutMs))
    ]);
  }

  window.moventraGetPushState = async function() {
    let OneSignal = state.oneSignal;
    try { OneSignal = OneSignal || await getOneSignal(8000); } catch (_) {}
    return {
      supported: "Notification" in window,
      standalone: isStandalone(),
      permission: "Notification" in window ? Notification.permission : "unsupported",
      oneSignalPermission: OneSignal?.Notifications?.permission === true,
      optedIn: subscriptionOptedIn(OneSignal),
      subscriptionId: getSubscriptionId(OneSignal),
      initialized: state.initialized,
      error: state.error,
      origin: location.origin,
      originMatches: location.origin === EXPECTED_ORIGIN,
      build: BUILD
    };
  };

  window.moventraEnablePush = async function() {
    if (state.activating) return false;
    state.activating = true;
    try {
      if (!("Notification" in window)) throw new Error("Ce navigateur ne prend pas en charge les notifications.");
      if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !isStandalone()) {
        throw new Error("Sur iPhone, ouvre Moventra depuis l’icône ajoutée à l’écran d’accueil.");
      }
      if (location.origin !== EXPECTED_ORIGIN) {
        throw new Error("Ouvre l’application depuis https://www.moventratransport.ca.");
      }

      const OneSignal = await getOneSignal();

      if (!permissionGranted(OneSignal)) {
        status("Demande d’autorisation…");
        await OneSignal.Notifications.requestPermission();
      }

      if (!permissionGranted(OneSignal)) {
        if (Notification.permission === "denied") {
          throw new Error("Notifications bloquées dans les réglages de l’iPhone.");
        }
        throw new Error("L’autorisation de notification n’a pas été accordée.");
      }

      if (!subscriptionOptedIn(OneSignal)) {
        status("Activation de l’abonnement OneSignal…");
        await OneSignal.User.PushSubscription.optIn();
      }

      // L’identifiant peut arriver après la permission sur iOS. On l’attend sans recharger la page.
      for (let i = 0; i < 40 && !getSubscriptionId(OneSignal); i++) await sleep(250);
      const id = getSubscriptionId(OneSignal);
      if (id) {
        state.subscriptionId = id;
        await saveSubscriptionId(id);
      }

      const active = permissionGranted(OneSignal) && (subscriptionOptedIn(OneSignal) || Boolean(id));
      if (active) {
        status("✅ Notifications du téléphone activées.");
        window.dispatchEvent(new CustomEvent("moventra-push-activated"));
        return true;
      }

      throw new Error("Permission accordée, mais OneSignal n’a pas créé l’abonnement. Vérifie le worker et la configuration Web Push.");
    } catch (error) {
      status(error?.message || String(error), false);
      return false;
    } finally {
      state.activating = false;
    }
  };

  window.moventraPushDebugInfo = async function() {
    const info = await window.moventraGetPushState();
    info.files = {};
    for (const path of ["/OneSignalSDKWorker.js", "/admin-manifest.json", "/push.js"]) {
      try {
        const response = await fetch(path + "?v=" + Date.now(), { cache: "no-store" });
        info.files[path] = `${response.status} ${response.ok ? "OK" : "ERREUR"}`;
      } catch (error) {
        info.files[path] = "ERREUR " + error.message;
      }
    }
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      info.serviceWorkers = regs.map(r => ({ scope: r.scope, active: r.active?.scriptURL || "" }));
    }
    return info;
  };

  // Alias conservés pour les pages existantes.
  window.didierEloEnablePush = window.moventraEnablePush;
  window.didierEloPushDebugInfo = window.moventraPushDebugInfo;
})();
