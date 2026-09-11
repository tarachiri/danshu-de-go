const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const SOURCE = fs.readFileSync(path.join(__dirname, '../js/return-to-map.js'), 'utf8');

function runScenario({ search, referrer, historyLength }) {
  let clickHandler;
  let backCount = 0;
  const link = {
    addEventListener(type, handler) {
      if (type === 'click') clickHandler = handler;
    }
  };
  const window = {
    URL,
    URLSearchParams,
    location: { search, origin: 'https://dansyu-go.nukadokonokai.com' },
    history: { length: historyLength, back() { backCount += 1; } },
    document: {
      referrer,
      addEventListener(type, handler) {
        if (type === 'DOMContentLoaded') handler();
      },
      querySelectorAll() { return [link]; }
    }
  };
  vm.runInNewContext(SOURCE, { window, URL, URLSearchParams });
  let prevented = false;
  clickHandler({ preventDefault() { prevented = true; } });
  return { prevented, backCount };
}

test('メニュー経由では履歴で元のマップへ戻る', () => {
  const result = runScenario({ search: '?from=map', referrer: '', historyLength: 2 });
  assert.deepEqual(result, { prevented: true, backCount: 1 });
});

test('検索結果から直接開いた場合は通常のマップリンクとして動く', () => {
  const result = runScenario({
    search: '',
    referrer: 'https://www.google.com/',
    historyLength: 2
  });
  assert.deepEqual(result, { prevented: false, backCount: 0 });
});
