// ================================================
// HTML RENDER ENGINE
// ================================================

async function loadHTMLPartial(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to load ${path}`);
    return await response.text();
  } catch (error) {
    console.error(`Error loading HTML partial: ${path}`, error);
    return "";
  }
}

async function renderApp() {
  const container = document.getElementById("app-container");
  if (!container) return;

  const [
    header,
    welcome,
    dashboard,
    profile,
    athletes,
    gyms,
    openmats,
    friends,
    messages,
    map,
    authModal,
    openmatChatModal,
  ] = await Promise.all([
    loadHTMLPartial("html/partials/header.html"),
    loadHTMLPartial("html/tabs/welcome.html"),
    loadHTMLPartial("html/tabs/dashboard.html"),
    loadHTMLPartial("html/tabs/profile.html"),
    loadHTMLPartial("html/tabs/athletes.html"),
    loadHTMLPartial("html/tabs/gyms.html"),
    loadHTMLPartial("html/tabs/openmats.html"),
    loadHTMLPartial("html/tabs/friends.html"),
    loadHTMLPartial("html/tabs/messages.html"),
    loadHTMLPartial("html/tabs/map.html"),
    loadHTMLPartial("html/modals/auth.html"),
    loadHTMLPartial("html/modals/openmat-chat.html"),
  ]);

  container.innerHTML = `
    ${header}
    ${welcome}
    ${dashboard}
    ${profile}
    ${athletes}
    ${gyms}
    ${openmats}
    ${friends}
    ${messages}
    ${map}
  `;

  document.body.insertAdjacentHTML("beforeend", authModal);
  document.body.insertAdjacentHTML("beforeend", openmatChatModal);
}

document.addEventListener("DOMContentLoaded", renderApp);
