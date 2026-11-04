// tests/netlify-release-policy.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const workflow = fs.readFileSync(
  path.join(root, '.github/workflows/netlify-production-release.yml'),
  'utf8'
);
const policy = fs.readFileSync(
  path.join(root, 'docs/netlify-release-policy.md'),
  'utf8'
);

test('Netlify定期公開は日本時間の月曜・木曜05:30に限定する', () => {
  assert.match(workflow, /cron:\s*["']30 20 \* \* 0,3["']/);
  assert.match(policy, /毎週月曜・木曜 05:30（日本時間）/);
});

test('緊急公開は理由の入力を必須にする', () => {
  assert.match(workflow, /workflow_dispatch:[\s\S]*reason:[\s\S]*required:\s*true/);
});

test('公開専用ブランチだけを進め、強制pushしない', () => {
  assert.match(workflow, /HEAD:refs\/heads\/netlify-production/);
  assert.doesNotMatch(workflow, /git push[^\n]*(?:--force|-f\b)/);
  assert.match(policy, /Production branchを`main`から`netlify-production`へ変更する/);
});

test('無料枠の運用目安と緊急枠を記録する', () => {
  assert.match(policy, /定期公開は月8〜10回/);
  assert.match(policy, /緊急公開は月4回/);
  assert.match(policy, /通信量やリクエストも同じ月間枠から消費される/);
});
