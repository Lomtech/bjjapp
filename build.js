const fs = require("fs");
const path = require("path");

// Erstelle dist Ordner
if (!fs.existsSync("dist")) {
  fs.mkdirSync("dist");
}

// Erstelle icons Ordner in dist
if (!fs.existsSync("dist/icons")) {
  fs.mkdirSync("dist/icons");
}

// Kopiere HTML-Dateien
console.log("📄 Kopiere HTML-Dateien...");
const htmlFiles = [
  "index.html",
  "offline.html",
  "datenschutz.html",
  "impressum.html",
  "agb.html",
];

htmlFiles.forEach((file) => {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join("dist", file));
  } else {
    console.warn(`   ⚠️  ${file} nicht gefunden`);
  }
});

// Kopiere CSS
console.log("🎨 Kopiere CSS...");
fs.copyFileSync("styles.css", "dist/styles.css");

// Kopiere PWA-Dateien
console.log("📱 Kopiere PWA-Dateien...");
if (fs.existsSync("manifest.json")) {
  fs.copyFileSync("manifest.json", "dist/manifest.json");
}
if (fs.existsSync("service-worker.js")) {
  fs.copyFileSync("service-worker.js", "dist/service-worker.js");
}

// Kopiere Icons
console.log("🎯 Kopiere Icons...");
if (fs.existsSync("icons")) {
  const iconFiles = fs.readdirSync("icons");
  let copiedIcons = 0;

  iconFiles.forEach((file) => {
    const sourcePath = path.join("icons", file);
    const destPath = path.join("dist", "icons", file);
    fs.copyFileSync(sourcePath, destPath);
    copiedIcons++;
  });

  console.log(`   ✓ ${copiedIcons} Icon-Datei(en) kopiert`);
}

// Verarbeite app.js
console.log("⚙️  Verarbeite JavaScript...");
const js = fs.readFileSync("app.js", "utf8");
const resultJs = js
  .replace("SUPABASE_URL_PLACEHOLDER", process.env.SUPABASE_URL || "")
  .replace("SUPABASE_KEY_PLACEHOLDER", process.env.SUPABASE_ANON_KEY || "");

fs.writeFileSync("dist/app.js", resultJs);

// Zusammenfassung
console.log("\n✅ PWA Build completed!");
console.log("\n📊 Build-Inhalt:");
console.log("   HTML-Seiten:", htmlFiles.length);
console.log("   CSS: ✓");
console.log("   JavaScript: ✓");
console.log(
  "   Service Worker:",
  fs.existsSync("service-worker.js") ? "✓" : "✗"
);
console.log("   Offline-Seite:", fs.existsSync("offline.html") ? "✓" : "✗");
console.log("   Manifest:", fs.existsSync("manifest.json") ? "✓" : "✗");
console.log("   Icons:", fs.existsSync("icons") ? "✓" : "✗");
console.log("\n🔐 Umgebungsvariablen:");
console.log("   SUPABASE_URL:", process.env.SUPABASE_URL ? "✓" : "✗");
console.log("   SUPABASE_ANON_KEY:", process.env.SUPABASE_ANON_KEY ? "✓" : "✗");
console.log("\n📦 PWA bereit für Deployment!\n");
