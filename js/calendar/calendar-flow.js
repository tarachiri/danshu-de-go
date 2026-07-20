(function(global) {
  'use strict';

  var state = {
    mode: 'regular',
    station: null,
    apiUrl: '',
    getCurrentLocation: null
  };

  function configure(options) {
    state.apiUrl = options.apiUrl;
    state.getCurrentLocation = options.getCurrentLocation;
  }

  function setMode(mode) {
    state.mode = mode || 'regular';
    if (state.mode !== 'daytime_station') state.station = null;
  }

  async function setStation(name) {
    state.station = await global.CalendarApi.geocodeStation(name);
    return state.station;
  }

  function monthString(next) {
    var parts = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit'
    }).formatToParts(new Date());
    var values = {};
    parts.forEach(function(part) { values[part.type] = part.value; });
    var year = Number(values.year);
    var month = Number(values.month) + (next ? 1 : 0);
    if (month > 12) { year += 1; month = 1; }
    return year + '-' + String(month).padStart(2, '0');
  }

  async function create(monthChoice) {
    var origin;
    if (state.mode === 'daytime_station') {
      if (!state.station) throw new Error('駅を選択してください');
      origin = state.station;
    } else {
      origin = await state.getCurrentLocation();
    }
    var month = monthString(monthChoice === 'next');
    var blob = await global.CalendarApi.createPdf(state.apiUrl, {
      lat: origin.lat,
      lng: origin.lng,
      month: month,
      mode: state.mode,
      radius_km: 50,
      event_radius_km: 100,
      per_day: 3,
      monochrome: true,
      location_label: origin.label
    });
    return { blob: blob, month: month, mode: state.mode, locationLabel: origin.label };
  }

  function getMode() { return state.mode; }
  global.CalendarFlow = { configure: configure, setMode: setMode, setStation: setStation, create: create, getMode: getMode };
})(window);
