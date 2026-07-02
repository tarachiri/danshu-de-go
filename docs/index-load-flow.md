# index.html 引き継ぎ書

> 初めて作業する人が、`index.html` が何をどの順番で呼び出しているかを把握するための説明書。
> 全体のコード構造は `docs/code-structure.md`、サーバー・DB・cron は `docs/architecture.md` を参照。

最終確認: 2026-06-30

---

## まず結論

`index.html` は、断酒でGO!! のメイン画面を作る入口ファイルです。

役割は大きく4つです。

1. SEO/PWA/外部ライブラリを読み込む
2. 起動時スプラッシュと免責同意を表示する
3. 地図・日程・新着・かもちゃん用の画面の器を置く
4. 最後に `schedule.js` と `app.js` を読み込んでアプリを起動する

実際の動きの中心は `app.js` です。
`index.html` は「画面の骨組み」と「読み込み順の管理」を担当しています。

---

## 読み込み順の全体図

```text
1. head
   ├─ manifest.json
   ├─ icon-192.png
   ├─ Leaflet CSS
   ├─ MarkerCluster CSS
   ├─ Leaflet JS
   ├─ MarkerCluster JS
   ├─ style.css
   ├─ Google Analytics gtag.js
   └─ js/analytics.js

2. body 前半
   ├─ #splash-overlay
   ├─ QRCode.js
   └─ インラインJS
       ├─ QRコード生成
       ├─ window.setSplashProgress()
       ├─ splashAgree()
       └─ splashClose()

3. body 後半
   ├─ #header
   ├─ #legend
   ├─ #bottom-nav
   ├─ #map
   ├─ #schedule
   ├─ #news
   └─ #footer

4. body 最後
   ├─ schedule.js
   ├─ app.js
   ├─ Service Worker 登録
   └─ status banner.js
```

この順番が大事です。
特に `Leaflet JS` → `schedule.js` → `app.js` の順番は崩さないでください。

---

## headで呼んでいるもの

### SEO・SNS・PWA情報

`head` では、検索エンジン、SNS共有、PWAに必要なメタ情報を定義しています。

| 要素 | 役割 |
|---|---|
| `google-site-verification` | Google Search Console の所有確認 |
| `meta description` | 検索結果に出る説明文 |
| `meta keywords` | キーワード情報 |
| `og:title`, `og:description`, `og:url`, `og:type` | SNS共有時の表示情報 |
| `title` | ブラウザタブと検索結果のタイトル |
| `manifest.json` | PWA設定 |
| `apple-mobile-web-app-*` | iPhoneホーム画面追加時の設定 |
| `icon-192.png` | iPhone/Android向けアイコン |

### 外部CSS

```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"/>
```

Leaflet地図とクラスタ表示の見た目に必要です。
これがないと、地図やクラスタの表示が崩れます。

### 外部JS

```html
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
```

`app.js` の先頭で `L.map(...)` を呼びます。
そのため、この2つは必ず `app.js` より前に必要です。

### アプリCSS

```html
<link rel="stylesheet" href="style.css">
```

メイン画面全体、地図ポップアップ、下部ナビ、日程タブ、新着タブの見た目を担当します。

### Google Analytics

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-B1YCK7W6XG"></script>
<script src="js/analytics.js"></script>
```

`gtag.js` を外部から読み込み、`js/analytics.js` で初期化しています。

---

## スプラッシュ画面

`body` の最初に `#splash-overlay` があります。
これは起動時のローディング画面と免責同意を兼ねています。

### 主な要素

| id/class | 役割 |
|---|---|
| `#splash-overlay` | 画面全体を覆う起動画面 |
| `#sp-status` | 「地図を初期化中...」などの状態表示 |
| `#sp-progress-bar` | 読み込み進捗バー |
| `#sp-percent` | 進捗パーセント |
| `#sp-qr-canvas` | サイトURLのQRコード |
| `#sp-agree-area` | 読み込み完了後に出る免責同意エリア |

### スプラッシュ内のインラインCSS

`#splash-overlay` の中に `<style>` が入っています。
このスタイルはスプラッシュ専用です。

通常のアプリ画面のCSSは `style.css` 側ですが、スプラッシュだけは初期表示を安定させるため `index.html` 内に直接あります。

---

## スプラッシュ用JS

