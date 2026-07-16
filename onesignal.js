// Compatibilité : OneSignal est initialisé uniquement par push.js.
window.enableMoventraNotifications = async () => {
  if (typeof window.moventraEnablePush !== "function") throw new Error("push.js n’est pas chargé");
  return window.moventraEnablePush();
};
