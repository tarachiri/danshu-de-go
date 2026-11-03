(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RenshuDeGo = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const STORAGE_KEY = 'renshu_de_go_drafts_v1';
  const DEFAULT_CENTER = [36.4, 138.0];

  function parseDrafts(raw) {
    if (!raw) return [];
    try {
      const value = JSON.parse(raw);
      return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
    } catch (_) {
      return [];
    }
  }

  function loadDrafts(storage) {
    if (!storage || typeof storage.getItem !== 'function') return [];
    return parseDrafts(storage.getItem(STORAGE_KEY));
  }

  function saveDrafts(storage, drafts) {
    if (!storage || typeof storage.setItem !== 'function') return;
    storage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(drafts) ? drafts : []));
  }

  function recurrenceLabel(weekOfMonth, dayOfWeek) {
    const weeks = String(weekOfMonth || '').split(',').filter(Boolean);
    if (weeks.join(',') === '1,2,3,4,5') return `毎週${dayOfWeek || ''}曜`;
    if (!weeks.length) return `${dayOfWeek || ''}曜`;
    return `第${weeks.join('・第')}${dayOfWeek || ''}曜`;
  }

  function mergeMeetings(baseMeetings, drafts, venueId) {
    const venueKey = String(venueId);
    const scoped = (Array.isArray(drafts) ? drafts : []).filter(draft => String(draft.venueId) === venueKey);
    const bySource = new Map();
    const created = [];

    scoped.forEach(draft => {
      if (draft.sourceMeetingId === null || draft.sourceMeetingId === undefined || draft.sourceMeetingId === '') {
        if (draft.operation !== 'delete') created.push({ ...draft, trainingState: 'create' });
        return;
      }
      bySource.set(String(draft.sourceMeetingId), draft);
    });

    const merged = (Array.isArray(baseMeetings) ? baseMeetings : []).flatMap(meeting => {
      const draft = bySource.get(String(meeting.meeting_id));
      if (!draft) return [{ ...meeting, trainingState: '' }];
      if (draft.operation === 'delete') return [];
      return [{
        ...meeting,
        ...draft,
        meeting_id: meeting.meeting_id,
        trainingState: 'update'
      }];
    });

    return merged.concat(created);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function makeDraftId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `draft-${crypto.randomUUID()}`;
    }
    return `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function meetingKey(meeting) {
    // 更新データにも練習レコード自身のidがあるが、画面上では本番meeting_idを
    // 維持して選択する。新規追加だけがdraft idを使う。
    if (meeting.trainingState === 'create') return `draft:${meeting.id}`;
    return `source:${meeting.meeting_id}`;
  }

  function operationLabel(operation) {
    if (operation === 'create') return '新規登録';
    if (operation === 'delete') return '削除';
    return '編集';
  }

  const api = {
    STORAGE_KEY,
    parseDrafts,
    loadDrafts,
    saveDrafts,
    recurrenceLabel,
    mergeMeetings,
    meetingKey,
    escapeHtml,
    operationLabel
  };

  if (typeof window === 'undefined' || !window.document) return api;

  let venues = [];
  let drafts = loadDrafts(window.localStorage);
  let selectedVenue = null;
  let selectedMeetingKey = '';
  let map = null;
  let marker = null;
  let toastTimer = null;

  const elements = {};

  function cacheElements() {
    [
      'data-status', 'prefecture-select', 'venue-select', 'meeting-select',
      'new-meeting-button', 'meeting-form', 'meeting-name', 'day-of-week',
      'week-of-month', 'start-time', 'end-time', 'meeting-type', 'form-mode',
      'delete-meeting-button', 'venue-summary', 'training-map', 'map-placeholder',
      'preview-card', 'activity-list', 'reset-button', 'toast'
    ].forEach(id => { elements[id] = document.getElementById(id); });
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => elements.toast.classList.remove('show'), 2600);
  }

  function initialiseMap() {
    if (!window.L || map) return;
    map = window.L.map(elements['training-map'], { zoomControl: true }).setView(DEFAULT_CENTER, 5);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
  }

  function populatePrefectures() {
    const prefectures = [...new Set(venues.map(venue => venue.prefecture).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'ja'));
    elements['prefecture-select'].innerHTML = '<option value="">都道府県を選んでください</option>' +
      prefectures.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
    elements['prefecture-select'].disabled = false;
  }

  function populateVenues(prefecture) {
    const candidates = venues
      .filter(venue => venue.prefecture === prefecture && Number.isFinite(Number(venue.lat)) && Number.isFinite(Number(venue.lng)))
      .sort((a, b) => String(a.facility_name || '').localeCompare(String(b.facility_name || ''), 'ja'));
    elements['venue-select'].innerHTML = '<option value="">会場を選んでください</option>' +
      candidates.map(venue => `<option value="${venue.id}">${escapeHtml(venue.facility_name || venue.meeting_name || '名称未設定')}｜${escapeHtml(venue.address || '')}</option>`).join('');
    elements['venue-select'].disabled = candidates.length === 0;
    resetVenueSelection();
  }

  function resetVenueSelection() {
    selectedVenue = null;
    selectedMeetingKey = '';
    elements['venue-summary'].hidden = true;
    elements['meeting-select'].disabled = true;
    elements['meeting-select'].innerHTML = '<option value="">先に会場を選んでください</option>';
    elements['new-meeting-button'].disabled = true;
    elements['meeting-form'].hidden = true;
    elements['preview-card'].hidden = true;
    elements['map-placeholder'].hidden = false;
    if (marker && map) {
      map.removeLayer(marker);
      marker = null;
      map.setView(DEFAULT_CENTER, 5);
    }
  }

  function effectiveMeetings() {
    if (!selectedVenue) return [];
    return mergeMeetings(selectedVenue.meetings || [], drafts, selectedVenue.id);
  }

  function renderVenue() {
    if (!selectedVenue) return;
    elements['venue-summary'].innerHTML = `<strong>${escapeHtml(selectedVenue.facility_name || '名称未設定')}</strong><span>${escapeHtml(selectedVenue.address || '住所未設定')}</span>`;
    elements['venue-summary'].hidden = false;
    elements['new-meeting-button'].disabled = false;
    populateMeetings();
    renderPreview();
  }

  function populateMeetings() {
    const meetings = effectiveMeetings();
    elements['meeting-select'].disabled = false;
    elements['meeting-select'].innerHTML = '<option value="">例会を選んで編集してください</option>' + meetings.map(meeting => {
      const tag = meeting.trainingState === 'create' ? '［練習で追加］' : meeting.trainingState === 'update' ? '［練習で編集］' : '';
      return `<option value="${escapeHtml(meetingKey(meeting))}">${tag}${escapeHtml(meeting.name || '無題の例会')}</option>`;
    }).join('');
    if (selectedMeetingKey && meetings.some(meeting => meetingKey(meeting) === selectedMeetingKey)) {
      elements['meeting-select'].value = selectedMeetingKey;
    } else {
      selectedMeetingKey = '';
      elements['meeting-select'].value = '';
      elements['meeting-form'].hidden = true;
    }
  }

  function findSelectedMeeting() {
    return effectiveMeetings().find(meeting => meetingKey(meeting) === selectedMeetingKey) || null;
  }

  function openNewMeetingForm() {
    if (!selectedVenue) return;
    selectedMeetingKey = '';
    elements['meeting-select'].value = '';
    elements['meeting-form'].reset();
    elements['start-time'].value = '19:00';
    elements['end-time'].value = '21:00';
    elements['form-mode'].textContent = '新規登録';
    elements['delete-meeting-button'].hidden = true;
    elements['meeting-form'].hidden = false;
    elements['meeting-name'].focus();
  }

  function openEditMeetingForm(meeting) {
    if (!meeting) return;
    elements['meeting-name'].value = meeting.name || '';
    elements['day-of-week'].value = meeting.day_of_week || '月';
    elements['week-of-month'].value = meeting.week_of_month || '1,2,3,4,5';
    elements['start-time'].value = meeting.start_time || '19:00';
    elements['end-time'].value = meeting.end_time || '21:00';
    elements['meeting-type'].value = meeting.meeting_type || '通常';
    elements['form-mode'].textContent = meeting.trainingState === 'create' ? '練習で追加した例会' : '既存例会を編集';
    elements['delete-meeting-button'].hidden = false;
    elements['meeting-form'].hidden = false;
  }

  function upsertDraft(draft) {
    const matchIndex = drafts.findIndex(item => {
      if (draft.sourceMeetingId !== null && draft.sourceMeetingId !== undefined) {
        return String(item.sourceMeetingId) === String(draft.sourceMeetingId) && String(item.venueId) === String(draft.venueId);
      }
      return item.id === draft.id;
    });
    if (matchIndex >= 0) drafts[matchIndex] = draft;
    else drafts.push(draft);
    saveDrafts(window.localStorage, drafts);
  }

  function formPayload() {
    return {
      name: elements['meeting-name'].value.trim(),
      day_of_week: elements['day-of-week'].value,
      week_of_month: elements['week-of-month'].value,
      start_time: elements['start-time'].value,
      end_time: elements['end-time'].value,
      meeting_type: elements['meeting-type'].value
    };
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!selectedVenue || !elements['meeting-form'].reportValidity()) return;
    const current = findSelectedMeeting();
    const payload = formPayload();
    const now = new Date().toISOString();

    if (current && current.trainingState === 'create') {
      upsertDraft({ ...current, ...payload, operation: 'create', updatedAt: now });
      selectedMeetingKey = `draft:${current.id}`;
      showToast('練習で追加した例会を更新しました');
    } else if (current) {
      upsertDraft({
        id: `source-${current.meeting_id}`,
        venueId: selectedVenue.id,
        sourceMeetingId: current.meeting_id,
        operation: 'update',
        ...payload,
        updatedAt: now
      });
      selectedMeetingKey = `source:${current.meeting_id}`;
      showToast('編集内容を練習マップへ反映しました');
    } else {
      const id = makeDraftId();
      upsertDraft({
        id,
        venueId: selectedVenue.id,
        sourceMeetingId: null,
        operation: 'create',
        ...payload,
        updatedAt: now
      });
      selectedMeetingKey = `draft:${id}`;
      showToast('新しい例会を練習マップへ追加しました');
    }

    populateMeetings();
    openEditMeetingForm(findSelectedMeeting());
    renderPreview();
    renderActivity();
  }

  function handleDelete() {
    const current = findSelectedMeeting();
    if (!current || !selectedVenue) return;
    if (!window.confirm('この例会を練習上で削除しますか？本番データは削除されません。')) return;

    if (current.trainingState === 'create') {
      drafts = drafts.filter(item => item.id !== current.id);
    } else {
      upsertDraft({
        id: `source-${current.meeting_id}`,
        venueId: selectedVenue.id,
        sourceMeetingId: current.meeting_id,
        operation: 'delete',
        name: current.name,
        updatedAt: new Date().toISOString()
      });
    }
    saveDrafts(window.localStorage, drafts);
    selectedMeetingKey = '';
    elements['meeting-form'].hidden = true;
    populateMeetings();
    renderPreview();
    renderActivity();
    showToast('練習上で削除しました。いつでも元に戻せます');
  }

  function renderPreview() {
    if (!selectedVenue) return;
    const meetings = effectiveMeetings();
    const lat = Number(selectedVenue.lat);
    const lng = Number(selectedVenue.lng);
    const meetingHtml = meetings.length ? meetings.map(meeting => {
      const tag = meeting.trainingState ? `<span class="change-tag">練習で${meeting.trainingState === 'create' ? '追加' : '編集'}</span>` : '';
      return `<div class="preview-meeting${meeting.trainingState ? ' training-change' : ''}">${tag}<strong>${escapeHtml(meeting.name || '無題の例会')}</strong><span>${escapeHtml(recurrenceLabel(meeting.week_of_month, meeting.day_of_week))}　${escapeHtml(meeting.start_time || '')}${meeting.end_time ? `〜${escapeHtml(meeting.end_time)}` : ''}</span></div>`;
    }).join('') : '<div class="empty-state">この会場の例会は練習上ですべて削除されています。</div>';

    elements['preview-card'].innerHTML = `<h3>${escapeHtml(selectedVenue.facility_name || '名称未設定')}</h3><p class="preview-address">${escapeHtml(selectedVenue.address || '住所未設定')}</p><div class="preview-meeting-list">${meetingHtml}</div>`;
    elements['preview-card'].hidden = false;
    elements['map-placeholder'].hidden = true;

    initialiseMap();
    if (!map || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (marker) map.removeLayer(marker);
    const popupItems = meetings.slice(0, 8).map(meeting => `<li>${escapeHtml(meeting.name || '無題')}｜${escapeHtml(recurrenceLabel(meeting.week_of_month, meeting.day_of_week))} ${escapeHtml(meeting.start_time || '')}</li>`).join('');
    marker = window.L.marker([lat, lng]).addTo(map).bindPopup(`<div class="map-popup"><h3>${escapeHtml(selectedVenue.facility_name || '')}</h3><p>練習用表示</p><ul>${popupItems || '<li>表示中の例会はありません</li>'}</ul></div>`).openPopup();
    map.setView([lat, lng], 15);
    window.setTimeout(() => map.invalidateSize(), 0);
  }

  function renderActivity() {
    const items = drafts.slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    if (!items.length) {
      elements['activity-list'].innerHTML = '<li class="empty-state">まだ練習操作はありません。</li>';
      return;
    }
    elements['activity-list'].innerHTML = items.map(item => {
      const venue = venues.find(candidate => String(candidate.id) === String(item.venueId));
      const date = item.updatedAt ? new Date(item.updatedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      return `<li class="activity-item"><strong>${escapeHtml(operationLabel(item.operation))}：${escapeHtml(item.name || '無題の例会')}</strong><small>${escapeHtml(venue?.facility_name || '会場不明')}　${escapeHtml(date)}</small></li>`;
    }).join('');
  }

  function resetAll() {
    if (!drafts.length) {
      showToast('元に戻す練習内容はありません');
      return;
    }
    if (!window.confirm('この端末に保存された練習内容をすべて消して、公開データの状態へ戻しますか？')) return;
    drafts = [];
    saveDrafts(window.localStorage, drafts);
    selectedMeetingKey = '';
    elements['meeting-form'].hidden = true;
    if (selectedVenue) {
      populateMeetings();
      renderPreview();
    }
    renderActivity();
    showToast('練習内容をすべて元に戻しました');
  }

  function bindEvents() {
    elements['prefecture-select'].addEventListener('change', event => populateVenues(event.target.value));
    elements['venue-select'].addEventListener('change', event => {
      selectedVenue = venues.find(venue => String(venue.id) === String(event.target.value)) || null;
      selectedMeetingKey = '';
      elements['meeting-form'].hidden = true;
      if (selectedVenue) renderVenue();
      else resetVenueSelection();
    });
    elements['meeting-select'].addEventListener('change', event => {
      selectedMeetingKey = event.target.value;
      const meeting = findSelectedMeeting();
      if (meeting) openEditMeetingForm(meeting);
      else elements['meeting-form'].hidden = true;
    });
    elements['new-meeting-button'].addEventListener('click', openNewMeetingForm);
    elements['meeting-form'].addEventListener('submit', handleSubmit);
    elements['delete-meeting-button'].addEventListener('click', handleDelete);
    elements['reset-button'].addEventListener('click', resetAll);
  }

  async function init() {
    cacheElements();
    bindEvents();
    renderActivity();
    try {
      const response = await window.fetch('../venues.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      venues = Array.isArray(data) ? data : [];
      populatePrefectures();
      // 保存済み履歴は教材読込前にも描画するが、会場名は読込後に確定する。
      renderActivity();
      elements['data-status'].textContent = `本番公開データを教材として読み込みました（${venues.length.toLocaleString('ja-JP')}会場）`;
    } catch (error) {
      elements['data-status'].textContent = '教材データを読み込めませんでした。通信状態を確認して再読み込みしてください。';
      elements['data-status'].classList.add('error');
      console.error('練習教材データの読み込みに失敗しました', error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return api;
});
