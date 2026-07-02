# app.js 説明書

> `app.js` は、断酒でGO!! メイン画面の地図・ピン・タブ切替・メニュー・新着表示を動かす中心ファイルです。
> `index.html` の読み込み順は `docs/index-load-flow.md`、全体構造は `docs/code-structure.md` を参照。

最終確認: 2026-06-30

---

## まず結論

`app.js` は「読み込まれたらすぐ起動する」タイプのJavaScriptです。

主な仕事は次の通りです。

1. Leaflet地図を作る
2. 現在地取得と都道府県推定をする
3. `venues.json` を読み込む
4. 会場ピンとポップアップを作る
5. 今日・明日・明後日の件数を更新する
6. マップ、日程、新着、かもちゃんのタブを切り替える
7. 右下メニュー、ズームスライダー、PWA案内を作る
8. `news.json` を読んで新着タブを描画する

`index.html` 側にある `#map`, `#schedule`, `#news`, `#bottom-nav` などのDOMを前提に動きます。

---

## 読み込み前提

`app.js` は `index.html` の最後で読み込まれます。

```html
<script src="schedule.js"></script>
<script src="app.js"></script>
```

この順番が必要です。

| 前提 | 理由 |
|---|---|
| Leaflet.js が先に読み込まれている | 1行目で `L.map(...)` を使うため |
| MarkerCluster が先に読み込まれている | `L.markerClusterGroup(...)` を使うため |
| `schedule.js` が先に読み込まれている | `switchTab('schedule')` で `Schedule.render()` を呼ぶため |
| `index.html` に `#map` が存在する | 1行目で地図を作るため |
| `index.html` に `window.setSplashProgress` がある | 読み込み進捗表示に使うため |

---

## 上から見た構成

| 行付近 | ブロック | 内容 |
|---:|---|---|
| 1-48 | 地図初期化・現在地 | Leaflet地図作成、現在地取得、GSI逆ジオコーディング、現在地ボタン |
| 49-127 | 日付・ピン補助関数 | JST日付、今日/明日/明後日判定、ピン色、日付表示 |
| 128-283 | ポップアップ生成 | 施設名、住所、例会カード、公式サイト、経路リンク、確認注意 |
| 286-329 | マーカー移動 | 日程カードなどから地図ピンへジャンプ |
| 332-365 | タブ切替 | マップ、日程、新着の表示切替 |
| 368-414 | 地域・レイヤー定義 | エリア定義、`VENUES`、クラスタ、快適/探索レイヤー |
| 416-445 | `venues.json` 読み込み | データ取得、更新日表示、ピン描画開始 |
| 447-538 | PWA追加案内 | ブラウザ別「ホーム画面に追加」案内 |
| 540-606 | 表示モード・フィルタ | 快適/探索モード、ピン再描画、件数更新 |
| 608 | 初期データ読み込み | `initVenues()` を実行 |
| 612-689 | ズームスライダー | 右側の縦ズームUIを動的生成 |
| 692-872 | 右下メニュー | メニュー、共有ボタン、モード切替、マニュアル/FAQ導線 |
| 875-876 | Service Worker | `sw.js` 登録 |
| 880-902 | 共有バー補助 | 旧UI由来の共有関数 |
| 905-919 | 免責同意補助 | 旧 `disclaimer-overlay` 用の関数 |
| 923-936 | かもちゃん | `chat.html` を iframe 表示 |
| 944-1089 | 新着タブ | `news.json` 取得、イベント/PDF/ニュースカード生成 |
| 1093-1098 | 古い追記メモ | すでに `switchTab()` 連携済みのコメント |

---

## 起動時の流れ

`app.js` が読み込まれると、次の順番で動きます。

```text
L.map("map") で地図作成
  ↓
map.locate() で現在地取得を試す
  ↓
locationfound ハンドラ登録
  ↓
現在地ボタン追加
  ↓
スプラッシュ進捗 10%
  ↓
OpenStreetMapタイル追加
  ↓
クラスタレイヤーと快適モード用レイヤー作成
  ↓
initVenues()
  ↓
venues.json を取得
  ↓
VENUES に保存
  ↓
applyFilters()
  ↓
ピン作成・件数更新
  ↓
スプラッシュ進捗 100%
  ↓
ズームスライダーと右下メニューを追加
```

`initVenues()` が成功すると地図ピンが出ます。
失敗するとスプラッシュに読み込み失敗が表示され、スプラッシュクリックで再読み込みできます。

---

## グローバル状態

`app.js` 内で共有している主な状態です。

