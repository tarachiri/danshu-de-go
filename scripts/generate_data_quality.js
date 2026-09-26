#!/usr/bin/env node

// venues.jsonの日程を「公式の開催日」と「定期予定からの計算日」に分けて集計する。
// 公式の日付情報がない地域の計算日程は、誤り・未確認として扱わない。

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_INPUT = path.join(ROOT, 'venues.json');
const DEFAULT_OUTPUT = path.join(ROOT, 'meetings', 'data-quality.json');
const OFFICIAL_DATE_RECURRENCE = '公式日程（日付指定）';

function jstIsoString(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+09:00`;
}

function classifyDateBasis(meeting) {
  // date_basisはgenerate_map_v6.pyの新しい出力。旧JSONからは、公式日付を
  // 使った計算か単なる定期計算かを推測できないため、明示値を優先する。
  const declared = String(meeting.date_basis || '');
  if (['official_date', 'ical', 'pdf', 'official_site', 'manual_official'].includes(declared)) {
    return 'official_date';
  }
  if (declared === 'manual_date' || declared === 'event_date') {
    return 'manual_date';
  }
  if (declared === 'recurrence_calculated' || declared === 'recurrence') {
    return 'recurrence_calculated';
  }
  if (!meeting.next_date && !meeting.next_date_2 && !meeting.event_date) {
    return 'no_upcoming_date';
  }
  if (meeting.recurrence === OFFICIAL_DATE_RECURRENCE) {
    return 'official_date';
  }
  if (meeting.event_date) return 'manual_date';
  return 'unknown';
}

function emptyCounts() {
  return {
    meetings_total: 0,
    official_date: 0,
    manual_date: 0,
    recurrence_calculated: 0,
    no_upcoming_date: 0,
    unknown: 0,
  };
}

function buildDataQuality(venues, options = {}) {
  const generatedAt = jstIsoString(options.now || new Date());
  const sourceModifiedAt = options.sourceModifiedAt
    ? jstIsoString(options.sourceModifiedAt)
    : null;
  const totals = emptyCounts();
  const prefectures = new Map();
  let venuesWithCoordinates = 0;
  let verifiedVenues = 0;

  for (const venue of venues) {
    const prefecture = venue.prefecture || '都道府県不明';
    if (!prefectures.has(prefecture)) {
      prefectures.set(prefecture, {
        prefecture,
        venues_total: 0,
        venues_with_coordinates: 0,
        verified_venues: 0,
        ...emptyCounts(),
      });
    }
    const row = prefectures.get(prefecture);
    row.venues_total += 1;
    if (Number.isFinite(Number(venue.lat)) && Number.isFinite(Number(venue.lng))) {
      venuesWithCoordinates += 1;
      row.venues_with_coordinates += 1;
    }
    if (Number(venue.needs_verification || 0) === 0) {
      verifiedVenues += 1;
      row.verified_venues += 1;
    }
    for (const meeting of venue.meetings || []) {
      const basis = classifyDateBasis(meeting);
      totals.meetings_total += 1;
      totals[basis] += 1;
      row.meetings_total += 1;
      row[basis] += 1;
    }
  }

  return {
    schema_version: 1,
    generated_at: generatedAt,
    source: {
      file: 'venues.json',
      file_modified_at: sourceModifiedAt,
      date_authority: 'venues.json',
    },
    definitions: {
      official_date: '公式PDF・公式サイト・iCal等に掲載された開催日を使用',
      manual_date: '個別日付として登録されているが、公開JSONだけでは公式出典を判定不能',
      recurrence_calculated: '公式の個別開催日がないため、曜日・第何週などの定期予定から算出',
      no_upcoming_date: '現在の公開期間内に次回日なし',
      unknown: '日付の根拠を公開データから判定不能',
    },
    accuracy: {
      status: 'not_independently_measured',
      note: '公式日付は元情報の日付を採用する。定期計算日程は公式の個別開催日がない地域の補完であり、誤り扱いしない。元情報との独立した標本照合率は未計測。',
    },
    summary: {
      prefectures_covered: prefectures.size,
      venues_total: venues.length,
      venues_with_coordinates: venuesWithCoordinates,
      verified_venues: verifiedVenues,
      ...totals,
    },
    prefectures: [...prefectures.values()].sort((a, b) =>
      a.prefecture.localeCompare(b.prefecture, 'ja')
    ),
  };
}

function generateDataQuality(inputPath = DEFAULT_INPUT, outputPath = DEFAULT_OUTPUT) {
  const venues = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const report = buildDataQuality(venues, {
    sourceModifiedAt: fs.statSync(inputPath).mtime,
  });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (require.main === module) {
  const report = generateDataQuality(process.argv[2], process.argv[3]);
  console.log(
    `日程根拠を集計: 公式日付${report.summary.official_date}件・` +
    `個別登録日${report.summary.manual_date}件・` +
    `定期計算${report.summary.recurrence_calculated}件・` +
    `次回日なし${report.summary.no_upcoming_date}件`
  );
}

module.exports = { buildDataQuality, classifyDateBasis, generateDataQuality, jstIsoString };
