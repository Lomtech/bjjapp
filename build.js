const fs = require("fs");
const path = require("path");

console.log("🔨 Starting build process...\n");

// ================================================
// KONFIGURATION
// ================================================

const SOURCE_DIR = ".";
const DIST_DIR = "dist";
const JS_MODULES_DIR = "js";
const CSS_DIR = "css";

// Dateien zum Kopieren
const FILES_TO_COPY = ["index.html", "styles.css", "mobile-menu.js"];

// JavaScript Module (Reihenfolge wichtig!)
const JS_MODULES = [
  "config.js",
  "utils.js",
  "auth.js",
  "navigation.js",
  "profile.js",
  "athletes.js",
  "gyms.js",
  "openmats.js",
  "friends.js",
  "messages.js",
  "map.js",
  "dashboard.js",
];

// CSS Module (optional, falls du mehrere hast)
const CSS_MODULES = ["messaging.css"];

// ================================================
// HELPER FUNKTIONEN
// ================================================

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
}

function copyFile(src, dest) {
  try {
    fs.copyFileSync(src, dest);
    console.log(`✅ Copied: ${src} → ${dest}`);
    return true;
  } catch (error) {
    console.error(`❌ Error copying ${src}:`, error.message);
    return false;
  }
}

function replaceEnvVars(content) {
  return content
    .replace(/SUPABASE_URL_PLACEHOLDER/g, process.env.SUPABASE_URL || "")
    .replace(/SUPABASE_KEY_PLACEHOLDER/g, process.env.SUPABASE_ANON_KEY || "");
}

// ================================================
// BUILD PROZESS
// ================================================

console.log("📦 Creating dist directory structure...\n");

// Erstelle Ordnerstruktur
ensureDir(DIST_DIR);
ensureDir(path.join(DIST_DIR, JS_MODULES_DIR));
ensureDir(path.join(DIST_DIR, CSS_DIR));

// ================================================
// 1. KOPIERE HAUPT-DATEIEN
// ================================================

console.log("\n📄 Copying main files...\n");

let copyErrors = 0;

FILES_TO_COPY.forEach((file) => {
  const srcPath = path.join(SOURCE_DIR, file);
  const destPath = path.join(DIST_DIR, file);

  if (fs.existsSync(srcPath)) {
    if (!copyFile(srcPath, destPath)) {
      copyErrors++;
    }
  } else {
    console.warn(`⚠️  File not found: ${file}`);
  }
});

// ================================================
// 2. VERARBEITE JAVASCRIPT MODULE
// ================================================

console.log("\n📦 Processing JavaScript modules...\n");

let jsErrors = 0;

JS_MODULES.forEach((module) => {
  const srcPath = path.join(SOURCE_DIR, JS_MODULES_DIR, module);
  const destPath = path.join(DIST_DIR, JS_MODULES_DIR, module);

  if (fs.existsSync(srcPath)) {
    try {
      // Lese Modul
      let content = fs.readFileSync(srcPath, "utf8");

      // Ersetze Umgebungsvariablen (nur in config.js)
      if (module === "config.js") {
        content = replaceEnvVars(content);
        console.log(`🔧 Replaced env vars in ${module}`);
      }

      // Schreibe Modul
      fs.writeFileSync(destPath, content);
      console.log(`✅ Processed: ${module}`);
    } catch (error) {
      console.error(`❌ Error processing ${module}:`, error.message);
      jsErrors++;
    }
  } else {
    console.warn(`⚠️  Module not found: ${module}`);
    jsErrors++;
  }
});

// ================================================
// 3. KOPIERE CSS MODULE
// ================================================

console.log("\n🎨 Copying CSS modules...\n");

let cssErrors = 0;

CSS_MODULES.forEach((cssFile) => {
  const srcPath = path.join(SOURCE_DIR, CSS_DIR, cssFile);
  const destPath = path.join(DIST_DIR, CSS_DIR, cssFile);

  if (fs.existsSync(srcPath)) {
    if (!copyFile(srcPath, destPath)) {
      cssErrors++;
    }
  } else {
    console.log(`ℹ️  Optional CSS not found: ${cssFile} (skipping)`);
  }
});