スプラッシュ直後に QRCode.js とインラインJSがあります。

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>
  ...
</script>
```

### QRコード生成

最初の即時実行関数で、`https://dansyu-go.nukadokonokai.com/` のQRコードを作ります。

流れはこうです。

```text
隠しdivを作る
  ↓
QRCode.jsでcanvasを生成
  ↓
#sp-qr-canvas に描画する
  ↓
隠しdivを削除
```

### window.setSplashProgress()

```js
window.setSplashProgress = function(percent, statusText) { ... }
```

これは `app.js` から呼ばれます。

`app.js` 側の主な呼び出しは以下です。

| 進捗 | 表示文 | 呼び出しタイミング |
|---|---|---|
| 10% | 地図を初期化中... | `app.js` 読み込み直後 |
| 30% | 例会情報を取得中... | `venues.json` 取得開始 |
| 80% | データを解析中... | `venues.json` 取得後 |
| 100% | 準備完了！ | 地図ピン描画後 |
| 100% | 読み込み失敗 | `venues.json` 取得失敗時 |

100%になると `#sp-agree-area` に `visible` クラスが付き、同意ボタンが表示されます。

### splashAgree()

同意ボタンから呼ばれます。

```text
今日の日付を localStorage.disclaimer_agreed に保存
  ↓
splashClose() を呼ぶ
```

現在の実装では、保存はしていますが、コメント通り毎回同意ボタンを表示する挙動です。

### splashClose()

`#splash-overlay` に `fade-out` クラスを付け、600ms後にDOMから削除します。

---

## 画面の器

スプラッシュの後に、アプリ本体のDOMが並びます。
ここは `app.js` と `schedule.js` が後から操作するため、idを変えると壊れる場所があります。

### #header

```html
<div id="header">
  <div id="top-bar">
    <span id="title">...</span>
    <span id="total-count">
      全<span id="count-total-header">0</span>例会・今日<span id="count-today-header">0</span>件
    </span>
  </div>
</div>
```

`app.js` が `count-total-header` と `count-today-header` を更新します。

### #legend

```html
<span id="count-today">0</span>
<span id="count-tomorrow">0</span>
<span id="count-dayafter">0</span>
```

`app.js` の `applyFilters()` が、今日・明日・明後日の件数を入れます。

### #bottom-nav

4つのボタンがあります。

| ボタン | onclick | 呼び出し先 |
|---|---|---|
| マップ | `switchTab('map')` | `app.js` |
| 日程 | `switchTab('schedule')` | `app.js` → `Schedule.render()` |
| 新着 | `switchTab('news')` | `app.js` → `loadNewsTab()` |
| かもちゃん | `openKamo()` | `app.js` |

`switchTab()` と `openKamo()` は `app.js` 読み込み後に使えるようになります。
ボタンを押す頃には `app.js` が読み込み済みなので問題ありません。

### #map

Leaflet地図の描画先です。

`app.js` の先頭で以下のように使われます。

```js
const map = window._leafletMap = L.map("map", {zoomControl: false}).setView([35.68, 139.60], 9);
```

このため、`#map` は `app.js` より前に存在している必要があります。

### #schedule

日程タブの描画先です。

`schedule.js` の `Schedule.render()` が中身を作ります。
初期状態では空です。

### #news

新着タブの描画先です。

初期状態では `display:none` です。
新着タブを押すと `app.js` の `loadNewsTab()` が `news.json` を読み込んで中身を作ります。

### #footer

開発ノートへのリンクと更新日表示があります。

`app.js` の `initVenues()` が `venues.json` の `Last-Modified` ヘッダーを見て、`#footer-updated` に更新日を入れます。

---

## 最後に読むJS

`index.html` の最後で、アプリ本体のJSを読み込みます。

```html
<script src="schedule.js"></script>
<script src="app.js"></script>
```

### schedule.jsを先に読む理由

`app.js` の `switchTab('schedule')` 内で `Schedule.render()` を呼びます。
そのため、`Schedule` オブジェクトを定義する `schedule.js` が先です。

順番を逆にすると、日程タブで `Schedule is not defined` になります。

### app.js読み込み時にすぐ起きること

`app.js` は読み込まれた時点で、かなり多くの初期化を実行します。

