// ================================================
// KARTE
// ================================================

async function initMap() {
  if (!supabase) return;

  if (map) map.remove();

  map = L.map("map").setView([51.1657, 10.4515], 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
  }).addTo(map);

  const { data: gyms } = await supabase.from("gyms").select("*");
  const { data: openMats } = await supabase
    .from("open_mats")
    .select("*, gyms(name, city, street, postal_code, latitude, longitude)")
    .gte("event_date", new Date().toISOString());

  let bounds = [];

  if (gyms && gyms.length > 0) {
    gyms.forEach((gym) => {
      if (gym.latitude && gym.longitude) {
        L.marker([gym.latitude, gym.longitude])
          .addTo(map)
          .bindPopup(
            `<strong>${gym.name}</strong><br>${gym.street || ""}<br>${
              gym.postal_code || ""
            } ${gym.city || ""}`
          );
        bounds.push([gym.latitude, gym.longitude]);
      }
    });
  }

  if (openMats && openMats.length > 0) {
    openMats.forEach((om) => {
      if (om.gyms?.latitude && om.gyms?.longitude) {
        const date = new Date(om.event_date).toLocaleDateString("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        L.marker([om.gyms.latitude, om.gyms.longitude], {
          icon: L.divIcon({
            className: "custom-icon",
            html: "📅",
            iconSize: [30, 30],
          }),
        })
          .addTo(map)
          .bindPopup(
            `<strong>${om.title}</strong><br>${om.gyms.name}<br>${
              om.gyms.street || ""
            }<br>${om.gyms.postal_code || ""} ${
              om.gyms.city || ""
            }<br>📅 ${date}`
          );
        bounds.push([om.gyms.latitude, om.gyms.longitude]);
      }
    });
  }

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [50, 50] });
  }
}
