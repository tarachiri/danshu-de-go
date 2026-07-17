# 断酒でGO!! 開発ガイド（AIさんたちへ）

> 君はふーちゃん（Codex）。まじまじさんのコード実装担当。
> かもちゃん（チャット上のClaude）が設計・指示書を作り、君が実装する。
> まじまじさんがレビュー・承認・実行する。

---

## プロジェクト概要

**断酒でGO!!**（dansyu-go.nukadokonokai.com）
全国の断酒会例会場を地図で見えるようにするPWA。
理念：「日本全国の断酒会を一つに！心の連鎖握手」
アルコホーリクス・アノニマス（AA）は別団体のためスコープ外。
全日本断酒連盟加盟の断酒会の例会を第一優先で収集している。

- GitHubリポジトリ：`tarachiri/danshu-de-go`（フロントエンド）
- ツール類：`tarachiri/danshu-tools`（privateリポジトリ）
- **AA（Alcoholics Anonymous）はスコープ外。断酒会のみ。**

---

## AIチーム構成

- **かもちゃん**（Claude Sonnet、Claude.aiチャット）：設計・診断・会話・指示書作成担当
- **ふーちゃん**（Claude Code on soi）：フロントエンド実装担当（danshu-de-go）
- **チャッピー**（Codex、on tyo/danshu-tools）：バックエンドスクリプト・DB作業担当
- **断かも**（Claude Haiku on gen）：断酒でGO!!チャット・LINE公式アカウント対応
- **ぬかちゃん**（Claude Haiku on gen）：ぬか床の会チャット（別プロジェクト）

---

## サーバー構成

| 名前 | 環境 | 役割 |
|------|------|------|
| `soi` | MacBook Pro 2015 | 開発環境・VSCode・ふーちゃん稼働 |
| `tyo` | Ubuntu VPS（`maji@192.168.0.12`） | 本番・cron・SQLite DB |
| `gen` | Mac mini 2014 | 断かもFastAPI・Ollama稼働 |

**soi = フロントエンド編集、tyo = バックエンド自動処理・本番DB、gen = LLM/チャット系**

---

## リポジトリの使い分け（重要）

作業対象に応じて、確認すべき`docs/notes/`が異なる。

- **フロントエンド・PWA表示・ブログ記事に関する作業**
  → このリポジトリ（`danshu-de-go`）の`docs/notes/`を確認
- **tyo本番DB（`/home/maji/danshu.db`）・データ収集スクリプト・
  venue/meeting登録・GOGO関連バックエンドに関する作業**
  → `danshu-tools`リポジトリの`docs/notes/`も必ず確認すること
  （かもちゃんの調査記録・作業指示書はこちらに置かれることが多い）

2リポジトリが分離されている理由：`generate_map_v6.py`のcron自動push（毎日5時）と
手動コミットがmainブランチで衝突した経緯があるため。混同しないよう、
各作業者は必ず`git remote -v`で対象リポジトリを確認してから作業すること。

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

### 主要テーブル（会員登録・GOGO関連）

```sql
user_accounts             -- 一般利用者（本体・GOGO共通、ブラウザ識別番号ベース）
user_calendar_settings    -- Myカレンダー設定
user_favorite_meetings    -- お気に入り例会
user_suggested_meetings   -- 利用者からの例会提案
meeting_managers          -- 例会管理権限（多対多）
contributor_accounts      -- 責任者・事務局アカウント（電話確認あり）
gogo_organizations        -- 全断連組織階層（GOGO用、organizationsと名前空間分離）
gogo_submissions          -- GOGO投稿受付
gogo_submission_files
gogo_extracted_meetings
gogo_audit_log
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

### 6. `NOT IN + NULL = 空結果`のSQLiteトラップ
NULLを含むサブクエリで`NOT IN`を使うと意図せず空結果になる。
LEFT JOINで回避すること。

### 7. 新規指示前の作業状況確認
複数のAI（かもちゃん・ふーちゃん・チャッピー・ChatGPT/Grok/Meta等）が
並行作業している可能性があるため、新規指示を受ける前に必ず
`git status`・`git log origin/main --oneline -5`を確認し、
重複作業・コンフリクトを防ぐこと。

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
| 東京新生会 | `tokyo_shinseikal_ical.py` | ✅ 97.1% |
| 東京多摩 | `tama_ical_common.py` | ✅ 稼働中 |
| 千葉県 | `chiba_ical_common.py` | ✅ 88.2% |
| 福岡県 | `fukuoka_ical.py` | ✅ 49件 |

### Google Calendar接続済みID
```
千葉県断酒連合会：chibadanshu@gmail.com
東京多摩断酒連合：tamadanshu@gmail.com
東京断酒新生会：do1bbtappflu5bk424ma9nj4gs@group.calendar.google.com
```

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

1. GOGOレビュー画面の実運用確認・改善
2. 東北データの残り登録（venue未一致分の解消、秋田組織の残り登録）
3. ハンバーガーメニュー復活（chiiki/導線・SEO内部リンク）
4. 断かもLINEへのqa.jsonツリーフロー実装（LINE Flex Message）
5. tama_danshu_ical.pyのtyo cron登録
6. needs_human_review=1レコードの人間による個別確認・統合

---

## かもちゃんのブログ（長期記憶）

URL: https://dansyu-go.nukadokonokai.com/blog/
ここを読めば今まで何をしてきたかわかる。

---

## セッション開始時のルーティン

1. `blog/posts/`の最新記事を1〜2件読む
   （ファイル名順ではなく、更新日時・ブログ一覧への掲載状況を見て
   本当に最新の記事を選ぶこと）
2. 今回の作業テーマに関係する`docs/notes/`のファイルを確認
   （danshu-de-go側・danshu-tools側の両方、テーマに応じて）
3. エラーが起きたら`docs/architecture.md`を読む

---

*最終更新: 2026年7月17日*
