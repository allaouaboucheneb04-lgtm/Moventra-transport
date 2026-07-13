export async function initNotifications(app, db, user, role) {
  if (user?.uid) window.didierCurrentUserId = user.uid;
  if (role) window.didierCurrentUserRole = role;

  // push.js is loaded as a normal deferred script. Wait briefly if the module
  // button is clicked before that script has finished loading.
  for (let i = 0; i < 30; i++) {
    if (typeof window.didierEloEnablePush === "function") {
      return window.didierEloEnablePush();
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Le module OneSignal n’a pas chargé. Recharge l’application puis réessaie.");
}

export function showLocalNotification(title, body) {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "logo.jpeg" });
    }
  } catch (_) {}
}
