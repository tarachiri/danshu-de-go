// tests/data-quality.test.js
// 公式日付と、公式の個別日付がない地域の定期計算を混同しないための回帰テスト。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { buildDataQuality, classifyDateBasis } = require('../scripts/generate_data_quality');

const ROOT = path.resolve(__dirname, '..');

test('日付根拠を公式日付・定期計算・次回日なしへ分類する', () => {
  assert.equal(classifyDateBasis({ date_basis: 'official_date', next_date: '2026-10-01' }), 'official_date');
  assert.equal(classifyDateBasis({ date_basis: 'official_schedule_calculated', next_date: '2026-10-01' }), 'official_schedule_calculated');
  assert.equal(classifyDateBasis({ recurrence: '公式日程（日付指定）', next_date: '2026-10-01' }), 'official_date');
  assert.equal(classifyDateBasis({ event_date: '2026-10-01' }), 'manual_date');
  assert.equal(classifyDateBasis({ date_basis: 'recurrence_calculated', day_of_week: '木', next_date: '2026-10-01' }), 'recurrence_calculated');
  assert.equal(classifyDateBasis({ day_of_week: '木', recurrence: '毎週木曜', next_date: '2026-10-01' }), 'unknown');
  assert.equal(classifyDateBasis({ day_of_week: '木' }), 'no_upcoming_date');
  assert.equal(classifyDateBasis({ next_date: '2026-10-01' }), 'unknown');
});

test('定期計算日程を誤り・未確認として集計しない', () => {
  const report = buildDataQuality([{
    prefecture: '例県', lat: 35, lng: 139, needs_verification: 0,
    meetings: [
      { date_basis: 'official_date', next_date: '2026-10-01' },
      { date_basis: 'official_schedule_calculated', next_date: '2026-10-02' },
      { date_basis: 'recurrence_calculated', next_date: '2026-10-03' },
      { date_basis: 'manual_date', next_date: '2026-10-04' },
    ],
  }], { now: new Date('2026-09-26T00:00:00Z') });

  assert.equal(report.summary.official_date, 1);
  assert.equal(report.summary.official_schedule_calculated, 1);
  assert.equal(report.summary.recurrence_calculated, 1);
  assert.equal(report.summary.manual_date, 1);
  assert.equal(report.summary.unknown, 0);
  assert.equal(report.accuracy.status, 'not_independently_measured');
  assert.match(report.accuracy.note, /誤り扱いしない/);
});

test('公開品質JSONは全都道府県と全例会を集計している', () => {
  const venues = JSON.parse(fs.readFileSync(path.join(ROOT, 'venues.json'), 'utf8'));
  const report = buildDataQuality(venues, { now: new Date('2026-09-26T00:00:00Z') });
  const meetingCount = venues.reduce((sum, venue) => sum + (venue.meetings || []).length, 0);
  const prefectureCount = new Set(venues.map(venue => venue.prefecture)).size;

  assert.equal(report.summary.venues_total, venues.length);
  assert.equal(report.summary.meetings_total, meetingCount);
  assert.equal(report.summary.prefectures_covered, prefectureCount);
  assert.equal(report.prefectures.length, prefectureCount);
  assert.equal(
    report.summary.official_date + report.summary.official_schedule_calculated
      + report.summary.manual_date + report.summary.recurrence_calculated
      + report.summary.no_upcoming_date + report.summary.unknown,
    meetingCount
  );
});
