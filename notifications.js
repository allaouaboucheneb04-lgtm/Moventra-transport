export async function initNotifications(app, db, user, role) {
  if (user?.uid) window.didierCurrentUserId = user.uid;
  if (role) window.didierCurrentUserRole = role;
  if (window.didierEloEnablePush) return window.didierEloEnablePush();
  alert("Push charge encore. Attends 3 secondes puis reclique.");
}
export function showLocalNotification(title, body) {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "logo.jpeg" });
    }
  } catch(e) {}
}
