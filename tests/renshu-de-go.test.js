'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const training = require('../renshu/app.js');

const ROOT = path.resolve(__dirname, '..');
const HOME = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const INTRO = fs.readFileSync(path.join(ROOT, 'renshu', 'index.html'), 'utf8');
const APP = fs.readFileSync(path.join(ROOT, 'renshu', 'app.html'), 'utf8');
const APP_JS = fs.readFileSync(path.join(ROOT, 'renshu', 'app.js'), 'utf8');

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); }
  };
}

test('トップページから練習でGO!!へ移動できる', () => {
  const links = HOME.match(/href=["']\/renshu\/(?:\?from=map)?["']/g) || [];
  assert.ok(links.length >= 2, '起動画面とメニューの両方に入口が必要です');
  assert.match(HOME, /例会登録から練習マップへの反映まで体験する/);
});

test('説明ページは目的・安全範囲・参加ボタンを明示する', () => {
  assert.match(INTRO, /例会登録や編集の練習をするコーナーです/);
  assert.match(INTRO, /一緒に断酒でGO!!を作れるようになりませんか/);
  assert.match(INTRO, /本番の断酒でGO!!には反映されません/);
  assert.match(INTRO, /href=["']app\.html["']/);
  assert.match(INTRO, /練習でGO!!に参加する/);
  assert.match(INTRO, /name=["']robots["'] content=["']noindex,nofollow["']/);
});

test('練習CMSは会場・例会・反映・削除・初期化の操作を備える', () => {
  for (const id of [
    'prefecture-select', 'venue-select', 'meeting-select', 'meeting-form',
    'new-meeting-button', 'delete-meeting-button', 'reset-button', 'training-map'
  ]) {
    assert.match(APP, new RegExp(`id=["']${id}["']`));
  }
  assert.match(APP, /本番の断酒でGO!!には反映されません/);
  assert.match(APP_JS, /fetch\('\.\.\/venues\.json'/);
  assert.doesNotMatch(APP_JS, /fetch\([^\n]*(?:POST|PUT|PATCH|DELETE)/i);
});

test('壊れた練習保存データは空配列として扱う', () => {
  assert.deepEqual(training.parseDrafts('{broken'), []);
  assert.deepEqual(training.parseDrafts('{"not":"array"}'), []);
});

test('練習データを保存して読み戻せる', () => {
  const storage = createStorage();
  const drafts = [{ id: 'draft-1', venueId: 10, operation: 'create', name: '練習例会' }];
  training.saveDrafts(storage, drafts);
  assert.deepEqual(training.loadDrafts(storage), drafts);
});

test('追加・編集・削除を会場ごとに本番データへ重ねられる', () => {
  const base = [
    { meeting_id: 1, name: '月曜例会', day_of_week: '月', start_time: '19:00' },
    { meeting_id: 2, name: '火曜例会', day_of_week: '火', start_time: '19:00' }
  ];
  const drafts = [
    { id: 'source-1', venueId: 10, sourceMeetingId: 1, operation: 'update', name: '月曜例会（練習編集）', day_of_week: '月' },
    { id: 'source-2', venueId: 10, sourceMeetingId: 2, operation: 'delete', name: '火曜例会' },
    { id: 'draft-3', venueId: 10, sourceMeetingId: null, operation: 'create', name: '水曜例会（練習追加）', day_of_week: '水' },
    { id: 'draft-other', venueId: 99, sourceMeetingId: null, operation: 'create', name: '別会場' }
  ];

  const merged = training.mergeMeetings(base, drafts, 10);
  assert.deepEqual(merged.map(item => item.name), ['月曜例会（練習編集）', '水曜例会（練習追加）']);
  assert.deepEqual(merged.map(item => item.trainingState), ['update', 'create']);
});

test('開催週の表示文言を利用者向けに整える', () => {
  assert.equal(training.recurrenceLabel('1,2,3,4,5', '金'), '毎週金曜');
  assert.equal(training.recurrenceLabel('1,3', '水'), '第1・第3水曜');
});

test('既存例会を編集しても画面上の選択対象を維持する', () => {
  assert.equal(
    training.meetingKey({ id: 'source-12', meeting_id: 12, trainingState: 'update' }),
    'source:12'
  );
  assert.equal(
    training.meetingKey({ id: 'draft-34', trainingState: 'create' }),
    'draft:draft-34'
  );
});
