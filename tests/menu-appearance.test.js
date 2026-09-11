'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('メニュー項目は濃い文字色と太字で表示する', () => {
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert.match(css, /\.menu-item\s*\{[\s\S]*?color:\s*#111;/);
  assert.match(css, /\.menu-item\s*\{[\s\S]*?font-weight:\s*700;/);
});

test('マイページ右上に閉じるボタンを表示する', () => {
  const menu = fs.readFileSync(path.join(root, 'js', 'menu.js'), 'utf8');
  assert.match(menu, /class="profile-modal-close"/);
  assert.match(menu, /aria-label="マイページを閉じる"/);
  assert.match(menu, /onclick="closeProfileModal\(\)"/);
});
