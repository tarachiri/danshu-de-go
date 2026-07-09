# 断酒でGO!! 開発ガイド（ふーちゃんへ）

> 君はふーちゃん（Claude Code）。まじまじさんのコード実装担当。
> かもちゃん（チャット上のClaude）が設計・指示書を作り、君が実装する。
> まじまじさんがレビュー・承認・実行する。

---

## プロジェクト概要

**断酒でGO!!**（dansyu-go.nukadokonokai.com）
全国の断酒会例会場を地図で見えるようにするPWA。
理念：「日本全国の断酒会を一つに！心の連鎖握手」

- GitHubリポジトリ：`tarachiri/danshu-de-go`（フロントエンド）
- ツール類：`tarachiri/danshu-tools`（privateリポジトリ）
- 関連アプリ：`tarachiri/dansyu-gogo`（断酒でGO!!GO!!、例会情報の投稿・確認アプリ、開発中。GitHub Issuesを使っている数少ないリポジトリ）
- **AA（Alcoholics Anonymous）はスコープ外。断酒会のみ。**

---

## サーバー構成

| 名前 | 環境 | 役割 |
|------|------|------|
| `soi` | MacBook Pro 2015 | 開発環境・VSCode・ふーちゃん(Claude Code)稼働 |
| `tyo` | Ubuntu VPS（`maji@192.168.0.12`） | 本番・cron・SQLite DB |
| `gen` | `mini2014@192.168.0.22` | 断かもAPI（`/Users/mini2014/danshu-chat/main.py`をuvicorn port 8000で常駐）。Codexベースのふーちゃんも稼働 |

**soi = フロントエンド編集、tyo = バックエンド自動処理、gen = 断かもAPI（LINE/Web）**

`danshu-chat`（gen上）はgit管理外。**genが正**。編集前に必ずgenから最新版を取得し、
変更時は両マシンに`main.py.bak-YYYYMMDD-{変更内容}`を残すこと。

### 「ふーちゃん」呼称について

soi上のClaude Codeと、gen上のCodexベースのエージェントの**両方**が
自分自身を「ふーちゃん」と名乗っている。作業記録で区別したいときは
「ふーちゃん（Claude Code, soi）」「ふーちゃん（Codex, gen）」のように
機体を明記する。

---

## DB構成

**場所：** `/home/maji/danshu.db`（tyo上のSQLite）
**ツール：** `/home/maji/danshu-tools/`

### 主要テーブル

```sql
venues        -- 施設マスタ（1ピン=1会場）
meetings      -- 例会情報（venue_id FK）
schedule_exceptions  -- 例外スケジュール
national_sources     -- 全国データソース
meeting_types        -- 例会種別
org_hierarchy        -- 組織階層
```

### venuesの重要カラム

```sql
id, prefecture, group_name, facility_name, address,
latitude, longitude, is_hidden, needs_verification,
meeting_name  -- meetingsテーブル未対応の場合のフォールバック
```

### meetingsの重要カラム

```sql
id, venue_id, group_name, name,
day_of_week,    -- 月火水木金土日（1文字）
week_of_month,  -- "1,3" "2,4,5" 形式（カンマ区切り文字列）
start_time, end_time, audience, theme
```

---

## 絶対に守るルール

### 1. 絶対パス徹底
```bash
# NG
~/danshu.db
~/danshu-tools/

# OK
/home/maji/danshu.db
/home/maji/danshu-tools/
```

cronで`~/`展開が不安定になるため。

### 2. 必ずdry-run → 本番の順
```bash
python3 script.py --dry-run  # まず確認
python3 script.py            # 本番実行
```

### 3. GENERIC_NAMES除外
自動マッチングから除外する汎用名：
`例会` `懇談会` `家族会` `ミーティング` 等

### 4. UNIQUE制約の罠
`meetings(group_name, name, venue_id)`のUNIQUE制約。
venue_id更新前に旧レコード削除が必要な場合あり。

### 5. Python編集後は必ずgrep確認
空白・クォートの差異でサイレント失敗が起きやすい。

---

## cronスケジュール（tyo）

```
2:00  DBバックアップ
3:00  全都道府県コレクター（danshu_collector_v4.py）
3:25  generate_news.py + news.json push
4:00〜4:40  iCal更新（埼玉・東京新生会・多摩・千葉・神奈川・愛知・福岡・茨城・香川）
5:00  generate_map_v6.py + git push（venues.json・schedule.jsonを一括生成）
毎週月曜6:00  mirror更新（栃木スクレイプ）
毎月1日・16日  静岡・京都PDF
```

---

## iCal対応状況

| 都道府県 | スクリプト | 状況 |
|----------|-----------|------|
| 埼玉県 | `saitama_*_ical.py` | ✅ 稼働中 |
| 神奈川県 | `kanagawa_*_ical.py` | ✅ 稼働中 |
| 東京断酒新生会 | `tokyo_shinseikal_ical.py` / `tokyo_danshu_ical.py` | ✅ 稼働中（4:05 cron登録済み） |
| 東京多摩 | `tama_ical_common.py` | ✅ 稼働中 |
| 千葉県 | `chiba_ical_common.py` | ✅ 稼働中 |
| 福岡県 | `fukuoka_ical.py` | ✅ 稼働中 |
| 愛知県 | `aichi_ical_raw.py` → `aichi_match_venues.py`（venue照合） | ✅ 稼働中（未マッチ分あり、表記ゆれが主因） |