| 変数 | 内容 |
|---|---|
| `map` | Leaflet地図本体 |
| `window._leafletMap` | 外部関数からも触れる地図参照 |
| `TODAY` | JST基準の今日 `YYYY-MM-DD` |
| `TOMORROW` | JST基準の明日 |
| `DAY_AFTER` | JST基準の明後日 |
| `VENUES` | `venues.json` から取得した会場配列 |
| `clusterGroup` | 探索モード用のMarkerClusterレイヤー |
| `comfortGroup` | 快適モード用の通常レイヤー |
| `currentMode` | `'comfort'` または `'explore'` |
| `window._markers` | `venue.id -> marker` の辞書。ジャンプ用 |
| `SITE_URL` | 共有用URL |
| `SITE_TEXT` | 共有用テキスト |

---

## venues.json に期待している主な項目

`app.js` は `venues.json` の各会場オブジェクト `v` に、だいたい次の項目がある前提で動きます。

| 項目 | 用途 |
|---|---|
| `id` | `window._markers` のキー、日程タブからのジャンプ |
| `lat`, `lng` | 地図ピンの座標 |
| `prefecture` | ピン色、エリア判定、件数表示 |
| `facility_name` | ポップアップの施設名 |
| `address` | ポップアップ住所、Google Maps経路リンク |
| `next_date` | 今日/明日/明後日/その他の判定 |
| `meetings` | 例会カードの一覧。あれば最優先 |
| `calendar_url` | 公式カレンダーリンク |
| `official_url` | 公式サイトリンク、確認注意リンク |
| `needs_verification` | 要確認メッセージ表示 |
| `fallback_meeting_name` | `meetings` がない場合の例会名 |
| `fallback_next_date` | `meetings` がない場合の次回開催日 |
| `fallback_schedule` | `meetings` がない場合の開催周期 |
| `has_exception` | 例外・中止表示 |

`meetings` 配列がある場合、`buildPopup()` は `meetings` を優先します。
`meetings` がない場合だけ、フォールバック項目を使います。

---

## 地図初期化

### `L.map("map", ...)`

`index.html` の `#map` に地図を作ります。

```js
const map = window._leafletMap = L.map("map", {zoomControl: false}).setView([35.68, 139.60], 9);
```

初期位置は東京付近です。
`zoomControl: false` なので、Leaflet標準のズームボタンは出さず、後半の自作ズームスライダーを使います。

### `map.locate(...)`

読み込み直後に現在地取得を試みます。
成功すると `locationfound` が発火します。

### GSI逆ジオコーディング

現在地取得に成功したら、国土地理院の逆ジオコーダーで市区町村コードを取り、先頭2桁から都道府県を推定します。

推定できたら次を呼びます。

```js
Schedule.setFilter(pref);
```

これにより、日程タブの都道府県フィルタが現在地に寄ります。

---

## 日付判定とピン色

### `getTodayJST()` / `getTomorrowJST()`

JST基準で日付文字列を作ります。
地図の今日/明日判定はこの値に依存します。

### `getDateLabel(next_date)`

`next_date` を次のラベルに変換します。

| 戻り値 | 意味 |
|---|---|
| `today` | 今日 |
| `tomorrow` | 明日 |
| `dayafter` | 明後日 |
| `other` | それ以外の日付 |
| `none` | 日付なし |

### `getStyle(v)`

ピンの色とサイズを決めます。

| ラベル | 色 | サイズ |
|---|---|---:|
| 今日 | 赤系 | 28 |
| 明日 | オレンジ系 | 26 |
| 明後日 | 薄赤系 | 21 |
| その他 | 都道府県別または青 | 15 |

### `makeIcon(v)`

`getStyle(v)` の結果を使って、Leafletの `L.divIcon` を作ります。
ピンはCSSの丸を45度回転させた形です。

---

## ポップアップ生成

### `buildPopup(v)`

地図ピンをタップした時のポップアップHTMLを作る、かなり重要な関数です。

表示するものは主に次です。

- 開催状況バッジ
- 施設名
- 住所
- `needs_verification=1` の確認注意
- 例会カード一覧
- 公式カレンダーリンク
- 公式サイトリンク
- Google Maps経路リンク

### meetings がある場合

`v.meetings` が空でなければ、各 meeting をカードとして表示します。

各カードでは以下を見ます。

| meeting項目 | 用途 |
|---|---|
| `name` | 例会名 |
| `meeting_type` | 例会タイプアイコン |
| `next_date` | 次回開催日 |
| `start_time`, `end_time` | 時刻 |
| `recurrence` | 開催周期 |
| `has_exception` | 例外表示 |
| `exc_type` | 中止か変更か |
| `exc_note` | 例外メモ |

### meetings がない場合

`fallback_meeting_name`, `fallback_next_date`, `fallback_schedule` などを使います。
これは meetings テーブル未紐づきデータの表示保険です。

