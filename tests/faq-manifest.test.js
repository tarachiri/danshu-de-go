// FAQとPWA manifestが、現在の掲載範囲・任意会員登録・データ利用を正しく案内するための回帰テスト。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const FAQ = fs.readFileSync(path.join(ROOT, 'docs', 'faq.html'), 'utf8');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));

test('FAQは会員登録が任意であることと登録項目を説明する', () => {
  assert.match(FAQ, /基本機能は会員登録をしなくても利用できます/);
  assert.match(FAQ, /表示名と任意の都道府県・市区町村/);
  assert.match(FAQ, /メールアドレス・本名・パスワードは登録項目にありません/);
  assert.doesNotMatch(FAQ, /アカウント登録も不要です/);
});

test('FAQはブラウザ識別子と位置情報の現在の扱いを説明する', () => {
  assert.match(FAQ, /ブラウザ内にランダムな識別子を保存/);
  assert.match(FAQ, /訪問・会場閲覧・お気に入り/);
  assert.match(FAQ, /位置情報は対応機能を使う際にブラウザの許可を得て利用/);
});

test('FAQは47都道府県対応と特別イベント導線を説明する', () => {
  assert.match(FAQ, /47都道府県の会場を掲載/);
  assert.match(FAQ, /全国にあるすべての例会を完全に網羅しているわけではありません/);
  assert.match(FAQ, /特別イベントのピンは何？/);
  assert.match(FAQ, /href="\/meetings\/"/);
});

test('manifestは現在の掲載範囲と機能を説明する', () => {
  assert.match(MANIFEST.description, /全国47都道府県/);
  assert.match(MANIFEST.description, /中止・変更/);
  assert.match(MANIFEST.description, /特別イベント/);
  assert.match(MANIFEST.description, /基本機能は登録不要・無料/);
  assert.doesNotMatch(MANIFEST.description, /東京・神奈川・埼玉・千葉・栃木/);
});
