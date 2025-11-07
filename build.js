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
log.info("Erstelle Build-Verzeichnis...");
if (!fs.existsSync("dist")) {
  fs.mkdirSync("dist");
  log.ok("dist/ erstellt");
}
if (!fs.existsSync("dist/icons")) {
  fs.mkdirSync("dist/icons");
  log.ok("dist/icons/ erstellt");
}

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

let htmlCount = 0;
htmlFiles.forEach((file) => {
  if (!fs.existsSync(file)) {
    log.warn(`${file} nicht gefunden - übersprungen`);
    return;
  }

  let content = fs.readFileSync(file, "utf8");

  // Google Maps API Key ersetzen (alle Varianten)
  if (env.mapsKey) {
    content = content
      .replace(/YOUR_GOOGLE_MAPS_API_KEY/g, env.mapsKey)
      .replace(/GOOGLE_MAPS_API_KEY_PLACEHOLDER/g, env.mapsKey)
      .replace(/DEIN_API_KEY_HIER/g, env.mapsKey);
  }

  fs.writeFileSync(path.join("dist", file), content);
  log.ok(`${file} verarbeitet`);
  htmlCount++;
});

// === 3. CSS-Dateien ===
log.info("Kopiere CSS-Dateien...");
const cssFiles = [
  "styles.css",
  "chat.css",
  "places-styles-addon.css", // NEU: Places Styles
];

let cssCount = 0;
cssFiles.forEach((file) => {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join("dist", file));
    log.ok(`${file} kopiert`);
    cssCount++;
  } else {
    log.warn(`${file} nicht gefunden - übersprungen`);
  }
});

// === 4. PWA-Dateien ===
log.info("Kopiere PWA-Dateien...");
const pwaFiles = ["manifest.json", "service-worker.js"];

pwaFiles.forEach((file) => {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join("dist", file));
    log.ok(`${file} kopiert`);
  } else {
    log.warn(`${file} nicht gefunden - übersprungen`);
  }
});

// === 5. Icons ===
log.info("Kopiere Icons...");
if (fs.existsSync("icons")) {
  const icons = fs.readdirSync("icons");
  icons.forEach((f) => {
    const src = path.join("icons", f);
    const dest = path.join("dist/icons", f);
    fs.copyFileSync(src, dest);
  });
  log.ok(`${icons.length} Icon-Datei(en) kopiert`);
} else {
  log.warn("icons-Ordner nicht gefunden");
}

// === 6. JavaScript-Dateien ===
log.info("Verarbeite JavaScript-Dateien...");

const processJs = (filename) => {
  if (!fs.existsSync(filename)) {
    log.warn(`${filename} nicht gefunden - übersprungen`);
    return false;
  }

  let js = fs.readFileSync(filename, "utf8");

  // Ersetze alle Platzhalter
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
    )
    .replace(
      /GOOGLE_MAPS_API_KEY_PLACEHOLDER/g,
      env.mapsKey || "GOOGLE_MAPS_API_KEY_PLACEHOLDER"
    )
    .replace(/DEIN_API_KEY_HIER/g, env.mapsKey || "DEIN_API_KEY_HIER");

  fs.writeFileSync(`dist/${filename}`, js);
  log.ok(`${filename} verarbeitet`);
  return true;
};

// Core Dateien (erforderlich)
const coreJs = ["app.js", "chat.js"];

// Places API Dateien (optional)
const placesJs = [
  "app-places-extended.js",
  "app-places-helpers.js",
  "app-places-advanced.js",
];

let jsCount = 0;

// Verarbeite Core JS
log.info("→ Core JavaScript...");
coreJs.forEach((file) => {
  if (processJs(file)) jsCount++;
});

// Verarbeite Places JS
log.info("→ Places API JavaScript...");
placesJs.forEach((file) => {
  if (processJs(file)) jsCount++;
});

// === 7. Validierung ===
log.info("Validiere Build...");