`tama_ical_common.py` / `kanagawa_ical_common.py` / `chiba_ical_common.py` /
`saitama_ical_common.py`の`find_venue_id()`は、正規化結果が4文字未満なら
マッチに使わないガードあり（2026-07-09、経堂地区会館→"会館"に潰れて誤マッチ
していたバグの修正。詳細: `docs/notes/2026-07-09_venue_matching_generic_word_bug.md`）。
`aichi_match_venues.py`は元から`MIN_MATCH_LEN=4`と`GENERIC_NAMES`除外を実装済みで対象外。

### Google Calendar接続済みID
```
千葉県断酒連合会：chibadanshu@gmail.com
東京多摩断酒連合：tamadanshu@gmail.com
東京断酒新生会：do1bbtappflu5bk424ma9nj4gs@group.calendar.google.com
```

---

## 都道府県別紐付き率（2026年7月10日現在、venues.jsonより算出）

```
埼玉県   venues:65   linked:65   100.0% ✅
千葉県   venues:25   linked:25   100.0% ✅
大阪府   venues:164  linked:159   97.0% ✅
東京都   venues:73   linked:65    89.0% ✅
京都府   venues:72   linked:59    81.9% ✅（6月時点32.6%から改善）
福岡県   venues:77   linked:61    79.2%
神奈川県 venues:44   linked:31    70.5% 🔄作業中
```

fallback会場（meetings未紐づき、`fallback_*`フィールドで表示）：全国109件
（6月時点177〜179件から減少）。

---

## フロントエンド構成

```
danshu-de-go/
├── index.html        メインマップ
├── manifest.json     PWA設定
├── style.css
├── js/
│   └── analytics.js
├── blog/
│   ├── index.html    開発ノート一覧
│   └── posts/        記事HTML（001.html〜）
└── docs/
    └── philosophy.md 開発哲学・AIへのメッセージ
```

**ブログ記事はHTMLで書く（markdownはスマホで表示されない）**

---

## 地図ライブラリ

- Leaflet.js + MarkerCluster
- GitHub Pages + Cloudflare CDN（gzip圧縮）
- venues.json：961KB → 86KB（gzip後）

---

## ジオコーディング

国土地理院（GSI）APIを使用：
```
https://msearch.gsi.go.jp/address-search/AddressSearch?q=住所
```

---

## データ品質の原則

1. **間違った場所への案内を最も警戒する**
2. 確認できないデータは`needs_verification=1`で明示
3. 本家公式サイトが真実（ソーバーねっとは土台）
4. 迷ったら全件作成して後から削除

---

## 次の主要タスク

1. 神奈川県 meetingsテーブル紐づけ率向上（現在70.5%）
2. 練馬断酒会独自iCal（`nerima.danshukai@gmail.com`）未着手
3. GOGO（`tarachiri/dansyu-gogo`）のサーバーDB化設計 — [Issue #1](https://github.com/tarachiri/dansyu-gogo/issues/1)がopen、設計論点(保存先/スキーマ/状態名/API/反映タイミング)が未決着
4. `popup.js`切り出し（`app.js`肥大化対策、未着手）
5. `.gitignore`整備（`memories.json`/`users.json`/`__pycache__/`等の個人情報系パターンが未追加）
6. JSON二重構造の解消（`venues_base.json`/`meetings_live.json`は試作済みだが`app.js`/`schedule.js`から未参照。`schedule.json`廃止も未実施）
7. fallback会場109件の解消（venue_id名寄せ）
8. venuesテーブル内の古い放置レコード棚卸し（day_of_week等が空のまま残る例：世田谷例会id=104、川崎例会id=163）

京都府紐づけ率向上・大阪府national_sources重複整理・東京iCalスクリプト作成は完了。

---

## かもちゃんのブログ（長期記憶）

URL: https://dansyu-go.nukadokonokai.com/blog/
ここを読めば今まで何をしてきたかわかる。

---

## 複数AI連携（docs/notes運用）

Claudeかもちゃん・Codexふーちゃん（gen）・ふーちゃん（Claude Code, soi）・まじまじさんが
同じ情報源を持つため、`docs/notes/YYYY-MM-DD-説明.md`を共通ホワイトボードとして使う。

- 調査・バグ修正・設計判断は`docs/notes/`に記録する
- 既存ファイルに関連する追加調査・別実装での同種修正を見つけたら**追記のみ**（上書き・削除しない、他エージェントの記述を消さない）
- 実装前に直近の`docs/notes/`を読む
- 本番に直接触った場合は、バックアップ名・変更ファイル・再起動方法・検証結果を残す
- 複数経路（`chat.html`／gen `main.py`／地図`app.js`など）にまたがる機能を直すときは、どの経路を確認・修正したか明記する（2026-07-09の「今日の例会」バグで全経路確認が漏れかけた教訓）
- このリポジトリ自体はGitHub Issuesを実質使っていない（`docs/notes/`が代わり）。ただし`tarachiri/dansyu-gogo`はGitHub Issuesを使っている
- 詳細ルール: `docs/notes/2026-07-09-ai-team-issue-workflow.md`

---

*最終更新: 2026年7月10日*

## エラーが起きたら
docs/architecture.md を読む


## セッション開始時
blog/posts/ の最新記事を1〜2件読んでから作業を始めること。
