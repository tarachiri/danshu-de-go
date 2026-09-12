'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('軽量アニメーションはシート・メニュー・マイページ・通知に限定する', () => {
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert.match(css, /@keyframes sheet-content-reveal/);
  assert.match(css, /@keyframes menu-item-reveal/);
  assert.match(css, /@keyframes profile-panel-in/);
  assert.match(css, /@keyframes toast-in/);
  assert.doesNotMatch(css, /#map[^,{]*\{[^}]*animation:/s);
});

test('お気に入り操作には短い押下フィードバックがある', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.match(app, /function animateFavoriteButton\(btn\)/);
  assert.match(app, /setFavoriteButton\(btn, next\);\s*animateFavoriteButton\(btn\);/);
});

test('端末の動きを減らす設定を尊重する', () => {
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  const menu = fs.readFileSync(path.join(root, 'js', 'menu.js'), 'utf8');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.fav-btn\.favorite-pop[\s\S]*?animation: none !important;/);
  assert.match(menu, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
});
