(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SpecialEvents = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ANNOUNCEMENT_DAYS = 45;
  const TOP_NOTICE_DAYS = 7;

  // venues.jsonが毎朝更新されても確認済みの広報物が失われないよう、
  // ポスターは安定したmeeting_idに紐付ける。
  const ASSETS = {
    497: {
      poster_url: 'assets/event-posters/2026-09-27-fussa-alcohol-seminar.jpeg',
      poster_alt: '福生市民公開セミナー・アルコール勉強会のポスター'
    }
  };

  const LEARNING_WORDS = ['セミナー', '勉強会', '研修会', '研修大会', '講演会', '学習会'];
  const CELEBRATION_WORDS = ['記念大会', '記念例会', '周年行事', '地域大会', 'ブロック大会', '大会'];

  function jstDate(now = new Date()) {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(now);
  }

  function jstMinutes(now = new Date()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(now).map(part => [part.type, part.value]));
    return Number(parts.hour) * 60 + Number(parts.minute);
  }

  function timeMinutes(value) {
    const match = /^(\d{1,2}):(\d{2})/.exec(String(value || ''));
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : null;
  }

  function daysBetween(fromDate, toDate) {
    const from = Date.parse(`${fromDate}T00:00:00Z`);
    const to = Date.parse(`${toDate}T00:00:00Z`);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
    return Math.round((to - from) / 86400000);
  }

  function classify(meeting) {
    const name = String(meeting && meeting.name || '');
    const type = String(meeting && meeting.meeting_type || '');
    const text = `${type} ${name}`;
    if (CELEBRATION_WORDS.some(word => text.includes(word))) {
      return { kind: 'celebration', icon: '🎊', label: '大会・記念イベント' };
    }
    if (LEARNING_WORDS.some(word => text.includes(word))) {
      return { kind: 'learning', icon: '📖', label: '学びのイベント' };
    }
    return null;
  }

  function getSpecialEvent(meeting, now = new Date()) {
    const category = classify(meeting);
    // 確定したevent_dateを必須にし、名前だけ残る古い大会・研修会を誤告知しない。
    const date = String(meeting && meeting.event_date || '');
    if (!category || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

    const remainingDays = daysBetween(jstDate(now), date);
    if (remainingDays === null || remainingDays < 0 || remainingDays > ANNOUNCEMENT_DAYS) return null;
    const end = timeMinutes(meeting.end_time);
    if (remainingDays === 0 && end !== null && jstMinutes(now) >= end) return null;

    return {
      ...category,
      date,
      remaining_days: remainingDays,
      is_soon: remainingDays <= TOP_NOTICE_DAYS,
      asset: ASSETS[meeting.meeting_id] || null,
      meeting
    };
  }

  function findForVenue(venue, now = new Date()) {
    return (venue && Array.isArray(venue.meetings) ? venue.meetings : [])
      .map(meeting => getSpecialEvent(meeting, now))
      .filter(Boolean)
      .sort((a, b) => a.date.localeCompare(b.date))[0] || null;
  }

  return { ANNOUNCEMENT_DAYS, TOP_NOTICE_DAYS, classify, getSpecialEvent, findForVenue, jstDate };
});