```text
1. Leaflet地図を #map に作る
2. 現在地取得を試みる
3. GSI逆ジオコーディングの locationfound ハンドラを登録
4. 現在地ボタンを追加
5. スプラッシュ進捗を10%にする
6. OSMタイルを追加
7. clusterGroup / comfortGroup を作る
8. initVenues() を実行する
9. venues.json を取得する
10. applyFilters() でピンを描画する
11. スプラッシュ進捗を100%にする
12. ズームスライダーを追加する
13. メニューボタンを追加する
14. Service Worker を登録する
15. シェアバー関数を初期化する
```

つまり `app.js` は「関数定義ファイル」ではなく「読み込んだら起動するファイル」です。
画面の器が先に必要な理由はここにあります。

---

## データ取得の順番

### 初期表示で読むデータ

初期表示で必ず読むのは `venues.json` です。

```text
app.js
  ↓
initVenues()
  ↓
fetch('venues.json?v=' + Date.now())
  ↓
VENUES = data
  ↓
applyFilters()
  ↓
地図ピン描画・件数更新
```

`venues.json` が取れないと、地図ピンと件数が表示できません。
失敗時はスプラッシュに「読み込み失敗」と出し、スプラッシュをクリックすると再読み込みする動きです。

### 日程タブを開いた時に読むデータ

日程タブを初めて開いた時に `schedule.json` を読みます。

```text
日程ボタン
  ↓
switchTab('schedule')
  ↓
Schedule.render()
  ↓
fetch('schedule.json?v=' + Date.now())
  ↓
日程一覧を描画
```

`Schedule._data` にキャッシュするので、同じ画面内では再利用します。

### 新着タブを開いた時に読むデータ

新着タブを初めて開いた時に `news.json` を読みます。

```text
新着ボタン
  ↓
switchTab('news')
  ↓
loadNewsTab()
  ↓
fetch('news.json?v=YYYYMMDD')
  ↓
イベント・PDF・ニュースを描画
```

`#news` に `data-loaded="1"` を付けるため、2回目以降は再取得しません。

### かもちゃんを開いた時に読むもの

かもちゃんボタンを押すと、`app.js` が `chat.html` を iframe で表示します。

```text
かもちゃんボタン
  ↓
openKamo()
  ↓
iframe src="chat.html"
  ↓
chat.html 側で qa.json と venues.json を読む
  ↓
必要に応じて https://chat.nukadokonokai.com/chat に送る
```

---

## 外部サービス呼び出し

`index.html` とその読み込み先から使う外部サービスです。

| 呼び出し先 | 呼ぶ場所 | 用途 |
|---|---|---|
| `unpkg.com` | `index.html` | Leaflet / MarkerCluster |
| `googletagmanager.com` | `index.html` | Google Analytics |
| `cdnjs.cloudflare.com` | `index.html` | QRCode.js |
| `tile.openstreetmap.org` | `app.js` | 地図タイル |
| `mreversegeocoder.gsi.go.jp` | `app.js` | 現在地から都道府県を推定 |
| `tarachiri.github.io/danshu-status/banner.js` | `index.html` | ステータスバナー |
| `chat.nukadokonokai.com` | `chat.html` | かもちゃんAIチャット |

---

## id依存表

`index.html` のidは、JSから直接参照されています。
変更するときは呼び出し元も一緒に直してください。

| id | 使うJS | 用途 |
|---|---|---|
| `splash-overlay` | `index.html`, `app.js` | 起動画面の表示・削除 |
| `sp-status` | `index.html` | スプラッシュ状態文 |
| `sp-progress-bar` | `index.html` | 進捗バー |
| `sp-percent` | `index.html` | 進捗パーセント |
| `sp-qr-canvas` | `index.html` | QRコード描画 |
| `sp-agree-area` | `index.html` | 同意ボタン表示 |
| `count-total-header` | `app.js` | ヘッダー総例会数 |
| `count-today-header` | `app.js` | ヘッダー今日件数 |
| `count-today` | `app.js` | 凡例の今日件数 |
| `count-tomorrow` | `app.js` | 凡例の明日件数 |
| `count-dayafter` | `app.js` | 凡例の明後日件数 |
| `tab-map` | `app.js` | マップタブのactive切替 |
| `tab-schedule` | `app.js` | 日程タブのactive切替 |
| `tab-news` | `app.js` | 新着タブのactive切替 |
| `bottom-kamo` | `app.js` | かもちゃんタブのactive切替 |
| `map` | `app.js` | Leaflet地図の描画先 |
| `schedule` | `schedule.js`, `app.js` | 日程タブの描画先 |
| `news` | `app.js` | 新着タブの描画先 |
| `footer-updated` | `app.js` | データ更新日の表示 |

