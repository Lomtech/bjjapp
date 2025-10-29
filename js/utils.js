// ================================================
// UTILITY FUNCTIONS
// ================================================

function showNotification(message, type = "success") {
  const notif = document.getElementById("notification");
  notif.textContent = message;
  notif.className = "notification show";
  if (type) notif.classList.add(type);
  setTimeout(() => notif.classList.remove("show"), 3000);
}