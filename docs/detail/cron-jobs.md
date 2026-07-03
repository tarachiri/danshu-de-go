# cronジョブ詳細（tyo）

docs/architecture.md の詳細資料。

## crontab全体（2026-07-03時点）

- */10 * * * *  danshu-de-go git pull（フロント最新化）
- 0 2 * * *     DBバックアップ（backup_db.sh）
- 0 3 * * *     danshu_collector_v4.py（全体収集）
- 25 3 * * *    generate_news.py to news.json commit push
- 5 2 1,16 * *  run_shizuoka_build_venues.sh
- 15 2 1,16 * * kyoto_heian_pdf.py
- 25 2 * * 1    run_osaka_scrapers.sh（毎週月曜）
- 35 3 1,16 * * shizuoka_build_meetings.py
- 0 4 * * *     run_saitama_ical.sh
- 5 4 * * *     run_tokyo_ical.sh
- 10 4 * * *    run_tama_ical.sh
- 15 4 * * *    run_chiba_ical.sh
- 20 4 * * *    run_kanagawa_ical.sh
- 25 4 * * *    aichi_ical.py
- 30 4 * * *    fukuoka_ical.py
- 35 4 * * *    ibaraki_ical.py
- 40 4 * * *    kagawa_ical.py
- 0 5 * * *     generate_map_v6.py to venues.json/schedule.json commit push
- 0 6 * * 1     mirror_update.sh（毎週月曜）

## 2段階データパイプライン

1. 4時台: 各ical系スクリプトがDB（danshu.db）を更新
2. 5時: generate_map_v6.pyがDBから venues.json・schedule.json を生成し、danshu-de-goリポジトリへ自動commit push

この自動push（毎日5時）と人間の手動コミットが同一mainブランチ上で衝突した経緯があり、
danshu-de-go/danshu-toolsの2リポジトリ分離の理由になっている。

## news.json生成（generate_news.py、3:25）

詳細は docs/news_tab_audit_2026-07.md を参照。要点：
- データソース3系統＋1（ソーバーねっとスクレイピング、PDF_PRIORITY_SITES15サイトハードコード、venues.official_url上位30件、RSS_SOURCES大阪系8件ハードコード）
- danshu_sitesテーブル（28件）は一切参照されていない未接続状態
- 文字化けバグあり（r.text使用、r.apparent_encoding未使用）

## cron未登録の完成スクリプト（2026-07-03時点）

以下は実行実績（raw_meetings・venuesへの反映）が確認済みだが、cron未登録。
定期実行すべきかは要検討（保留中）。

### haiku_extract系（12ファイル、各県サイトからClaude APIでテキスト抽出）
aichi, fukuoka, hiroshima, hokkaido, hyogo, kyoto, nagasaki_kochi,
nara, okayama, osaka, shiga の各haiku_extract.py + parse_schedule_raw.py

実行実績（venues登録数、2026-07-03確認）:
大阪府193／福岡県113／京都府96／兵庫県74／岡山県59／愛知県51／
熊本県36／滋賀県32／北海道25／長崎県20／奈良県18／高知県17／広島県4

### 愛知県venue関連（6ファイル）
aichi_classify_events.py, aichi_ical_raw.py, aichi_match_venues.py,
aichi_pdf_extract_meetings.py, aichi_pdf_meetings.json, aichi_venues_master.json

ical取得→分類→PDF抽出→venue照合の一連パイプライン。

### その他
- sobar_selenium_extract.py: ソーバーねっと（断酒会支援NPO、addiction-peer.net）から全都道府県のミーティング情報をSelenium取得。動作確認済み（熊本県36件）
- regeocode_fallback.py: フォールバック座標の再ジオコーディング（京都の誤登録座標修復用）。孤立状態、他スクリプトから参照なし
- parse_schedule_raw.py: Claude Haikuでschedule_rawをパースする独立処理。孤立状態、用途を思い出せないまま
- fix_sobernet.py: 未完成の作業断片（コミット済みだが要整理）

## 運用上の注意：別セッションでの重複作業

複数セッション（かもちゃん/ふーちゃん）が同日並行で作業すると、
tyoローカルとGitHub側で重複コミット・競合が起きうる（2026-07-03に実例あり）。
新規指示前に以下を確認する運用ルールを徹底する：
git status
git log origin/main --oneline -5