---

## 現状残っている古い参照

`app.js` には、現在の `index.html` には存在しないidへの参照が一部残っています。
多くは過去のUIや将来用の名残です。

| id | 参照箇所 | 現状 |
|---|---|---|
| `area-filter` | `jumpToMarker()`, `applyFilters()` | `index.html` には存在しない。`applyFilters()` は optional chaining なので通常は問題なし。ただし `jumpToMarker()` では直接 `.value` を触るため、日程カードクリック時に注意 |
| `date-filter` | `jumpToMarker()`, `applyFilters()` | 同上 |
| `share-copy` | `copyShareUrl()` | 現在の `index.html` には存在しない |
| `share-x` | `openShareBar()` | 現在の `index.html` には存在しない |
| `share-line` | `openShareBar()` | 現在の `index.html` には存在しない |
| `share-fb` | `openShareBar()` | 現在の `index.html` には存在しない |
| `disclaimer-overlay` | `showDisclaimerIfNeeded()`, `agreeDisclaimer()` | 現在は `#splash-overlay` 側に統合済み |

初めて作業する人は、これらを「いま表示されているUI」だと思わないよう注意してください。
整理するなら、削除するか、今のUIに合わせて実装し直す候補です。

---

## Service Worker登録について

現在、Service Worker登録が2か所にあります。

1. `index.html` の末尾
2. `app.js` の末尾付近

どちらも `navigator.serviceWorker.register('sw.js')` を呼びます。
通常は大きな問題にはなりにくいですが、管理しやすくするなら将来的に1か所へ寄せると読みやすいです。

---

## よくある変更と触る場所

| 変更したいこと | 主に触る場所 | 注意 |
|---|---|---|
| アプリタイトルや説明文を変える | `index.html` head / `#header` | SEO文言と画面文言は別 |
| スプラッシュの文言を変える | `index.html` の `#splash-overlay` | インラインCSS/JS内にまとまっている |
| 読み込み進捗の文言を変える | `app.js` の `setSplashProgress` 呼び出し | 表示関数本体は `index.html` |
| 下部ナビを増やす | `index.html` の `#bottom-nav` と `app.js` の `switchTab()` | 表示先コンテナも必要 |
| 地図表示を変える | `app.js` | `#map` は消さない |
| 日程タブを変える | `schedule.js` | `schedule.js` は `app.js` より先に読む |
| 新着タブを変える | `app.js` の `loadNewsTab()` 周辺 | `news.json` の形式も確認 |
| かもちゃん導線を変える | `app.js` の `openKamo()` と `chat.html` | iframe表示か別ページ遷移かを決める |
| PWA設定を変える | `manifest.json`, `index.html`, `sw.js` | iOS用metaも忘れず確認 |
| アクセス解析を変える | `index.html`, `js/analytics.js` | GA IDは両方見る |

---

## 触る前のチェックリスト

1. `index.html` のidを変えるなら、`app.js` と `schedule.js` で同じidを検索する。
2. `script` の順番を変えるなら、`Leaflet`、`Schedule`、`window.setSplashProgress` の依存関係を見る。
3. `venues.json` が読めない状態でも、スプラッシュが閉じられるか確認する。
4. 日程タブを触ったら、日程カードクリックで地図に飛べるか確認する。
5. 新着タブを触ったら、`news.json` が空の場合と取得失敗の場合も確認する。
6. かもちゃん導線を触ったら、iframe表示と `chat.html` 単独表示の両方を確認する。
7. 本番データの安全性では、日程・会場変更の可能性を必ず目立つ形で残す。

---

## 迷ったときの読み順

初めての人は、この順番で読むと迷いにくいです。

1. `docs/index-load-flow.md`
2. `docs/code-structure.md`
3. `index.html`
4. `app.js` の先頭から `initVenues()` まで
5. `schedule.js`
6. `app.js` の `switchTab()` と `loadNewsTab()`
7. `chat.html`
8. `docs/architecture.md`

