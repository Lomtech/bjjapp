const fs = require("fs");
const path = require("path");

console.log("🔨 Starting build process...\n");

// ================================================
// KONFIGURATION
// ================================================

const SOURCE_DIR = ".";
const DIST_DIR = "dist";
const JS_DIR = "js";
const CSS_DIR = "css";
const HTML_DIR = "html";

// HTML Templates zum Kopieren
const HTML_FILES = [
  "athletes.html",
  "auth.html",
  "dashboard.html",
  "friends.html",
  "gyms.html",
  "header.html",
  "map.html",
  "messages.html",
  "openmat-chat.html",
  "openmats.html",
  "profile.html",
  "welcome.html",
];

// JavaScript Module (Reihenfolge wichtig!)
const JS_MODULES = [
  "config.js",
  "utils.js",
  "render.js",
  "auth.js",
  "navigation.js",
  "mobilemenu.js",
  "profile.js",
  "athletes.js",
  "gyms.js",
  "openmats.js",
  "friends.js",
  "messages.js",
  "map.js",
  "dashboard.js",
];

// CSS Module
const CSS_MODULES = [
  "base.css",
  "header.css",
  "components.css",
  "forms.css",
  "messaging.css",
  "modals.css",
  "responsive.css",
  "main.css",
];

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
ensureDir(path.join(DIST_DIR, JS_DIR));
ensureDir(path.join(DIST_DIR, CSS_DIR));
ensureDir(path.join(DIST_DIR, HTML_DIR));

// ================================================
// 1. KOPIERE INDEX.HTML (Haupt-Datei im Root)
// ================================================

console.log("\n📄 Copying main index.html...\n");

const indexSrc = path.join(SOURCE_DIR, HTML_DIR, "index.html");
const indexDest = path.join(DIST_DIR, "index.html");

let copyErrors = 0;

if (fs.existsSync(indexSrc)) {
  if (!copyFile(indexSrc, indexDest)) {
    copyErrors++;
  }
} else {
  console.error("❌ CRITICAL: index.html not found!");
  copyErrors++;
}

// ================================================
// 2. KOPIERE HTML TEMPLATES
// ================================================

console.log("\n📄 Copying HTML templates...\n");

let htmlErrors = 0;

HTML_FILES.forEach((file) => {
  const srcPath = path.join(SOURCE_DIR, HTML_DIR, file);
  const destPath = path.join(DIST_DIR, HTML_DIR, file);

  if (fs.existsSync(srcPath)) {
    if (!copyFile(srcPath, destPath)) {
      htmlErrors++;
    }
  } else {
    console.warn(`⚠️  HTML file not found: ${file}`);
    htmlErrors++;
  }
});

// ================================================
// 3. VERARBEITE JAVASCRIPT MODULE
// ================================================

console.log("\n📦 Processing JavaScript modules...\n");

let jsErrors = 0;

JS_MODULES.forEach((module) => {
  const srcPath = path.join(SOURCE_DIR, JS_DIR, module);
  const destPath = path.join(DIST_DIR, JS_DIR, module);

  if (fs.existsSync(srcPath)) {
    try {
      let content = fs.readFileSync(srcPath, "utf8");

      // Ersetze Umgebungsvariablen (nur in config.js)
      if (module === "config.js") {
        content = replaceEnvVars(content);
        console.log(`🔧 Replaced env vars in ${module}`);
      }

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
// 4. KOPIERE CSS MODULE
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
    console.warn(`⚠️  CSS file not found: ${cssFile}`);
    cssErrors++;
  }
});

// ================================================
// 5. OPTIONAL: BUNDLE ERSTELLEN
// ================================================

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
      const srcPath = path.join(SOURCE_DIR, JS_DIR, module);
      if (fs.existsSync(srcPath)) {
        bundleContent += `// === ${module} ===\n`;
        let content = fs.readFileSync(srcPath, "utf8");

        if (module === "config.js") {
          content = replaceEnvVars(content);
        }

        bundleContent += content + "\n\n";
      }
    });

    fs.writeFileSync(path.join(DIST_DIR, "app.bundle.js"), bundleContent);
    console.log("✅ Created app.bundle.js");

    // CSS Bundle
    let cssBundleContent = "";
    CSS_MODULES.forEach((cssFile) => {
      const srcPath = path.join(SOURCE_DIR, CSS_DIR, cssFile);
      if (fs.existsSync(srcPath) && cssFile !== "main.css") {
        cssBundleContent += `/* === ${cssFile} === */\n`;
        cssBundleContent += fs.readFileSync(srcPath, "utf8") + "\n\n";
      }
    });

    fs.writeFileSync(
      path.join(DIST_DIR, "styles.bundle.css"),
      cssBundleContent
    );
    console.log("✅ Created styles.bundle.css");
  } catch (error) {
    console.error("❌ Error creating bundle:", error.message);
  }
}

// ================================================
// 6. ZUSAMMENFASSUNG
// ================================================

console.log("\n" + "=".repeat(60));
console.log("📊 BUILD SUMMARY");
console.log("=".repeat(60));

const totalErrors = copyErrors + htmlErrors + jsErrors + cssErrors;

console.log("\n📁 Structure:");
console.log(`   dist/`);
console.log(`   ├── index.html`);
console.log(`   ├── html/`);
HTML_FILES.slice(0, 3).forEach((h) => console.log(`   │   ├── ${h}`));
console.log(`   │   └── ... (${HTML_FILES.length} total)`);
console.log(`   ├── js/`);
JS_MODULES.slice(0, 3).forEach((m) => console.log(`   │   ├── ${m}`));
console.log(`   │   └── ... (${JS_MODULES.length} total)`);
console.log(`   └── css/`);
CSS_MODULES.slice(0, 3).forEach((c) => console.log(`       ├── ${c}`));
console.log(`       └── ... (${CSS_MODULES.length} total)`);

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
  console.log("   ✅ styles.bundle.css created");
}

console.log("\n📈 Results:");
console.log(
  `   HTML files: ${HTML_FILES.length + 1 - htmlErrors}/${
    HTML_FILES.length + 1
  }`
);
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
  console.log("   1. Deploy dist/ folder");
  console.log("   2. Test the application");
  process.exit(0);
} else {
  console.log("\n⚠️  BUILD COMPLETED WITH WARNINGS");
  console.log(`   ${totalErrors} error(s) occurred`);
  process.exit(1);
}

console.log("=".repeat(60) + "\n");
