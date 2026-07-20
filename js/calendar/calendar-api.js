(function(global) {
  'use strict';

  async function createPdf(apiUrl, payload) {
    var response = await fetch(apiUrl + '/meetings/calendar.pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.blob();
  }

  async function geocodeStation(name) {
    var query = String(name || '').trim();
    if (!query) throw new Error('駅名が空です');
    if (!/駅$/.test(query)) query += '駅';
    var url = 'https://msearch.gsi.go.jp/address-search/AddressSearch?q=' + encodeURIComponent(query);
    var response = await fetch(url);
    if (!response.ok) throw new Error('駅を検索できませんでした');
    var items = await response.json();
    if (!Array.isArray(items) || !items.length) throw new Error('駅が見つかりませんでした');
    var coordinates = items[0].geometry && items[0].geometry.coordinates;
    if (!coordinates || coordinates.length < 2) throw new Error('駅の座標がありません');
    return {
      label: query,
      lat: Number(coordinates[1]),
      lng: Number(coordinates[0])
    };
  }

  global.CalendarApi = { createPdf: createPdf, geocodeStation: geocodeStation };
})(window);
