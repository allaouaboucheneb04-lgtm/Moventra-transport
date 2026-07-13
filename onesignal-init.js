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
      appId: "b7dc3eab-b127-47dd-9ad4-71295880fd34",
      serviceWorkerPath: "Moventra-transport/OneSignalSDKWorker.js",
      serviceWorkerParam: { scope: "/Moventra-transport/" },
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
