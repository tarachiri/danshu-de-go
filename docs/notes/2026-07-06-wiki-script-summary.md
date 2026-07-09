# 2026-07-06 wiki参照によるスクリプト整理メモ

## 確認元

Cloudflare Access越しに `https://wiki.nukadokonokai.com/` を確認。
主に以下を参照した。

- `danshu-tools/architecture/`
- `danshu-tools/detail/cron-jobs/`
- `danshu-tools/detail/db-schema/`
- `danshu-tools/detail/frontend-structure/`
- `danshu-tools/news_tab_audit_2026-07/`
- `danshu-tools/venue_dedup_audit_2026-07/`

## 全体像

`danshu-tools` は tyo 上で DB と生成物を更新する Python スクリプト群。
`danshu-de-go` は soi/GitHub Pages 側のフロントエンド。
データの流れはおおむね次の形。

```text
公式サイト / iCal / PDF / ソーバーねっと等
  ↓ 収集・抽出スクリプト
raw_meetings / raw_events / schedule_exceptions / venues / meetings
  ↓ generate_map_v6.py
venues.json / schedule.json
  ↓ GitHub Pages
app.js / schedule.js / news-tab.js
```

## cron登録済みの主なスクリプト

- `backup_db.sh`: 毎日2:00、DBバックアップ。
- `danshu_collector_v4.py`: 毎日3:00、全体収集。
- `generate_news.py`: 毎日3:25、`news.json` 生成・commit・push。
- `run_shizuoka_build_venues.sh`: 毎月1日/16日 2:05、静岡venue構築。
- `kyoto_heian_pdf.py`: 毎月1日/16日 2:15、京都平安PDF処理。
- `run_osaka_scrapers.sh`: 毎週月曜2:25、大阪系スクレイパー。
- `shizuoka_build_meetings.py`: 毎月1日/16日 3:35、静岡meeting構築。
- `run_saitama_ical.sh`, `run_tokyo_ical.sh`, `run_tama_ical.sh`, `run_chiba_ical.sh`, `run_kanagawa_ical.sh`: 4:00-4:20台のiCal更新。
- `aichi_ical.py`, `fukuoka_ical.py`, `ibaraki_ical.py`, `kagawa_ical.py`: 4:25-4:40のiCal更新。
- `generate_map_v6.py`: 毎日5:00、DBから `venues.json` / `schedule.json` を生成してpush。

## 未cron化だが実績のあるスクリプト群

haiku抽出系は、各県公式サイトからClaude APIでテキスト抽出し、
`raw_meetings` や `venues` へ反映した実績あり。

対象として確認されている県:

- 愛知
- 福岡
- 広島
- 北海道
- 兵庫
- 京都
- 長崎/高知
- 奈良
- 岡山
- 大阪
- 滋賀

実績値として、大阪193件、福岡113件、京都96件、兵庫74件、岡山59件、
愛知51件などのvenue登録が確認されている。
ただし定期実行するかは未決定。

## 愛知venueパイプライン

愛知は複数ファイルで一連の処理になっている。

- `aichi_ical_raw.py`: iCal取得
- `aichi_classify_events.py`: 取得データ分類
- `aichi_pdf_extract_meetings.py`: PDFからmeeting抽出
- `aichi_pdf_meetings.json`: 抽出結果
- `aichi_venues_master.json`: venue照合用マスタ
- `aichi_match_venues.py`: venue照合

`aichi_match_venues.py` はマスタ会場71件、raw_meetings側176施設に対し、
マッチ59件・誤爆除外2件・未マッチ115件のdry-run結果が記録されている。
未マッチ原因は全角半角、部屋名付与、略称違いなどの表記ゆれ。

## news関連

`generate_news.py` は約500行。
入力は主に以下。

- ソーバーねっとスクレイピング
- `PDF_PRIORITY_SITES` 15サイトのハードコード
- `venues.official_url` 上位30件
- 大阪系RSS 8件のハードコード

注意点:

- `danshu_sites` テーブル28件は未接続。
- DBに `rss_url` を持つ13件のうち、実際に使われているのは大阪系8件のみ。
- `r.text` 由来の文字化け問題が記録されている。
- newsで休会情報を拾えても、`schedule_exceptions` にはまだ接続されていない。

## venue / meeting整理関連

`register_venue.py` で新規venue登録処理の共通化が進んでいる。
移行済みとして確認されたもの:

- `shizuoka_build_venues.py`
- `osaka_shi_scraper.py`
- `hokusetsu_scraper.py`
- `osaka_rengo_scraper.py`
- `sakaishi_scraper.py`

venue登録時はジオコーディングを試すが、緯度経度は必須にしない。
失敗時はNULLのまま `needs_verification=1` で登録を通す設計。

`dedup_venues.py` は重複venue整理用。
テストDBと本番dry-runで、138グループ/179件の自動非表示化、
82件の人間確認対象が確認されている。
meetingsのUNIQUE制約衝突時は、情報量の多いmeetingを残すロジックへ修正済み。

## フロント側の読み込み

- `app.js`: 地図タブ。`venues.json` を読む。
- `schedule.js`: 日程タブ。現状は `schedule.json` を読む。
- `js/news-tab.js`: 新着タブ。`news.json` を読む。

`schedule.json` は `venues.json` から機械的に導出できるため、
将来的に `generate_map_v6.py` のschedule生成を削り、
`schedule.js` 側で `venues.json` からフラット化する構想がある。

## 今後の注意

- tyo作業前は `git status` と直近log確認が必須。
- 複数AIが同時作業するため、cron生成物や未追跡ファイルの扱いに注意。
- `generate_news.py` の改善は、`danshu_sites` 接続・文字化け・news_url巡回・schedule_exceptions連携を分けて進めるのが安全。
- Kamo/gen側 `main.py` はsoiローカルとgen本番が乖離していた記録があるため、編集時は必ずgen現行版を基準にする。
