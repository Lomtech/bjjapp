const fs = require('fs');

// Erstelle dist Ordner
if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
}

// Kopiere index.html
fs.copyFileSync('index.html', 'dist/index.html');

// Kopiere CSS
fs.copyFileSync('styles.css', 'dist/styles.css');

// Lese app.js und ersetze Platzhalter
const js = fs.readFileSync('app.js', 'utf8');
const resultJs = js
    .replace('SUPABASE_URL_PLACEHOLDER', process.env.SUPABASE_URL || '')
    .replace('SUPABASE_KEY_PLACEHOLDER', process.env.SUPABASE_ANON_KEY || '');

// Schreibe app.js in dist
fs.writeFileSync('dist/app.js', resultJs);

console.log('✅ Build completed');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✓ gesetzt' : '✗ fehlt');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✓ gesetzt' : '✗ fehlt');