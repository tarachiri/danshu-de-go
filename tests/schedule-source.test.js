// 日程データの正本をvenues.jsonへ固定し、廃止したschedule.jsonの復活を防ぐ。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const SCHEDULE_JS = fs.readFileSync(path.join(ROOT, 'schedule.js'), 'utf8');

test('schedule.jsonは公開物として存在しない', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'schedule.json')), false);
});

test('日程タブはvenues.jsonを正本として一覧を導出する', () => {
  assert.match(SCHEDULE_JS, /fetch\('venues\.json/);
  assert.match(SCHEDULE_JS, /_flattenVenuesToSchedule/);
  assert.match(SCHEDULE_JS, /seenOccurrences/);
  assert.match(SCHEDULE_JS, /normalizeIdentityText/);
  assert.doesNotMatch(SCHEDULE_JS, /fetch\(['"]schedule\.json/);
});

test('現行の運用文書はschedule.jsonを生成対象にしない', () => {
  const currentDocs = [
    'AGENTS.md',
    'CLAUDE.md',
    'docs/architecture.md',
    'docs/architecture_next.md',
    'docs/code-structure.md',
    'docs/detail/cron-jobs.md',
    'docs/detail/frontend-structure.md',
  ].map(file => fs.readFileSync(path.join(ROOT, file), 'utf8')).join('\n');

  assert.doesNotMatch(currentDocs, /venues\.json[・／\/]schedule\.json/);
  assert.doesNotMatch(currentDocs, /schedule\.jsonを一括生成/);
  assert.match(currentDocs, /schedule\.jsonは廃止済み|schedule\.json.*正式廃止/);
});
