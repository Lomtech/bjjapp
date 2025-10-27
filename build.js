const fs = require('fs');
const path = require('path');

// Erstelle dist Ordner
if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
}

// Lese und ersetze Umgebungsvariablen in index.html
const html = fs.readFileSync('index.html', 'utf8');
const result = html
    .replace(/\{\{SUPABASE_URL\}\}/g, process.env.SUPABASE_URL || '')
    .replace(/\{\{SUPABASE_ANON_KEY\}\}/g, process.env.SUPABASE_ANON_KEY || '');

// Schreibe index.html in dist
fs.writeFileSync('dist/index.html', result);

// Kopiere CSS
fs.copyFileSync('styles.css', 'dist/styles.css');

// Lese und ersetze Umgebungsvariablen in app.js
const js = fs.readFileSync('app.js', 'utf8');
const resultJs = js
    .replace(/\{\{SUPABASE_URL\}\}/g, process.env.SUPABASE_URL || '')
    .replace(/\{\{SUPABASE_ANON_KEY\}\}/g, process.env.SUPABASE_ANON_KEY || '');

// Schreibe app.js in dist
fs.writeFileSync('dist/app.js', resultJs);

console.log('✅ Build completed - all files copied to dist/');