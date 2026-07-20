(function() {
  'use strict';
  var API_URL = 'https://chat.nukadokonokai.com';
  var form = document.getElementById('calendarForm');
  var locationType = document.getElementById('locationType');
  var locationText = document.getElementById('locationText');
  var locationTextField = document.getElementById('locationTextField');
  var status = document.getElementById('calendarStatus');
  var submit = document.getElementById('calendarSubmit');
  var result = document.getElementById('calendarResult');
  var preview = document.getElementById('calendarPreview');
  var openLink = document.getElementById('calendarOpen');
  var downloadLink = document.getElementById('calendarDownload');
  var currentPdfUrl = null;

  locationType.addEventListener('change', function() {
    var needsText = locationType.value !== 'current';
    locationTextField.hidden = !needsText;
    locationText.required = needsText;
    locationText.placeholder = locationType.value === 'station' ? '例：横浜駅' : '例：横浜市中区';
  });

  function currentLocation() {
    return new Promise(function(resolve, reject) {
      if (!navigator.geolocation) return reject(new Error('位置情報に対応していません'));
      navigator.geolocation.getCurrentPosition(function(pos) {
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: '現在地付近' });
      }, function() { reject(new Error('位置情報を取得できませんでした')); }, { timeout: 12000, maximumAge: 60000 });
    });
  }

  async function geocodePlace(text) {
    var response = await fetch('https://msearch.gsi.go.jp/address-search/AddressSearch?q=' + encodeURIComponent(text));
    if (!response.ok) throw new Error('場所を検索できませんでした');
    var items = await response.json();
    if (!items.length) throw new Error('場所が見つかりませんでした');
    var coordinates = items[0].geometry.coordinates;
    return { lat: Number(coordinates[1]), lng: Number(coordinates[0]), label: text };
  }

  form.addEventListener('submit', async function(event) {
    event.preventDefault();
    submit.disabled = true;
    status.textContent = '場所を確認してPDFを作成しています…';
    result.hidden = true;
    try {
      var mode = new FormData(form).get('mode');
      var origin = locationType.value === 'current' ? await currentLocation() : await geocodePlace(locationText.value.trim());
      if (mode === 'daytime_station' && locationType.value !== 'station') throw new Error('Dは基準地点で「駅」を選んでください');
      var blob = await CalendarApi.createPdf(API_URL, {
        lat: origin.lat, lng: origin.lng, location_label: origin.label,
        month: document.getElementById('month').value,
        mode: mode, radius_km: 50, event_radius_km: 100, per_day: 3, monochrome: true
      });
      if (currentPdfUrl) URL.revokeObjectURL(currentPdfUrl);
      currentPdfUrl = URL.createObjectURL(blob);
      preview.src = currentPdfUrl;
      openLink.href = currentPdfUrl;
      downloadLink.href = currentPdfUrl;
      downloadLink.download = 'meeting-calendar-' + document.getElementById('month').value + '.pdf';
      result.hidden = false;
      status.textContent = '完成しました。内容を確認して保存・印刷できます。';
    } catch (error) {
      status.textContent = error.message || 'PDFを作成できませんでした。';
    } finally {
      submit.disabled = false;
    }
  });
})();
