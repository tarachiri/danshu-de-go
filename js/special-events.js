(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SpecialEvents = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ANNOUNCEMENT_DAYS = 45;
  const TOP_NOTICE_DAYS = 7;
  const CATEGORY_META = {
    learning: { icon: '📖', label: '学びのイベント' },
    celebration: { icon: '🎊', label: '大会・記念イベント' },
    outreach: { icon: '🤝', label: '相談・啓発イベント' },
    fellowship: { icon: '🌿', label: '交流イベント' },
    other: { icon: '📅', label: '特別イベント' }
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

  function classify(item) {
    const explicit = String(item && item.category || '');
    if (CATEGORY_META[explicit]) return { kind: explicit, ...CATEGORY_META[explicit] };

    const text = `${String(item && item.event_type || item && item.meeting_type || '')} ${String(item && item.title || item && item.name || '')}`;
    if (CELEBRATION_WORDS.some(word => text.includes(word))) {
      return { kind: 'celebration', ...CATEGORY_META.celebration };
    }
    if (LEARNING_WORDS.some(word => text.includes(word))) {
      return { kind: 'learning', ...CATEGORY_META.learning };
    }
    return null;
  }

  function timestamp(value) {
    const parsed = Date.parse(String(value || ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function within(now, from, until) {
    const current = now.getTime();
    const start = timestamp(from);
    const end = timestamp(until);
    return start !== null && end !== null && current >= start && current < end;
  }

  function timePart(value) {
    const match = /T(\d{2}:\d{2})/.exec(String(value || ''));
    return match ? match[1] : '';
  }

  function normalizeEvent(raw, now = new Date()) {
    if (!raw || !raw.starts_at || !raw.promotion || !raw.venue) return null;
    const category = classify(raw) || { kind: 'other', ...CATEGORY_META.other };
    const date = String(raw.starts_at).slice(0, 10);
    const remainingDays = daysBetween(jstDate(now), date);
    const poster = raw.poster && raw.poster.url ? raw.poster : null;
    return {
      ...raw,
      ...category,
      date,
      start_time: timePart(raw.starts_at),
      end_time: timePart(raw.ends_at),
      remaining_days: remainingDays,
      is_soon: remainingDays !== null && remainingDays >= 0 && remainingDays <= TOP_NOTICE_DAYS,
      asset: poster ? { poster_url: poster.url, poster_alt: poster.alt || 'イベントのポスター' } : null,
      meeting: {
        meeting_id: raw.event_id,
        name: raw.title || '',
        meeting_type: raw.event_type || '',
        event_date: date,
        start_time: timePart(raw.starts_at),
        end_time: timePart(raw.ends_at)
      }
    };
  }

  function isMapVisible(event, now = new Date()) {
    return Boolean(event && within(
      now, event.promotion && event.promotion.map_from,
      event.promotion && event.promotion.map_until
    ));
  }

  function isFeatured(event, now = new Date()) {
    return Boolean(event && within(
      now, event.promotion && event.promotion.feature_from,
      event.promotion && event.promotion.feature_until
    ));
  }

  // 旧meetings.event_date形式は移行中のピン表示だけ維持する。
  // ポスターやトップ告知はspecial_events.jsonを正本とし、ここには持たせない。
  function getSpecialEvent(meeting, now = new Date()) {
    if (meeting && meeting.starts_at) {
      const event = normalizeEvent(meeting, now);
      return isMapVisible(event, now) ? event : null;
    }
    const category = classify(meeting);
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
      asset: null,
      meeting
    };
  }

  function mergeIntoVenues(venues, payload) {
    const result = Array.isArray(venues) ? venues : [];
    const byId = new Map(result.map(venue => [String(venue.id), venue]));
    const rawEvents = payload && Array.isArray(payload.events) ? payload.events : [];

    rawEvents.forEach(raw => {
      const venueData = raw && raw.venue;
      if (!venueData || venueData.id == null || !venueData.lat || !venueData.lng) return;
      const key = String(venueData.id);
      let venue = byId.get(key);
      if (!venue) {
        venue = {
          id: venueData.id,
          facility_name: venueData.name || '',
          address: venueData.address || '',
          prefecture: venueData.prefecture || '',
          lat: venueData.lat,
          lng: venueData.lng,
          meetings: [],
          next_date: '',
          meeting_name: '',
          start_time: '',
          end_time: '',
          recurrence: '',
          special_events: []
        };
        result.push(venue);
        byId.set(key, venue);
      }
      if (!Array.isArray(venue.special_events)) venue.special_events = [];
      const occurrenceId = String(raw.occurrence_id || `${raw.event_id}:${raw.starts_at}`);
      if (!venue.special_events.some(item =>
        String(item.occurrence_id || `${item.event_id}:${item.starts_at}`) === occurrenceId
      )) {
        venue.special_events.push(raw);
      }
    });
    return result;
  }

  function findAllForVenue(venue, now = new Date()) {
    const events = Array.isArray(venue && venue.special_events) ? venue.special_events : [];
    return events
      .map(event => normalizeEvent(event, now))
      .filter(event => isMapVisible(event, now))
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }

  function findForVenue(venue, now = new Date()) {
    const event = findAllForVenue(venue, now)[0];
    if (event) return event;
    return (venue && Array.isArray(venue.meetings) ? venue.meetings : [])
      .map(meeting => getSpecialEvent(meeting, now))
      .filter(Boolean)
      .sort((a, b) => a.date.localeCompare(b.date))[0] || null;
  }

  function findFeaturedForVenues(venues, now = new Date()) {
    const found = [];
    (Array.isArray(venues) ? venues : []).forEach(venue => {
      const events = Array.isArray(venue.special_events) ? venue.special_events : [];
      events.forEach(raw => {
        const event = normalizeEvent(raw, now);
        if (event && isFeatured(event, now)) found.push({ venue, event });
      });
    });
    return found.sort((a, b) =>
      Number(b.event.promotion.priority || 0) - Number(a.event.promotion.priority || 0) ||
      a.event.starts_at.localeCompare(b.event.starts_at) ||
      Number(a.event.event_id || 0) - Number(b.event.event_id || 0)
    );
  }

  return {
    ANNOUNCEMENT_DAYS,
    TOP_NOTICE_DAYS,
    classify,
    getSpecialEvent,
    normalizeEvent,
    isMapVisible,
    isFeatured,
    mergeIntoVenues,
    findAllForVenue,
    findForVenue,
    findFeaturedForVenues,
    jstDate
  };
});
