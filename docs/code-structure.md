# 断酒でGO!! コード構造メモ

> フロントエンドリポジトリ `/Users/pro2015/danshu-de-go` の見取り図。
> サーバー・DB・cron の詳細は `docs/architecture.md` を参照。

最終確認: 2026-06-30

---

## 全体像

断酒でGO!! は、静的ファイルだけで動く PWA です。
地図・日程・新着・チャット導線を `index.html` から読み込み、毎朝 tyo 側で生成された JSON や HTML を GitHub Pages / Cloudflare CDN から配信します。

```text
index.html
  ├─ style.css
  ├─ schedule.js
  ├─ app.js
  ├─ venues.json
  ├─ schedule.json
  ├─ news.json
  ├─ qa.json
  └─ chat.html
```

主な外部ライブラリは Leaflet.js と Leaflet MarkerCluster です。

---

## 主要ファイル

| ファイル | 役割 | 手編集/生成 |
|---|---|---|
| `index.html` | メインアプリのHTML。スプラッシュ、ヘッダー、凡例、下部ナビ、地図/日程/新着コンテナを定義 | 手編集 |
| `style.css` | メインアプリの共通スタイル。地図ポップアップ、下部ナビ、新着タブなど | 手編集 |
| `app.js` | 地図、ピン、ポップアップ、タブ切替、メニュー、PWA導線、新着表示の中心ロジック | 手編集 |
| `schedule.js` | 日程タブ専用ロジック。都道府県フィルタ、近隣都道府県表示、日付別カード生成 | 手編集 |
| `chat.html` | かもちゃんWebチャット画面。決定木とAPIチャットを併用 | 手編集 |
| `js/analytics.js` | Google Analytics 初期化 | 手編集 |
| `sw.js` | Service Worker。現状は同一オリジンリクエストを通常fetchする軽量版 | 手編集 |
| `manifest.json` | PWA名、テーマ色、アイコン、起動URL | 手編集 |
| `venues.json` | 地図ピン・会場・例会情報。`app.js` が読む | tyo生成 |
| `schedule.json` | 日程タブ用の開催予定リスト。`schedule.js` が読む | tyo生成 |
| `news.json` | 新着タブ用のお知らせ、イベント、PDF、RSS情報 | tyo生成 |
| `qa.json` | `chat.html` の決定木ノード | 手編集/半生成 |
| `sitemap.xml` | 検索エンジン向けサイトマップ | tyo生成 |

---

## 画面構成

### メインアプリ

`index.html` が最初に表示される画面です。

- `#splash-overlay`: 起動時のローディングと免責同意
- `#header`: アプリタイトルと総例会数
- `#legend`: 今日・明日・明後日の件数表示
- `#bottom-nav`: マップ、日程、新着、かもちゃんの下部ナビ
- `#map`: Leaflet地図
- `#schedule`: 日程タブ
- `#news`: 新着タブ
- `#footer`: 更新日と開発ノート導線

読み込み順は `schedule.js` → `app.js` です。
`app.js` から `Schedule.render()` を呼ぶため、この順序を崩さないこと。

### 地図タブ

中心ロジックは `app.js` です。

- `L.map(...)`: Leaflet地図を初期化
- `initVenues()`: `venues.json` を取得
- `applyFilters()`: 表示対象のピンを再構築
- `makeIcon(v)`: 今日/明日/明後日/その他でピンの見た目を決める
- `buildPopup(v)`: 施設・例会カード・公式サイト・経路リンクを作る
- `jumpToMarker(...)`: 日程タブから地図ピンへ移動

地図には2つの表示モードがあります。

| モード | 内容 |
|---|---|
| 快適モード | 今日・明日・明後日など、直近の開催予定があるピンを中心に表示 |
| 探索モード | 条件を広げて全体探索しやすくする |

### 日程タブ

中心ロジックは `schedule.js` の `Schedule` オブジェクトです。

- `Schedule.setFilter(pref)`: GPS逆ジオコーディングやセレクトから都道府県をセット
- `Schedule.render()`: フィルターバーとリストを描画
- `Schedule._renderAll(data, listEl)`: 自都道府県と近隣都道府県を分けて表示
- `Schedule._buildDateHtml(data)`: 日付ごとの見出しとカードを生成
- `Schedule._buildCard(e)`: 1例会分のカードを生成

`app.js` 側の GPS 成功時に GSI 逆ジオコーディングを使い、都道府県を推定して `Schedule.setFilter(pref)` を呼びます。

### 新着タブ

中心ロジックは `app.js` 末尾の新着タブ関連関数です。

- `loadNewsTab()`: `news.json` を読み込み、1回だけ描画
- `buildEventCard(ev)`: イベント・行事カード
- `buildPdfCard(pdf)`: PDF資料カード
- `buildNewsCard(n)`: RSSなどのニュースカード
- `formatNewsDate(dateStr)`: 表示用日付
- `escapeHtml(str)`: HTMLエスケープ

### かもちゃん

`chat.html` は単独ページとしても、メインアプリ内の iframe としても使われます。

- `qa.json`: 決定木の会話フロー
- `venues.json`: ローカル検索用の会場・例会データ
- `https://chat.nukadokonokai.com/chat`: AIチャットAPI
- GPS取得に成功すると、近い例会検索やAPIへの位置情報送信に使う

