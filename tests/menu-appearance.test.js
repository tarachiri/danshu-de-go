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

test('明るいボトムシートの補足文字は濃い黒で表示する', () => {
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert.match(css, /\.sheet-address\s*\{[^}]*color:\s*#111;/);
  assert.match(css, /\.sheet-meeting-recurrence\s*\{[^}]*color:\s*#111;/);
  assert.match(css, /\.sheet-upcoming-time\s*\{[^}]*color:\s*#111;/);
});

test('濃い背景のマイページに灰色の文字を残さない', () => {
  const menu = fs.readFileSync(path.join(root, 'js', 'menu.js'), 'utf8');
  const profileStart = menu.indexOf('function renderMyCalendar');
  const profileEnd = menu.indexOf('function openProfileModalFresh');
  const profileMarkup = menu.slice(profileStart, profileEnd);
  assert.ok(profileStart >= 0 && profileEnd > profileStart);
  assert.doesNotMatch(profileMarkup, /color:#(?:888|aaa|bbb|ccc)/i);
});

test('マイページ入力欄の例文も白で表示する', () => {
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  assert.match(css, /#profile-modal-overlay input::placeholder\s*\{[^}]*color:\s*#fff;[^}]*opacity:\s*1;/s);
});