const validate = () => {
  const errors = [];
  const warnings = [];

  // Kritische Dateien prüfen
  if (!fs.existsSync("dist/index.html")) {
    errors.push("index.html fehlt in dist/");
  }
  if (!fs.existsSync("dist/app.js")) {
    errors.push("app.js fehlt in dist/");
  }
  if (!fs.existsSync("dist/styles.css")) {
    warnings.push("styles.css fehlt in dist/");
  }

  // Umgebungsvariablen prüfen
  if (
    !env.supabaseUrl ||
    env.supabaseUrl.includes("PLACEHOLDER") ||
    !env.supabaseKey ||
    env.supabaseKey.includes("PLACEHOLDER")
  ) {
    errors.push(
      "Supabase Umgebungsvariablen nicht gesetzt oder enthalten Platzhalter"
    );
  }

  if (!env.mapsKey || env.mapsKey.includes("YOUR_")) {
    warnings.push(
      "Google Maps API Key nicht gesetzt - Places API funktioniert nicht"
    );
  }

  // PWA Dateien prüfen
  if (!fs.existsSync("dist/manifest.json")) {
    warnings.push("manifest.json fehlt - PWA Installation nicht möglich");
  }
  if (!fs.existsSync("dist/service-worker.js")) {
    warnings.push("service-worker.js fehlt - Offline-Modus nicht verfügbar");
  }

  // Places API Dateien prüfen
  if (!fs.existsSync("dist/app-places-extended.js")) {
    warnings.push(
      "app-places-extended.js fehlt - Places API Funktionen nicht verfügbar"
    );
  }

  return { errors, warnings };
};

const { errors, warnings } = validate();

// === 8. Zusammenfassung ===
console.log("\n" + "=".repeat(50));
console.log("📦 BUILD ZUSAMMENFASSUNG");
console.log("=".repeat(50));

console.log("\n📄 Dateien:");
console.log(`   HTML:              ${htmlCount}/${htmlFiles.length}`);
console.log(`   CSS:               ${cssCount}/${cssFiles.length}`);
console.log(
  `   JavaScript (Core): ${
    coreJs.filter((f) => fs.existsSync(`dist/${f}`)).length
  }/${coreJs.length}`
);
console.log(
  `   JavaScript (Places): ${
    placesJs.filter((f) => fs.existsSync(`dist/${f}`)).length
  }/${placesJs.length}`
);

console.log("\n🔧 PWA:");
console.log(
  `   Service Worker:    ${fs.existsSync("dist/service-worker.js") ? "✓" : "✗"}`
);
console.log(
  `   Manifest:          ${fs.existsSync("dist/manifest.json") ? "✓" : "✗"}`
);
console.log(
  `   Offline Page:      ${fs.existsSync("dist/offline.html") ? "✓" : "✗"}`
);
console.log(`   Icons:             ${fs.existsSync("dist/icons") ? "✓" : "✗"}`);

console.log("\n🔑 Umgebungsvariablen:");
console.log(`   SUPABASE_URL:      ${env.supabaseUrl ? "✓" : "✗"}`);
console.log(`   SUPABASE_ANON_KEY: ${env.supabaseKey ? "✓" : "✗"}`);
console.log(`   GOOGLE_MAPS_KEY:   ${env.mapsKey ? "✓" : "✗"}`);

// Zeige Fehler und Warnungen
if (errors.length > 0) {
  console.log("\n❌ FEHLER:");
  errors.forEach((err) => log.err(err));
}

if (warnings.length > 0) {
  console.log("\n⚠️  WARNUNGEN:");
  warnings.forEach((warn) => log.warn(warn));
}

console.log("\n" + "=".repeat(50));

if (errors.length > 0) {
  log.err("Build mit Fehlern abgeschlossen! Bitte beheben vor Deployment.");
  process.exit(1);
} else if (warnings.length > 0) {
  log.warn(
    "Build erfolgreich, aber mit Warnungen. Funktionalität eingeschränkt."
  );
  console.log("🚀 Bereit für Deployment (mit Einschränkungen)");
} else {
  log.ok("Build erfolgreich abgeschlossen!");
  console.log("🌍 Bereit für Production Deployment auf Netlify!");
}

console.log("=".repeat(50) + "\n");

// === 9. Build-Infos schreiben (für Debugging) ===
const buildInfo = {
  timestamp: new Date().toISOString(),
  node_version: process.version,
  files: {
    html: htmlCount,
    css: cssCount,
    js_core: coreJs.filter((f) => fs.existsSync(`dist/${f}`)).length,
    js_places: placesJs.filter((f) => fs.existsSync(`dist/${f}`)).length,
  },
  env: {
    supabase_configured: !!env.supabaseUrl && !!env.supabaseKey,
    maps_configured: !!env.mapsKey,
  },
  errors: errors.length,
  warnings: warnings.length,
};

fs.writeFileSync("dist/build-info.json", JSON.stringify(buildInfo, null, 2));
log.ok("Build-Info gespeichert in dist/build-info.json");
