# 2026-06-30 作業ログ: app.js分割とデータ分離試作

> 断酒でGO!! フロントエンド整理作業の引き継ぎメモ。
> 目的は、初めて触る人でも `index.html` / `app.js` の流れを追いやすくし、今後の `venues` / `meetings` 分離に備えること。

---

## 今日の目的

`app.js` が大きくなっていたため、安全に戻せる単位で機能ごとに切り出した。

進め方は以下の方針。

```text
1機能だけ切り出す
  ↓
構文チェック・簡易動作確認
  ↓
1コミット
  ↓
push
```

この進め方により、問題が出てもコミット単位で戻しやすい。

---

## 作成した説明ドキュメント

以下のMarkdownを追加した。

| ファイル | 内容 |
|---|---|
| `docs/code-structure.md` | リポジトリ全体のコード構造メモ |
| `docs/index-load-flow.md` | `index.html` が何をどの順番で読み込むかの引き継ぎ書 |
| `docs/app-js-guide.md` | `app.js` の機能別説明書 |
| `docs/notes/2026-06-30-js-split-worklog.md` | この作業ログ |

注意: これらのドキュメントは作業時点では未追跡だったため、必要なら別コミットでまとめる。

---

## JSON分離の試作

今の `venues.json` は、会場情報と例会情報が混ざっている。

今後の理想は以下。

```text
venues_base.json
  会場台帳
  施設名、住所、緯度経度、都道府県、公式URLなど
  ほぼ固定なので長めにキャッシュしやすい

meetings_live.json
  例会、日程、例外、中止、次回開催日など
  変動しやすいので毎回または短時間キャッシュ

ブラウザ側
  venue_id で合体
  現行の venue.meetings 形式に戻して表示
```

試作として以下を生成した。

| ファイル | 内容 | サイズ |
|---|---|---:|
| `venues.json` | 現行の合体済みデータ | 1,563,561 bytes |
| `venues_base.json` | 会場固定情報 | 411,216 bytes |
| `meetings_live.json` | meetings と venue_states | 836,672 bytes |

確認結果:

```text
会場数: 1394 → 1394
meeting数: 1700 → 1700
next_dateあり会場: 995 → 995
主要フィールド差分: 0
```

`meetings_live.json` には `meetings` だけでなく `venue_states` も入れた。
理由は、現行 `app.js` が `v.next_date`, `v.fallback_next_date`, `v.has_exception` など会場代表の日程状態を見ているため。

注意: この試作JSONはまだアプリ本体へ接続していない。

---

## JS切り出し 1: 新着タブ

コミット:

```text
b94d656 Split news tab code from app
```

変更内容:

| ファイル | 内容 |
|---|---|
| `js/news-tab.js` | `loadNewsTab()`, `buildEventCard()`, `buildPdfCard()`, `buildNewsCard()` などを移動 |
| `app.js` | 新着タブ関連の関数を削除 |
| `index.html` | `js/news-tab.js` を `app.js` より前に読み込み |

読み込み順:

```html
<script src="schedule.js"></script>
<script src="js/news-tab.js"></script>
<script src="app.js"></script>
```

確認:

- `app.js` / `js/news-tab.js` の構文チェックOK
- `news.json` を使った単体実行でHTML生成OK
- `#news.dataset.loaded = "1"` 設定OK

---

## JS切り出し 2: かもちゃんタブ挙動統一

コミット:

```text
aa716ca Unify Kamo bottom tab behavior
```

変更前:

```text
マップ    → switchTab('map')
日程      → switchTab('schedule')
新着      → switchTab('news')
かもちゃん → openKamo()
```

変更後:

```text
マップ    → switchTab('map')
日程      → switchTab('schedule')
新着      → switchTab('news')
かもちゃん → switchTab('kamo')
```

変更内容:

| ファイル | 内容 |
|---|---|
| `index.html` | `#kamo` コンテナを追加し、ボタンを `switchTab('kamo')` に変更 |
| `app.js` | `switchTab()` に `kamo` ケースを追加 |

`openKamo()` は iframe を初回だけ作る役に縮小した。

確認:

- JS構文チェックOK
- `git diff --check` OK

---

## JS切り出し 3: 右下メニュー

コミット:

```text
4d89625 Split menu code from app
```

変更内容:

| ファイル | 内容 |
|---|---|
| `js/menu.js` | 右下メニュー、PWA追加案内、共有機能を移動 |
| `app.js` | メニュー/PWA/共有まわりを削除 |
| `index.html` | `js/menu.js` を `app.js` の後に読み込み |

読み込み順:

```html
<script src="schedule.js"></script>
<script src="js/news-tab.js"></script>
<script src="app.js"></script>
<script src="js/menu.js"></script>
```

`menu.js` を `app.js` の後にした理由:

```text
menu.js 内の快適モード/探索モードボタン
  ↓
setMode('comfort') / setMode('explore') を呼ぶ
  ↓
setMode() は app.js 側に残している
```

確認:

- `app.js`, `js/menu.js`, `js/news-tab.js` の構文チェックOK
- `git diff --check` OK
- 簡易DOMモックで `menu-panel` と `menu-toggle-float` 作成確認OK

---

## app.js の行数変化

作業後の目安:

```text
app.js          637行
js/news-tab.js 147行
js/menu.js     299行
```

最初の `app.js` は約1098行だったため、かなり見通しが良くなった。

---

## バックアップ

切り出しごとにローカルバックアップを作成した。
`.gitignore` に `*.bak*` があるため、コミット対象には入らない。

作成済み:

```text
app.js.bak-20260630-news-split
app.js.bak-20260630-kamo-tab
index.html.bak-20260630-kamo-tab
app.js.bak-20260630-menu-split
index.html.bak-20260630-menu-split
```

---

## 未追跡で残っているもの

作業時点で未追跡として残っていたもの:

```text
AGENTS.md
docs/app-js-guide.md
docs/code-structure.md
docs/index-load-flow.md
docs/notes/2026-06-30-js-split-worklog.md
meetings_live.json
venues_base.json
```

必要なら次に以下のように分けてコミットすると良い。

```text
docs: add frontend handoff notes
prototype: add split venue and meeting json samples
```

---

## 次におすすめの作業

次の安全な切り出し候補は `popup.js`。

対象:

```text
buildPopup(v)
formatDate(d)
```

ただし `buildPopup(v)` は地図上でユーザーが実際に見る案内の中心なので、メニューより慎重に扱う。

おすすめ手順:

```text
1. app.js と index.html のバックアップ作成
2. js/popup.js を追加
3. buildPopup() と formatDate() を移動
4. index.html で app.js より前に js/popup.js を読み込む
5. 構文チェック
6. 代表会場のポップアップHTMLを簡易検証
7. 1コミット
8. push
```

読み込み順の想定:

```html
<script src="schedule.js"></script>
<script src="js/news-tab.js"></script>
<script src="js/popup.js"></script>
<script src="app.js"></script>
<script src="js/menu.js"></script>
```

---

## 注意点

- `setMode()` は地図レイヤーと `applyFilters()` に依存するため、まだ `app.js` に残す。
- `menu.js` は `setMode()` を呼ぶため、`app.js` の後に読む。
- `news-tab.js` は `app.js` の `switchTab('news')` から呼ばれるため、`app.js` より前に読む。
- `Schedule.render()` は `schedule.js` にあるため、`schedule.js` は引き続き `app.js` より前に読む。
- `venues_base.json` / `meetings_live.json` はまだ試作。現行表示は `venues.json` のまま。