メインアプリの「かもちゃん」ボタンは `app.js` の `openKamo()` で `chat.html` を iframe 表示します。

---

## データの流れ

```text
tyo /home/maji/danshu.db
  ↓ generate_map_v6.py など
venues.json
schedule.json
news.json
sitemap.xml
  ↓ git push
GitHub Pages / Cloudflare
  ↓
index.html + app.js + schedule.js
```

このリポジトリ側では主に「表示」を担当します。
DB更新、収集、iCal、JSON生成の本体は tyo の `/home/maji/danshu-tools/` 側です。

---

## JSONの利用先

| JSON | 読む場所 | 主な用途 |
|---|---|---|
| `venues.json` | `app.js`, `chat.html` | 地図ピン、ポップアップ、会場検索、件数カウント |
| `schedule.json` | `schedule.js` | 日程タブの例会一覧 |
| `news.json` | `app.js` | 新着タブのイベント、PDF、ニュース |
| `qa.json` | `chat.html` | かもちゃん決定木 |

`venues.json` は地図の中心データです。
ピン表示では `lat/lng` を使い、ポップアップでは `meetings` 配列があれば meetings を優先し、なければフォールバック項目を使います。

---

## 地域ページ

`chiiki/` 配下は全国の地域・都道府県・団体ページです。

```text
chiiki/
  ├─ index.html
  ├─ chiiki.css
  ├─ kanto/index.html
  ├─ kanto/tokyo/index.html
  └─ kanto/tokyo/org-xxx/index.html
```

階層はおおむね次の通りです。

| 階層 | 内容 |
|---|---|
| `chiiki/index.html` | 地域ページ入口 |
| `chiiki/{region}/index.html` | 地方別ページ |
| `chiiki/{region}/{pref}/index.html` | 都道府県別ページ |
| `chiiki/{region}/{pref}/org-{id}/index.html` | 団体別プチHP |

`docs/architecture.md` によると、生成元は tyo 側の `generate_chiiki_pages_v3.py` です。
505団体ページにLINE問い合わせボタンが設置済みです。

---

## ブログ

`blog/` は開発ノートです。

```text
blog/
  ├─ index.html
  ├─ post.html
  └─ posts/
      ├─ 001.html
      ├─ ...
      └─ 2026-06-29-line-kamo.html
```

現行ルールでは、ブログ記事はスマホ表示を考えてHTMLで書きます。
`blog/post.html` はMarkdown記事用のビューアですが、通常の新規記事は `blog/posts/*.html` を使います。

---

## ドキュメント

| ファイル | 内容 |
|---|---|
| `docs/architecture.md` | サーバー、DB、cron、iCal、LINE連携を含む運用アーキテクチャ |
| `docs/philosophy.md` | 開発思想・AI向けメッセージ |
| `docs/manual.html` | 利用者向けマニュアル |
| `docs/manual-kanjisan.html` | 幹事さん向けマニュアル |
| `docs/manual-rengokai.html` | 連合会向けマニュアル |
| `docs/faq.html` | FAQ |
| `docs/notes/` | 作業メモ |
| `docs/code-structure.md` | このファイル。フロントエンドコード構造 |

---

## PWAまわり

- `manifest.json`: ホーム画面追加時の名前、アイコン、テーマ色
- `icon-192.png`, `icon-512.png`: PWAアイコン
- `sw.js`: Service Worker
- `app.js`: ブラウザ別の「ホーム画面に追加」案内を表示

`sw.js` は外部ドメインを処理せず、同一オリジンだけ通常fetchします。
強いキャッシュ戦略はまだ入っていません。

---

## 編集時の注意

1. `schedule.js` は `app.js` より先に読み込む。
2. `venues.json`, `schedule.json`, `news.json`, `sitemap.xml`, `chiiki/` 配下の大量HTMLは生成物として扱う。
3. `app.js` は機能が集中しているため、日程系は `schedule.js` へ寄せる方針。
4. 表示上の安全性では「間違った場所へ案内しない」を最優先する。
5. `needs_verification=1` の会場はポップアップで確認注意を出す。
6. AAはスコープ外。断酒会のみ扱う。
7. エラーが起きたらまず `docs/architecture.md` を読む。

---

## ざっくり修正ガイド

| やりたいこと | 触る場所 |
|---|---|
| 地図ピンの色・サイズを変える | `app.js` の `getStyle()` / `makeIcon()` |
| ポップアップ内容を変える | `app.js` の `buildPopup()` |
| 日程タブの並びや表示を変える | `schedule.js` |
| 新着タブのカード表示を変える | `app.js` の `loadNewsTab()` 周辺 |
| 下部ナビや画面コンテナを変える | `index.html` と `style.css` |
| かもちゃんWebチャットを変える | `chat.html` と `qa.json` |
| 地域ページの見た目を変える | `chiiki/chiiki.css` |
| 地域ページの構造を変える | tyo 側の `generate_chiiki_pages_v3.py` |
| PWA名・アイコンを変える | `manifest.json`, `icon-*.png` |
| 解析タグを変える | `js/analytics.js`, `index.html` |

