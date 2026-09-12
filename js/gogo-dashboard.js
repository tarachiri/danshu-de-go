// 情報提供ダッシュボード（第1段階）
// 投稿APIには利用者向け一覧取得機能がまだないため、送信成功時の受付番号だけを
// このブラウザに保存する。実際の確認・公開状態を推測して表示しないこと。
(function exposeGogoDashboard(root) {
  'use strict';

  const STORAGE_KEY = 'danshu-gogo-submission-receipts-v1';
  const MAX_RECEIPTS = 50;

  function normalizeReceipt(value) {
    if (!value || value.submissionId === undefined || value.submissionId === null) return null;
    const submissionId = String(value.submissionId).trim();
    if (!submissionId) return null;
    const submittedAt = typeof value.submittedAt === 'string' ? value.submittedAt : '';
    return { submissionId, submittedAt };
  }

  function load(storage) {
    if (!storage || typeof storage.getItem !== 'function') return [];
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeReceipt).filter(Boolean).slice(0, MAX_RECEIPTS);
    } catch (_) {
      return [];
    }
  }

  function save(storage, submissionId, now) {
    if (!storage || typeof storage.setItem !== 'function') return load(storage);
    const receipt = normalizeReceipt({
      submissionId,
      submittedAt: (now instanceof Date ? now : new Date()).toISOString()
    });
    if (!receipt) return load(storage);
    const receipts = load(storage).filter(item => item.submissionId !== receipt.submissionId);
    receipts.unshift(receipt);
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(receipts.slice(0, MAX_RECEIPTS)));
    } catch (_) {
      // 保存容量やプライベートブラウズの制約があっても投稿成功自体には影響させない。
    }
    return receipts.slice(0, MAX_RECEIPTS);
  }

  function formatSubmittedAt(value) {
    if (!value) return '送信日時不明';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '送信日時不明';
    return new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(date);
  }

  const api = { STORAGE_KEY, MAX_RECEIPTS, load, save, formatSubmittedAt };
  root.DanshuGogoDashboard = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
