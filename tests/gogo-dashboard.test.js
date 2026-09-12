const test = require('node:test');
const assert = require('node:assert/strict');
const dashboard = require('../js/gogo-dashboard.js');

function createStorage(initialValue) {
  const values = new Map();
  if (initialValue !== undefined) values.set(dashboard.STORAGE_KEY, initialValue);
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); }
  };
}

test('壊れた保存データは空の一覧として扱う', () => {
  assert.deepEqual(dashboard.load(createStorage('{broken')), []);
});

test('受付番号を新しい順で保存し、同じ番号は重複させない', () => {
  const storage = createStorage();
  dashboard.save(storage, 12, new Date('2026-09-12T01:00:00Z'));
  dashboard.save(storage, 34, new Date('2026-09-12T02:00:00Z'));
  dashboard.save(storage, 12, new Date('2026-09-12T03:00:00Z'));
  const receipts = dashboard.load(storage);
  assert.deepEqual(receipts.map(item => item.submissionId), ['12', '34']);
  assert.equal(receipts[0].submittedAt, '2026-09-12T03:00:00.000Z');
});

test('受付履歴は最大50件に制限する', () => {
  const storage = createStorage();
  for (let index = 0; index < 55; index += 1) {
    dashboard.save(storage, index, new Date(2026, 8, 12, 0, index));
  }
  assert.equal(dashboard.load(storage).length, 50);
});
