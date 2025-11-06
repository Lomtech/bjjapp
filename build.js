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
  "chat.html",
  "offline.html",
  "datenschutz.html",
  "impressum.html",
  "agb.html",
];

htmlFiles.forEach((file) => {
  if (fs.existsSync(file)) {
    // Lese HTML und ersetze Google Maps API Key
    let content = fs.readFileSync(file, "utf8");
    
    // Ersetze Google Maps API Key Placeholder
    content = content.replace(
      /YOUR_GOOGLE_MAPS_API_KEY/g,
      process.env.GOOGLE_MAPS_API_KEY || "YOUR_GOOGLE_MAPS_API_KEY"
    );
    
    fs.writeFileSync(path.join("dist", file), content);
    console.log(`   ✓ ${file} kopiert`);
  } else {
    console.warn(`   ⚠️  ${file} nicht gefunden`);
  }
});

// Kopiere CSS
console.log("🎨 Kopiere CSS...");
const cssFiles = ["styles.css", "chat.css"];
cssFiles.forEach((file) => {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join("dist", file));
    console.log(`   ✓ ${file} kopiert`);
  } else {
    console.warn(`   ⚠️  ${file} nicht gefunden`);
  }
});

// Kopiere PWA-Dateien
console.log("📱 Kopiere PWA-Dateien...");
if (fs.existsSync("manifest.json")) {
  fs.copyFileSync("manifest.json", "dist/manifest.json");
  console.log("   ✓ manifest.json kopiert");
}
if (fs.existsSync("service-worker.js")) {
  fs.copyFileSync("service-worker.js", "dist/service-worker.js");
  console.log("   ✓ service-worker.js kopiert");
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
} else {
  console.warn("   ⚠️  icons Ordner nicht gefunden");
}

// Verarbeite JavaScript-Dateien
console.log("⚙️  Verarbeite JavaScript...");

// app.js
if (fs.existsSync("app.js")) {
  const appJs = fs.readFileSync("app.js", "utf8");
  const resultAppJs = appJs
    .replace(/SUPABASE_URL_PLACEHOLDER/g, process.env.SUPABASE_URL || "SUPABASE_URL_PLACEHOLDER")
    .replace(/SUPABASE_KEY_PLACEHOLDER/g, process.env.SUPABASE_ANON_KEY || "SUPABASE_KEY_PLACEHOLDER")
    .replace(/YOUR_GOOGLE_MAPS_API_KEY/g, process.env.GOOGLE_MAPS_API_KEY || "YOUR_GOOGLE_MAPS_API_KEY");

  fs.writeFileSync("dist/app.js", resultAppJs);
  console.log("   ✓ app.js verarbeitet");
} else {
  console.error("   ❌ app.js nicht gefunden!");
}

// chat.js
if (fs.existsSync("chat.js")) {
  const chatJs = fs.readFileSync("chat.js", "utf8");
  const resultChatJs = chatJs
    .replace(/SUPABASE_URL_PLACEHOLDER/g, process.env.SUPABASE_URL || "SUPABASE_URL_PLACEHOLDER")
    .replace(/SUPABASE_KEY_PLACEHOLDER/g, process.env.SUPABASE_ANON_KEY || "SUPABASE_KEY_PLACEHOLDER");

  fs.writeFileSync("dist/chat.js", resultChatJs);
  console.log("   ✓ chat.js verarbeitet");
} else {
  console.warn("   ⚠️  chat.js nicht gefunden");
}

// Zusammenfassung
console.log("\n✅ PWA Build completed!");
console.log("\n📊 Build-Inhalt:");
console.log("   HTML-Seiten:", htmlFiles.filter(f => fs.existsSync(f)).length);
console.log("   CSS-Dateien:", cssFiles.filter(f => fs.existsSync(f)).length);
console.log("   JavaScript-Dateien: ✓");
console.log(
  "   Service Worker:",
  fs.existsSync("service-worker.js") ? "✓" : "✗"
);
console.log("   Offline-Seite:", fs.existsSync("offline.html") ? "✓" : "✗");
console.log("   Manifest:", fs.existsSync("manifest.json") ? "✓" : "✗");
console.log("   Icons:", fs.existsSync("icons") ? "✓" : "✗");

console.log("\n🔐 Umgebungsvariablen:");
console.log("   SUPABASE_URL:", process.env.SUPABASE_URL ? "✓" : "✗ (wird nicht ersetzt)");
console.log("   SUPABASE_ANON_KEY:", process.env.SUPABASE_ANON_KEY ? "✓" : "✗ (wird nicht ersetzt)");
console.log("   GOOGLE_MAPS_API_KEY:", process.env.GOOGLE_MAPS_API_KEY ? "✓" : "✗ (wird nicht ersetzt)");

console.log("\n💡 Tipp: Setze Umgebungsvariablen mit:");
console.log("   export SUPABASE_URL='https://your-project.supabase.co'");
console.log("   export SUPABASE_ANON_KEY='your-anon-key'");
console.log("   export GOOGLE_MAPS_API_KEY='your-google-maps-key'");

console.log("\n📦 PWA bereit für Deployment!\n");