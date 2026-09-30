(function (root, factory) {
  const api = factory(root.PinSchedule);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FamilyMap = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (PinSchedule) {
  'use strict';

  const DEFAULT_WINDOW_DAYS = 30;

  function isFamilyMeeting(meeting) {
    if (!meeting) return false;

    // 確認済み分類に加え、名称に「家族」がある例会も家族向けマップへ出す。
    // 2026-09-29に運用方針として確定。「本人・家族会」等の混在名称も含む。
    // family_meeting の整備状況にかかわらず、名称判定は正式ルールとして残す。
    if (Number(meeting.family_meeting) === 1) return true;
    if (String(meeting.meeting_type || '') === '家族') return true;
    return /家族/.test(`${meeting.name || ''} ${meeting.group_name || ''}`);
  }

  function addDays(date, days) {
    const result = new Date(`${date}T00:00:00Z`);
    result.setUTCDate(result.getUTCDate() + days);
    return result.toISOString().slice(0, 10);
  }

  function meetingsWithinWindow(venue, now = new Date(), windowDays = DEFAULT_WINDOW_DAYS) {
    const schedule = PinSchedule || (typeof globalThis !== 'undefined' && globalThis.PinSchedule);
    if (!schedule) return [];

    const today = schedule.jstNow(now).date;
    const lastDate = addDays(today, windowDays);
    return schedule.deduplicateMeetings(venue && venue.meetings)
      .filter(isFamilyMeeting)
      .filter(meeting => schedule.meetingOccurrences(meeting).some(item =>
        !item.cancelled &&
        !schedule.isFinished(item.date, item.end_time, now) &&
        item.date >= today &&
        item.date <= lastDate
      ));
  }

  function withEffectiveOccurrence(venue, now = new Date(), windowDays = DEFAULT_WINDOW_DAYS) {
    const schedule = PinSchedule || (typeof globalThis !== 'undefined' && globalThis.PinSchedule);
    if (!schedule) return null;

    const familyMeetings = meetingsWithinWindow(venue, now, windowDays);
    const today = schedule.jstNow(now).date;
    const lastDate = addDays(today, windowDays);
    const candidates = familyMeetings
      .flatMap(meeting => schedule.meetingOccurrences(meeting))
      .filter(item => !item.cancelled && !schedule.isFinished(item.date, item.end_time, now))
      .filter(item => item.date >= today && item.date <= lastDate)
      .sort((a, b) =>
        a.date.localeCompare(b.date) ||
        (a.start_time || '00:00').localeCompare(b.start_time || '00:00')
      );

    const occurrence = candidates[0];
    if (!occurrence) return null;
    const effectiveMeeting = {
      ...occurrence.meeting,
      next_date: occurrence.date,
      next_date_2: '',
      has_exception: occurrence.date === occurrence.meeting.next_date
        ? occurrence.meeting.has_exception : false,
      exc_type: occurrence.date === occurrence.meeting.next_date
        ? occurrence.meeting.exc_type : '',
      exc_note: occurrence.date === occurrence.meeting.next_date
        ? occurrence.meeting.exc_note : ''
    };

    return {
      ...venue,
      meetings: [
        effectiveMeeting,
        ...familyMeetings.filter(meeting => meeting !== occurrence.meeting)
      ],
      next_date: occurrence.date,
      start_time: occurrence.start_time,
      end_time: occurrence.end_time,
      effective_meeting: occurrence.meeting,
      family_meeting_count: familyMeetings.length,
      family_map: true
    };
  }

  return {
    DEFAULT_WINDOW_DAYS,
    isFamilyMeeting,
    meetingsWithinWindow,
    withEffectiveOccurrence
  };
});
