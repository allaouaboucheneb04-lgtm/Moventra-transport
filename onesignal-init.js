window.OneSignalDeferred = window.OneSignalDeferred || [];
window.didierEloOneSignalReady = false;

function didierNotifStatus(message, ok = true) {
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
  console.log("[OneSignal Moventra]", message);
}

OneSignalDeferred.push(async function(OneSignal) {
  try {
    await OneSignal.init({
      appId: "a6edf32a-9d3b-4fce-ad98-0c5ccfc43672",
      serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js",
      serviceWorkerParam: { scope: "/Moventra-transport/push/onesignal/" },
      notifyButton: { enable: false }
    });
    window.didierEloOneSignal = OneSignal;
    window.didierEloOneSignalReady = true;
    didierNotifStatus("OneSignal prêt. Clique 🔔 Notifications.", true);
  } catch (error) {
    console.error("OneSignal init error", error);
    didierNotifStatus("Erreur init OneSignal: " + (error.message || error), false);
  }
});
