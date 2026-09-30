'use strict';

const assert = require('node:assert/strict');
global.PinSchedule = require('../js/pin-schedule.js');
const FamilyMap = require('../js/family-map.js');

const now = new Date('2026-09-28T00:00:00+09:00');
const venue = {
  id: 1,
  meetings: [
    { name: '通常例会', meeting_type: '通常', next_date: '2026-09-29', start_time: '19:00' },
    { name: '家族例会', meeting_type: '通常', next_date: '2026-10-20', start_time: '13:00' },
    { name: '家族会', meeting_type: '通常', next_date: '2026-11-10', start_time: '13:00' }
  ]
};

assert.equal(FamilyMap.isFamilyMeeting(venue.meetings[0]), false);
assert.equal(FamilyMap.isFamilyMeeting(venue.meetings[1]), true);
assert.equal(FamilyMap.isFamilyMeeting({ name: '例会', meeting_type: '家族' }), true);
assert.equal(
  FamilyMap.isFamilyMeeting({ name: 'ふじみ野例会', meeting_type: '通常', family_meeting: 1 }),
  true,
  '確認済みフラグは名称より優先する'
);
assert.equal(
  FamilyMap.isFamilyMeeting({ name: '合同例会', meeting_type: '通常', family_meeting: '1' }),
  true,
  'JSON由来の文字列フラグにも対応する'
);
assert.equal(
  FamilyMap.isFamilyMeeting({ name: '家族会', meeting_type: '通常', family_meeting: 0 }),
  true,
  '名称に家族があれば未分類でも表示する'
);
assert.equal(
  FamilyMap.isFamilyMeeting({ name: '南(本人・家族会)', meeting_type: '通常', family_meeting: 0 }),
  true,
  '本人との混在名称でも家族を含めば表示する'
);
assert.equal(
  FamilyMap.isFamilyMeeting({ name: '通常例会', meeting_type: '通常', family_meeting: 0 }),
  false
);

const selected = FamilyMap.withEffectiveOccurrence(venue, now);
assert.equal(selected.next_date, '2026-10-20');
assert.equal(selected.meetings[0].name, '家族例会');
assert.equal(selected.family_meeting_count, 1, '30日以内に表示する家族例会だけを数える');
assert.equal(selected.meetings.some(meeting => meeting.name === '通常例会'), false);
assert.equal(selected.meetings.some(meeting => meeting.next_date === '2026-11-10'), false);
assert.equal(FamilyMap.withEffectiveOccurrence({ meetings: [venue.meetings[2]] }, now), null);

const normalMapVenue = global.PinSchedule.withEffectiveOccurrence(venue, now);
assert.equal(
  normalMapVenue.meetings.some(meeting => meeting.name === '家族例会'),
  true,
  '家族会は通常マップから除外せず、両方のマップに表示する'
);

const edge = FamilyMap.withEffectiveOccurrence({
  meetings: [{ name: '家族会', next_date: '2026-10-28', start_time: '10:00' }]
}, now);
assert.equal(edge.next_date, '2026-10-28', '30日後は表示範囲に含む');

const classifiedAlias = FamilyMap.withEffectiveOccurrence({
  meetings: [{
    name: '合同例会',
    meeting_type: '通常',
    family_meeting: 1,
    next_date: '2026-10-27',
    start_time: '19:00'
  }]
}, now);
assert.equal(classifiedAlias.next_date, '2026-10-27');
assert.equal(classifiedAlias.meetings[0].name, '合同例会');

console.log('family map tests: ok');
