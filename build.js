const fs = require("fs");
const path = require("path");

// === Utility-Funktion für Logging ===
const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  ok: (msg) => console.log(`✅ ${msg}`),
  warn: (msg) => console.warn(`⚠️  ${msg}`),
  err: (msg) => console.error(`❌ ${msg}`),
};

// === 0. Umgebungsvariablen prüfen ===
const env = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_ANON_KEY,
  mapsKey: process.env.GOOGLE_MAPS_API_KEY,
};

log.info("Überprüfe Umgebungsvariablen...");
console.table({
  SUPABASE_URL: env.supabaseUrl ? "✓" : "✗",
  SUPABASE_ANON_KEY: env.supabaseKey ? "✓" : "✗",
  GOOGLE_MAPS_API_KEY: env.mapsKey ? "✓" : "✗",
});

// === 1. Verzeichnisstruktur erstellen ===
if (!fs.existsSync("dist")) fs.mkdirSync("dist");
if (!fs.existsSync("dist/icons")) fs.mkdirSync("dist/icons");

// === 2. HTML-Dateien verarbeiten ===
log.info("Kopiere und verarbeite HTML-Dateien...");

const htmlFiles = [
  "index.html",
  "chat.html",
  "offline.html",
  "datenschutz.html",
  "impressum.html",
  "agb.html",
];

htmlFiles.forEach((file) => {
  if (!fs.existsSync(file)) return log.warn(`${file} nicht gefunden`);

  let content = fs.readFileSync(file, "utf8");

  // Google Maps API Key ersetzen (robuster Regex: auch mit Zeilenumbruch/Leerzeichen)
  content = content.replace(
    /YOUR_GOOGLE_MAPS_API_KEY\s*/g,
    env.mapsKey || "YOUR_GOOGLE_MAPS_API_KEY"
  );

  fs.writeFileSync(path.join("dist", file), content);
  log.ok(`${file} verarbeitet`);
});

// === 3. CSS-Dateien ===
log.info("Kopiere CSS-Dateien...");
["styles.css", "chat.css"].forEach((file) => {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join("dist", file));
    log.ok(`${file} kopiert`);
  } else {
    log.warn(`${file} nicht gefunden`);
  }
});

// === 4. PWA-Dateien ===
log.info("Kopiere PWA-Dateien...");
["manifest.json", "service-worker.js"].forEach((file) => {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join("dist", file));
    log.ok(`${file} kopiert`);
  } else {
    log.warn(`${file} nicht gefunden`);
  }
});

// === 5. Icons ===
if (fs.existsSync("icons")) {
  const icons = fs.readdirSync("icons");
  icons.forEach((f) =>
    fs.copyFileSync(path.join("icons", f), path.join("dist/icons", f))
  );
  log.ok(`${icons.length} Icon-Datei(en) kopiert`);
} else {
  log.warn("icons-Ordner nicht gefunden");
}

// === 6. JavaScript-Dateien ===
log.info("Verarbeite JavaScript-Dateien...");

const processJs = (filename) => {
  if (!fs.existsSync(filename)) return log.warn(`${filename} nicht gefunden`);
  let js = fs.readFileSync(filename, "utf8");

  js = js
    .replace(
      /SUPABASE_URL_PLACEHOLDER/g,
      env.supabaseUrl || "SUPABASE_URL_PLACEHOLDER"
    )
    .replace(
      /SUPABASE_KEY_PLACEHOLDER/g,
      env.supabaseKey || "SUPABASE_KEY_PLACEHOLDER"
    )
    .replace(
      /YOUR_GOOGLE_MAPS_API_KEY/g,
      env.mapsKey || "YOUR_GOOGLE_MAPS_API_KEY"
    );

  fs.writeFileSync(`dist/${filename}`, js);
  log.ok(`${filename} verarbeitet`);
};

[
  "app.js",
  "chat.js",
  "app-places-helpers.js",
  "app-places-extended.js",
].forEach(processJs);

// === 7. Zusammenfassung ===
console.log("\n📦 Build abgeschlossen!");
console.log("-----------------------------");
console.log("HTML:", htmlFiles.filter((f) => fs.existsSync(f)).length);
console.log(
  "CSS: ",
  ["styles.css", "chat.css"].filter((f) => fs.existsSync(f)).length
);
console.log(
  "JS:  ",
  ["app.js", "chat.js", "app-places-helpers.js", "app-places-extended.js"].filter((f) => fs.existsSync(f)).length
);
console.log("-----------------------------");
console.log("Service Worker:", fs.existsSync("service-worker.js") ? "✓" : "✗");
console.log("Manifest:", fs.existsSync("manifest.json") ? "✓" : "✗");
console.log("Offline:", fs.existsSync("offline.html") ? "✓" : "✗");
console.log("Icons:", fs.existsSync("icons") ? "✓" : "✗");
console.log("-----------------------------");
console.log("🌍 Bereit für Deployment auf Netlify!");