### 要確認表示

`needs_verification=1` の会場は、ポップアップ内に確認注意を表示します。
これは安全上重要なので、削らない方がよいです。

---

## タブ切替

### `switchTab(tab)`

下部ナビの表示を切り替えます。

| tab | 動き |
|---|---|
| `map` | `#map` を表示し、Leafletのサイズを再計算 |
| `schedule` | `#schedule` を表示し、`Schedule.render()` を呼ぶ |
| `news` | `#news` を表示し、`loadNewsTab()` を呼ぶ |

かもちゃんだけは `switchTab()` ではなく、`openKamo()` を直接呼びます。

---

## データ読み込み

### `initVenues()`

`venues.json` を読み込む関数です。

流れは次の通りです。

```text
ヘッダー総数を "..." にする
  ↓
スプラッシュ進捗 30%
  ↓
fetch('venues.json?v=' + Date.now())
  ↓
Last-Modified があれば #footer-updated に表示
  ↓
VENUES = data
  ↓
スプラッシュ進捗 80%
  ↓
applyFilters()
  ↓
スプラッシュ進捗 100%
```

キャッシュバスターに `Date.now()` を使っているため、毎回最新を取りに行く動きです。

### 失敗時

`venues.json` 取得に失敗すると、以下を行います。

- consoleにエラー出力
- スプラッシュ進捗を100%にして失敗表示
- スプラッシュクリックでページ再読み込み
- ヘッダー総数を `!` にする

---

## ピンの再描画

### `setMode(mode)`

`currentMode` を切り替え、`applyFilters()` を呼びます。

| mode | 内容 |
|---|---|
| `comfort` | 今日・明日・明後日など直近開催だけを中心に表示 |
| `explore` | 日程未定やその他も含めて探索しやすくする |

### `applyFilters()`

地図上のピンをすべて作り直す関数です。

やっていることは次の通りです。

```text
date-filter / area-filter を読む
  ↓
現在モードに応じて comfortGroup / clusterGroup を切り替える
  ↓
既存ピンを消す
  ↓
VENUES を1件ずつ見る
  ↓
座標なしは除外
  ↓
快適モードなら none / other を除外
  ↓
日付・エリア条件で除外
  ↓
L.marker を作る
  ↓
buildPopup(v) を bindPopup する
  ↓
window._markers[v.id] に保存
  ↓
今日・明日・明後日・総例会数を更新
```

現在の `index.html` には `date-filter` と `area-filter` はありません。
`applyFilters()` 側は optional chaining で安全に読んでいるため、存在しなくても `all` 扱いになります。

---

## 日程タブから地図へのジャンプ

### `jumpToMarker(id, lat, lng, name)`

`schedule.js` の日程カードから呼ばれる想定です。

流れは次の通りです。

```text
マップタブへ切替
  ↓
探索モードへ変更
  ↓
フィルタを all に戻す
  ↓
applyFilters()
  ↓
指定座標へ flyTo
  ↓
marker を探す
  ↓
クラスタ内なら zoomToShowLayer
  ↓
ポップアップを開く
```

注意: 現状の `index.html` には `area-filter` と `date-filter` がないため、ここは直接 `.value` を触る行がエラー候補です。
日程カードクリックを触る時は最初に確認してください。

---

## 右側ズームスライダー

### `initZoomSlider()`

即時実行関数です。
`app.js` 読み込み時に、自動で右側に縦型ズームスライダーを追加します。

作るものは次です。

- `+` ボタン
- 縦型 range input
- `-` ボタン

Leaflet標準ズームを非表示にしているため、このUIがズーム操作の主役です。

---

## 右下メニュー

### `initMenuButton()`

即時実行関数です。
`app.js` 読み込み時に、右下に「メニュー」ボタンとパネルを作ります。

メニュー内の主な項目です。

| 項目 | 動き |
|---|---|
| ホーム画面に追加 | PWAでなければ表示。`showInstallGuide()` |
| 快適モード | `setMode('comfort')` |
| 探索モード | `setMode('explore')` |
| マニュアル | `docs/manual.html` を開く |
| FAQ | `docs/faq.html` を開く |
| かもちゃんに相談 | `chat.html` を別タブで開く |
| X/Facebook/LINE/コピー | サイト共有 |

`isPWA()` が true の場合、「ホーム画面に追加」は表示されません。

---

## PWA追加案内

### `showInstallGuide()`

ユーザーエージェントを見て、ブラウザ別にホーム画面追加の説明を出します。

対応している分岐は次です。

- LINEブラウザ
- iOS Safari
- iOS Chrome
- Android Chrome
- Android Firefox
- Edge
- その他

案内はJSでモーダルDOMを作って表示しています。

---

## Service Worker

