# 断酒でGO!! アーキテクチャ参照ドキュメント

> **ふーちゃんへ：** エラーが起きたらまずここを読んで。
> このファイルはかもちゃん（Claude chat）が最新状態を保守している。

---

## サーバー構成

| 名前 | 実体 | 用途 |
|------|------|------|
| tyo | Ubuntu VPS `maji@192.168.0.12` | 本番DB・cronジョブ・Python処理 |
| soi | MacBook Pro 2015 `/Users/pro2015/` | フロントエンド開発・VSCode・Claude Code |

**重要ルール：** スクリプト内パスは `/home/maji/` を使う。`~/` はcronで展開されないため禁止。

---

## ファイル構成（tyo）

/home/maji/
├── danshu.db                    # 本番SQLiteデータベース
├── danshu-de-go/                # GitHubリポジトリ（公開）
│   ├── venues.json              # 毎朝3:30 cron自動生成・push
│   ├── index.html               # PWAメインページ
│   ├── blog/posts/              # 開発ブログ記事（standalone HTML）
│   └── docs/
│       ├── philosophy.md        # AIクローラー向け魂リポジトリ
│       └── architecture.md     # このファイル
├── danshu-tools/                # スクリプト群（非公開リポジトリ）
│   ├── generate_map_v6.py       # venues.json生成（現行版）
│   ├── generate_news.py         # お知らせJSON生成
│   ├── fukuoka_ical.py          # 福岡iCal処理
│   ├── *_ical_common.py         # iCal共通処理（都道府県別）
│   ├── *_haiku_extract.py       # haikuちゃんHTML抽出スクリプト
│   ├── sobar_selenium_extract.py # ソーバーねっとSeleniumスクレイパー
│   └── run_*.sh                 # iCal実行シェルスクリプト
├── danshu_collector_v4.py       # 全国データ収集（毎日3:00）
├── shizuoka_build_venues.py     # 静岡venues構築（1日・16日）
├── shizuoka_build_meetings.py   # 静岡meetings構築（1日・16日）
├── kyoto_heian_pdf.py           # 京都PDF例外処理（1日・16日）
├── osaka_shi_scraper.py         # 大阪市スクレイパー（月曜）
├── hokusetsu_scraper.py         # 北摂スクレイパー（月曜）
├── osaka_rengo_scraper.py       # 大阪連合スクレイパー（月曜）
└── sakaishi_scraper.py          # 堺市スクレイパー（月曜）

---

## DBテーブル構造

### venues（施設マスタ）
id, facility_name, address, phone, source_name, prefecture,
latitude, longitude, first_seen, last_seen,
meeting_name, schedule, contact_phone, contact_name,
next_date, start_time, end_time, recurrence, building_name,
meeting_type, official_url, is_online, requires_contact,
is_hidden(※), needs_verification
UNIQUE(facility_name, address, meeting_name)
※ is_hidden=1 で非表示管理（物理削除より安全）

### meetings（例会メタデータ）
id, region, group_name, name, venue, address, phone,
contact_name, contact_phone,
day_of_week(TEXT: 月火水木金土日), week_of_month(TEXT: "1,3" 形式),
start_time, end_time, family_meeting, verified, needs_verification,
official_url, status, notes,
venue_id(→venues.id), prefecture, city, meeting_type,
national_area, placeholder_lat, placeholder_lng
UNIQUE(group_name, name, venue_id)
week_of_month形式: "1,3" "2,4,5" カンマ区切り・ブラケットなし

### schedule_exceptions（開催変更・実開催情報）
id, venue_id, meeting_id(→meetings.id),
original_date, exception_date, exception_type, note, source

### raw_meetings（収集ステージングテーブル）
id, collected_at, source_type, collector_script, pref,
group_name, meeting_name, facility_name, address_raw, schedule_raw,
audience, theme, official_site, source_url,
status(raw→promoted), venue_id_candidate, meeting_id,
needs_human_review, note, collected_date, updated_at
UNIQUE(pref, facility_name, schedule_raw)

### national_sources（ソーバーねっと由来データ）
id, pref, group_name, meeting_name, facility_name, address,
phone, schedule_text, audience, theme, official_site, source_url,
venue_id(→venues.id), meeting_id(→meetings.id), imported_at, geo_failed

---

## cronジョブ一覧（tyo）

毎10分  : git pull danshu-de-go
2:00    : DBバックアップ
2:05 (1,16日) : 静岡 venues構築
2:15 (1,16日) : 京都 PDF例外処理
2:25 (月曜)   : 大阪4スクレイパー連続実行
3:00    : 全国データ収集 danshu_collector_v4.py
3:25    : お知らせ生成 generate_news.py
3:30    : generate_map_v6.py → venues.json git push
3:35 (1,16日) : 静岡 meetings構築
3:45    : スケジュール更新 update_schedule.sh
4:00    : 埼玉 iCal
4:05    : 東京 iCal
4:10    : 多摩 iCal
4:15    : 千葉 iCal
4:20    : 神奈川 iCal
4:30 (月曜)   : 福岡 iCal
6:00 (月曜)   : ミラー更新

---

## よくあるエラーと対処

### UNIQUE constraint failed
同じレコードが既存。INSERT前にSELECTで確認。旧レコード削除してから再INSERT。

### no such column よくある間違い
lat/lng → latitude/longitude
weekday → day_of_week（TEXT型）
org_name → source_name
city(venues) → venuesテーブルにcityカラムはない

### cronでスクリプトが動かない
パスに ~/ を使っていないか確認。すべて /home/maji/ で書く。

### git push失敗（soi/tyo競合）
片方で git pull してから push。競合時は git log --oneline -5 で確認。

---

## iCal対応都道府県（稼働中）

埼玉   : saitama_*_ical.py × 6地域  毎日4:00
東京   : tokyo_shinseikal_ical.py   毎日4:05
多摩   : tama_ical_common.py        毎日4:10
千葉   : chiba_ical_common.py       毎日4:15
神奈川 : kanagawa_*_ical.py × 10地域 毎日4:20
福岡   : fukuoka_ical.py            毎週月曜4:30

---

## フロントエンド概要

地図: Leaflet.js + MarkerClusterGroup
データ: venues.json（Fastly CDN・gzip圧縮 約86KB）
表示ロジック: generate_map_v6.py が venues+meetings を結合してJSON生成
PWA: Service Worker あり
Analytics: Google Analytics G-B1YCK7W6XG

---

## 開発フロー

かもちゃん（設計・spec）
  ↓ 指示書（B+C形式：仕様＋テストケース）
ふーちゃん（soi上で実装）
  ↓ scp
tyo（--dry-run検証 → 本番実行 → sqlite3確認）
  ↓ git commit & push
本番反映

鉄則: 各変更後に必ずgit commitしてから次へ（cascading regression防止）
