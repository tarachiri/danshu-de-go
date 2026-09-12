'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('マップボタンは開閉状態を伝えるトグルになっている', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /id="tab-map"[^>]*onclick="typeof toggleMapPanel === 'function' \? toggleMapPanel\(\) : switchTab\('map'\)"/);
  assert.match(html, /id="tab-map"[^>]*aria-expanded="true"[^>]*aria-controls="map"/);
  assert.match(html, /id="tab-map-label">マップを閉じる</);
});

test('マップを畳むと下の地域案内が続けて読める', () => {
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert.match(css, /#app-shell\.map-collapsed\s*\{[^}]*height:\s*auto;[^}]*overflow:\s*visible;/s);
  assert.match(css, /#app-shell\.map-collapsed #map\s*\{[^}]*display:\s*none\s*!important;/s);
  assert.match(css, /#app-shell\.map-collapsed #map-attribution\s*\{[^}]*display:\s*none\s*!important;/s);
  assert.match(css, /#app-shell\.map-collapsed #bottom-nav\s*\{[^}]*bottom:\s*0;/s);
});

test('通常のタブ切替や会場ジャンプではマップを展開する', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.match(app, /function toggleMapPanel\(\)/);
  assert.match(app, /function switchTab\(tab\)[\s\S]*?setMapPanelExpanded\(true\);/);
  assert.match(app, /mapLabel\.textContent = expanded \? 'マップを閉じる' : 'マップを開く'/);
});

test('Leaflet本体を変形せず、地域案内だけを軽く動かす', () => {
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.doesNotMatch(css, /#app-shell\.map-transitioning #map/);
  assert.match(css, /#seo-summary\.map-summary-reveal\s*\{[^}]*animation:/s);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(app, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(app, /window\.addEventListener\('pageshow'/);
  assert.match(app, /setTimeout\(\(\) => window\._leafletMap\.invalidateSize\(\), 120\)/);
});