`app.js` 内で以下を実行しています。

```js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
```

注意: `index.html` 末尾にも同じ登録処理があります。
大きな問題にはなりにくいですが、管理しやすさのためには将来的に1か所に寄せる候補です。

---

## かもちゃん

### `openKamo()`

下部ナビの「かもちゃん」ボタンから呼ばれます。

初回は `#kamo-panel` を作り、`chat.html` を iframe で表示します。
2回目以降は表示/非表示を切り替えます。

```text
openKamo()
  ↓
#kamo-panel がなければ作る
  ↓
iframe src="chat.html"
  ↓
bottom-kamo を active にする
```

`chat.html` 自体の会話ロジックは別ファイルです。

---

## 新着タブ

### `loadNewsTab()`

`switchTab('news')` から呼ばれます。

流れは次の通りです。

```text
#news を取得
  ↓
dataset.loaded === '1' なら何もしない
  ↓
読み込み中表示
  ↓
fetch('news.json?v=YYYYMMDD')
  ↓
events / pdfs / news を並べる
  ↓
カードHTMLを作る
  ↓
generated_at があれば最終更新を出す
  ↓
dataset.loaded = '1'
```

### カード生成関数

| 関数 | 内容 |
|---|---|
| `buildEventCard(ev)` | イベント・行事カード |
| `buildPdfCard(pdf)` | PDF資料カード |
| `buildNewsCard(n)` | RSSなどの新着カード |
| `formatNewsDate(dateStr)` | `YYYY-MM-DD` を `M/D` にする |
| `escapeHtml(str)` | HTMLエスケープ |

---

## 旧UI由来・整理候補

現状の `index.html` にはない要素を参照している箇所があります。
初めて触る人は、ここを「今動いているUI」と勘違いしないよう注意してください。

| 箇所 | 状態 |
|---|---|
| `area-filter` / `date-filter` | `applyFilters()` では安全に扱うが、`jumpToMarker()` では直接参照している |
| `share-copy`, `share-x`, `share-line`, `share-fb` | 旧シェアバー用。今の右下メニュー共有とは別 |
| `disclaimer-overlay` | 旧免責同意用。現在は `index.html` の `#splash-overlay` に統合済み |
| 末尾の `switchTab` 連携コメント | すでに `switchTab('news')` で `loadNewsTab()` を呼んでいる |
| Service Worker登録 | `index.html` と `app.js` の2か所にある |

---

## よくある変更と触る場所

| やりたいこと | 触る関数・場所 |
|---|---|
| ピンの色やサイズを変える | `getStyle(v)` |
| ピンの形を変える | `makeIcon(v)` |
| 今日/明日/明後日の判定を変える | `getDateLabel(next_date)` |
| ポップアップの文言やリンクを変える | `buildPopup(v)` |
| 要確認メッセージを変える | `buildPopup(v)` の `needs_verification` 部分 |
| 地図初期位置を変える | 1行目の `setView(...)` |
| 現在地ボタンを変える | `LocateControl` |
| 快適/探索モードの条件を変える | `setMode(mode)` / `applyFilters()` |
| 件数表示を変える | `applyFilters()` 後半 |
| 日程タブ切替を変える | `switchTab(tab)` |
| 新着タブを変える | `loadNewsTab()` とカード生成関数 |
| 右下メニューを変える | `initMenuButton()` |
| PWA追加案内を変える | `showInstallGuide()` |
| かもちゃん表示を変える | `openKamo()` |

---

## 作業時の注意

1. `app.js` は読み込み時に即実行されるので、`index.html` 側のDOMが先に必要です。
2. `buildPopup()` はユーザーが実際に見る案内なので、会場・日程の安全性を最優先してください。
3. `needs_verification` の警告表示は、迷ったら消さないでください。
4. `venues.json` のフィールド名を変える場合は、tyo側の生成スクリプトも確認が必要です。
5. `switchTab('schedule')` は `schedule.js` の `Schedule` に依存します。
6. 地図ピンを作り直す時は `window._markers` も再構築されます。
7. `jumpToMarker()` を直す場合は、日程タブから地図へ飛べるか必ず確認してください。
8. HTML文字列を組み立てる関数では、外部由来データのエスケープに注意してください。

---

## 初めて読む人向けの読み順

1. 1-48行: 地図初期化と現在地取得
2. 78-127行: 日付判定とピン生成
3. 128-283行: ポップアップ生成
4. 416-445行: `venues.json` 読み込み
5. 549-606行: `applyFilters()`
6. 332-365行: `switchTab()`
7. 944-1089行: 新着タブ
8. 698-872行: 右下メニュー

この順番で読むと、「データを読んで、ピンを作って、画面を切り替える」流れが掴みやすいです。

