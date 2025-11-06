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
fs.copyFileSync("index.html", "dist/index.html");
fs.copyFileSync("datenschutz.html", "dist/datenschutz.html");
fs.copyFileSync("impressum.html", "dist/impressum.html");
fs.copyFileSync("agb.html", "dist/agb.html");

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
  const iconFiles = [
    "icon-16x16.png",
    "icon-32x32.png",
    "icon-192x192.png",
    "icon-512x512.png",
    "apple-touch-icon.png",
    "favicon.ico",
  ];

  let copiedIcons = 0;
  iconFiles.forEach((file) => {
    const sourcePath = path.join("icons", file);
    const destPath = path.join("dist", "icons", file);

    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, destPath);
      copiedIcons++;
    }
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
console.log("   HTML: ✓");
console.log("   CSS: ✓");
console.log("   JavaScript: ✓");
console.log(
  "   Service Worker:",
  fs.existsSync("service-worker.js") ? "✓" : "✗"
);
console.log("   Manifest:", fs.existsSync("manifest.json") ? "✓" : "✗");
console.log("   Icons:", fs.existsSync("icons") ? "✓" : "✗");
console.log("\n🔐 Umgebungsvariablen:");
console.log("   SUPABASE_URL:", process.env.SUPABASE_URL ? "✓" : "✗");
console.log("   SUPABASE_ANON_KEY:", process.env.SUPABASE_ANON_KEY ? "✓" : "✗");
console.log("\n📦 PWA bereit für Deployment!\n");
