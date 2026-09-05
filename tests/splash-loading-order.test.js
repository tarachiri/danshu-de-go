'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

const splashIndex = html.indexOf('id="splash-overlay"');
const leafletScriptIndex = html.indexOf('leaflet@1.9.4/dist/leaflet.js');
assert.ok(splashIndex >= 0, 'splash overlay must exist');
assert.ok(
  leafletScriptIndex > splashIndex,
  'Leaflet JavaScript must load after the splash DOM'
);

assert.doesNotMatch(html, /@import\s+url\([^)]*fonts\.googleapis\.com/);
assert.match(html, /<script async src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/qrcodejs/);
assert.match(html, /window\.renderSplashQr/);
assert.match(html, /--sp-detail-font-size:\s*14px/);
assert.match(
  html,
  /\.sp-message-block p\s*\{[\s\S]*?font-size:\s*var\(--sp-detail-font-size\)[\s\S]*?color:\s*#fff/
);
assert.match(
  html,
  /\.sp-update-list li\s*\{[\s\S]*?font-size:\s*var\(--sp-detail-font-size\)/
);

assert.match(app, /fetch\('venues\.json'\)/);
assert.doesNotMatch(app, /fetch\('venues\.json\?v='\s*\+\s*Date\.now\(\)\)/);
assert.match(app, /setSplashProgress\(55,/);
assert.match(app, /setSplashProgress\(80,/);
assert.match(app, /setSplashProgress\(95,/);
assert.match(app, /await yieldForSplashPaint\(\);[\s\S]*applyFilters\(\);/);

console.log('splash loading order tests: ok');