// ================================================
// 4. OPTIONAL: BUNDLE ERSTELLEN (für Produktion)
// ================================================

// Optional: Erstelle ein gebündeltes app.js für bessere Performance
const createBundle = process.env.CREATE_BUNDLE === "true";

if (createBundle) {
  console.log("\n📦 Creating bundled app.js...\n");

  try {
    let bundleContent = "";

    // Header
    bundleContent += "// ================================================\n";
    bundleContent += "// BJJ Community Platform - Bundled Version\n";
    bundleContent += `// Build Date: ${new Date().toISOString()}\n`;
    bundleContent += "// ================================================\n\n";

    // Kombiniere alle Module
    JS_MODULES.forEach((module) => {
      const srcPath = path.join(SOURCE_DIR, JS_MODULES_DIR, module);
      if (fs.existsSync(srcPath)) {
        bundleContent += `// === ${module} ===\n`;
        let content = fs.readFileSync(srcPath, "utf8");

        // Ersetze Umgebungsvariablen in config.js
        if (module === "config.js") {
          content = replaceEnvVars(content);
        }

        bundleContent += content + "\n\n";
      }
    });

    // Schreibe Bundle
    fs.writeFileSync(path.join(DIST_DIR, "app.bundle.js"), bundleContent);
    console.log("✅ Created app.bundle.js");

    // Erstelle minimierte HTML-Version die Bundle nutzt
    const htmlContent = fs.readFileSync(
      path.join(DIST_DIR, "index.html"),
      "utf8"
    );
    const bundledHtml = htmlContent.replace(
      /<!-- Core Scripts.*?<script src="js\/dashboard\.js"><\/script>/s,
      '<script src="app.bundle.js"></script>'
    );
    fs.writeFileSync(path.join(DIST_DIR, "index.bundle.html"), bundledHtml);
    console.log("✅ Created index.bundle.html");
  } catch (error) {
    console.error("❌ Error creating bundle:", error.message);
  }
}

// ================================================
// 5. ZUSAMMENFASSUNG
// ================================================

console.log("\n" + "=".repeat(60));
console.log("📊 BUILD SUMMARY");
console.log("=".repeat(60));

const totalErrors = copyErrors + jsErrors + cssErrors;

console.log("\n📁 Structure:");
console.log(`   dist/`);
console.log(`   ├── index.html`);
console.log(`   ├── styles.css`);
console.log(`   ├── mobile-menu.js`);
console.log(`   ├── js/`);
JS_MODULES.forEach((m) => console.log(`   │   ├── ${m}`));
console.log(`   └── css/`);
CSS_MODULES.forEach((c) => console.log(`       └── ${c}`));

console.log("\n🔧 Environment Variables:");
console.log(
  `   SUPABASE_URL: ${process.env.SUPABASE_URL ? "✅ gesetzt" : "❌ fehlt"}`
);
console.log(
  `   SUPABASE_ANON_KEY: ${
    process.env.SUPABASE_ANON_KEY ? "✅ gesetzt" : "❌ fehlt"
  }`
);

if (createBundle) {
  console.log("\n📦 Bundle:");
  console.log("   ✅ app.bundle.js created");
  console.log("   ✅ index.bundle.html created");
}

console.log("\n📈 Results:");
console.log(`   Files copied: ${FILES_TO_COPY.length}`);
console.log(
  `   JS modules: ${JS_MODULES.length - jsErrors}/${JS_MODULES.length}`
);
console.log(
  `   CSS modules: ${CSS_MODULES.length - cssErrors}/${CSS_MODULES.length}`
);
console.log(`   Total errors: ${totalErrors}`);

if (totalErrors === 0) {
  console.log("\n✅ BUILD COMPLETED SUCCESSFULLY! 🎉");
  console.log("\n💡 Next steps:");
  console.log("   1. cd dist");
  console.log("   2. Start your web server");
  console.log("   3. Test the application");
  process.exit(0);
} else {
  console.log("\n⚠️  BUILD COMPLETED WITH WARNINGS");
  console.log(`   ${totalErrors} error(s) occurred`);
  process.exit(1);
}

console.log("=".repeat(60) + "\n");
