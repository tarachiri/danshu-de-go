(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PinSchedule = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const JST_FORMATTER = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });

  function jstNow(now = new Date()) {
    const parts = Object.fromEntries(
      JST_FORMATTER.formatToParts(now).map(part => [part.type, part.value])
    );
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      minutes: Number(parts.hour) * 60 + Number(parts.minute)
    };
  }

  function timeMinutes(value) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value || '');
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : null;
  }

  function isDayMeeting(startTime) {
    const minutes = timeMinutes(startTime);
    return minutes !== null && minutes <= 15 * 60;
  }

  function isFinished(date, endTime, now = new Date()) {
    if (!date) return false;
    const current = jstNow(now);
    if (date < current.date) return true;
    if (date > current.date) return false;
    const end = timeMinutes(endTime);
    // 終了時刻不明の例会は、誤って消さず当日中表示する。
    return end !== null && current.minutes >= end;
  }

  function meetingOccurrences(meeting) {
    const dates = [meeting.next_date, meeting.next_date_2].filter(Boolean);
    if (dates.length === 0 && meeting.event_date) dates.push(meeting.event_date);
    return [...new Set(dates)].map((date, index) => ({
      date,
      start_time: meeting.start_time || '',
      end_time: meeting.end_time || '',
      meeting,
      // 例外情報は生成時に照合した直近開催日にだけ適用される。
      cancelled: index === 0 && meeting.has_exception && meeting.exc_type === 'cancel'
    }));
  }

  function selectVenueOccurrence(venue, now = new Date()) {
    const meetings = Array.isArray(venue.meetings) ? venue.meetings : [];
    let candidates = meetings.flatMap(meetingOccurrences);
    if (candidates.length === 0 && (venue.fallback_next_date || venue.next_date)) {
      candidates = [{
        date: venue.fallback_next_date || venue.next_date,
        start_time: venue.start_time || '',
        end_time: venue.end_time || '',
        meeting: null,
        cancelled: false
      }];
    }
    candidates = candidates.filter(item =>
      !item.cancelled && !isFinished(item.date, item.end_time, now)
    );
    candidates.sort((a, b) =>
      a.date.localeCompare(b.date) ||
      (a.start_time || '00:00').localeCompare(b.start_time || '00:00')
    );
    return candidates[0] || null;
  }

  function withEffectiveOccurrence(venue, now = new Date()) {
    const occurrence = selectVenueOccurrence(venue, now);
    if (!occurrence) {
      const hasDatedMeeting = (venue.meetings || []).some(meeting =>
        meeting.next_date || meeting.next_date_2 || meeting.event_date
      );
      return hasDatedMeeting ? null : venue;
    }
    let meetings = venue.meetings;
    if (occurrence.meeting) {
      const isOriginalDate = occurrence.date === occurrence.meeting.next_date;
      const effectiveMeeting = {
        ...occurrence.meeting,
        next_date: occurrence.date,
        next_date_2: isOriginalDate ? occurrence.meeting.next_date_2 : '',
        has_exception: isOriginalDate ? occurrence.meeting.has_exception : false,
        exc_type: isOriginalDate ? occurrence.meeting.exc_type : '',
        exc_note: isOriginalDate ? occurrence.meeting.exc_note : ''
      };
      meetings = [
        effectiveMeeting,
        ...(venue.meetings || []).filter(meeting => meeting !== occurrence.meeting)
      ];
    }
    return {
      ...venue,
      meetings,
      next_date: occurrence.date,
      start_time: occurrence.start_time,
      end_time: occurrence.end_time,
      effective_meeting: occurrence.meeting
    };
  }

  return { jstNow, timeMinutes, isDayMeeting, isFinished, selectVenueOccurrence, withEffectiveOccurrence };
});
