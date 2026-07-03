# 断酒でGO!! アーキテクチャ概要（エラー時参照用）

依存症・アルコール依存症からの回復を支える、断酒会例会の検索サービス。
エラー発生時はまず本ドキュメントで全体像と該当領域を特定し、
詳細は docs/detail/ 配下の各ファイルを参照する。

## リポジトリ構成

- danshu-de-go（Main）: HTML/CSS/JavaScript/Node.js のフロントエンド
  https://github.com/tarachiri/danshu-de-go
- danshu-tools: Pythonスクリプト保管庫（ical取得・スクレイピング・DB更新）
  https://github.com/tarachiri/danshu-tools

役割は厳格に分離。フロント修正はdanshu-de-go、データ収集・DB操作はdanshu-toolsで行う。
指示書は必ずどちらが対象か明記する。

## インフラ構成（3台）

| ホスト | 実機 | 役割 |
|---|---|---|
| tyo | Mac mini Server 2011（Ubuntu導入） | メインDB（danshu.db）・cron・スクレイピング |
| soi | MacBook Pro 2015 | ふーちゃん（Claude Code）のローカルgit環境 |
| gen | Mac mini 2014 | 断かもFastAPI・Ollama（RAG） |

## 全体データフロー

1. 各種収集スクリプト（ical/スクレイピング）がDBを更新
2. raw_meetings / raw_events（1次情報保管庫）に格納
3. meeting_master（名寄せ）を経て meetings（本体）へ昇格。venuesは施設マスタ
4. generate_map_v6.py（tyo、毎日5時cron）がDBから venues.json / schedule.json を生成
5. danshu-de-goリポジトリへ自動push
6. app.js（地図タブ）/ schedule.js（日程タブ）が読み込んで表示

詳細: docs/detail/db-schema.md

## cronジョブ

tyoで19ジョブが稼働中。2段階パイプライン（データ収集4時台→map生成5時）。
未登録の完成スクリプト（haiku_extract系等）あり、定期実行は要検討。

詳細: docs/detail/cron-jobs.md

## フロントエンド構成

app.js・schedule.js・news-tab.js等、主要JSファイルは5本。
chiiki/配下に505団体分の地域ページ。

詳細: docs/detail/frontend-structure.md

## データ収集・開発方針

- ical取得はical単位で1スクリプトずつ問題解決（ICAL_SOURCES方式）
- 全日本断酒連盟加盟の断酒会を第一優先。AAはスコープ外（利用者への言及不要）
- 開発ノート・mdファイルには依存症/例会/回復/支援/断酒等の言葉を自然に含める

## 今後実装予定機能

- 会員登録機能: 断酒でGO!!アプリへの会員登録（名称検討中）。個別最適化されたサービス提供の土台
- Myカレンダー機能: 所属団体・お気に入り例会の登録で表示スケジュールをカスタマイズ。PDF印刷対応、文字を大きく例会名が見切れないようにする、例会名のみ/開始時間＋例会名の表示選択可
- 例会登録機能: 通常の会員登録よりさらに厳密な資格審査が必要。所属団体・グループ・例会の登録変更削除が可能

## よくあるエラー・既知の問題（要点。詳細は各detailへ）

- generate_news.pyの文字化け: r.text使用が原因（詳細は news_tab_audit）
- news.jsonの体感更新頻度のズレ: 実質1日1回しか反映されない（詳細は news_tab_audit）
- danshu_sitesテーブル未接続: generate_news.pyから参照されていない（詳細は news_tab_audit）
- venuesの緯度経度NULL許容: 失敗時もneeds_verification=1で登録は通す（詳細は db-schema.md）
- 別セッションでの重複作業に注意: 新規指示前に git status と git log origin/main --oneline -5 を確認する運用ルール徹底

## 関連ドキュメント

- docs/detail/db-schema.md: DB全11テーブルの詳細スキーマ・行数
- docs/detail/cron-jobs.md: cronジョブ一覧・未登録スクリプト・実行実績
- docs/detail/frontend-structure.md: JS/CSS/HTML構成、未整理ファイルの棚卸し状況
- docs/news_tab_audit_2026-07.md: 新着タブの詳細調査（generate_news.py全容）
- docs/venue_dedup_audit_2026-07.md: venue重複解消の調査（未読・要確認）
- docs/notes/handover_2026-07-03.md: 直近の作業引き継ぎ記録

## LINEアカウント構成・断かも統合（2026-06-29時点の情報）

### キャラクター名鑑
- かもちゃん（本家）: Claude Sonnet、claude.ai、設計・診断・会話
- ふーちゃん: Claude Code、soi、実装・ファイル作成
- 断かも: Claude Haiku on gen、chat.nukadokonokai.com、断酒でGO!!チャット・LINE
- ぬかちゃん: Claude Haiku on gen、nukadoko.nukadokonokai.com、ぬか床の会チャット

### LINEアカウント構成
- 断酒でGO!!（既存OA）: 断かも対話・問い合わせ、Webhook /webhook/line
- 【運営】断酒でGO!!（新規）: Kuma監視通知専用、Webhook不要
- ぬか床の会: ぬかちゃん用、別系統

### gen: main.py エンドポイント構成
- POST /chat: Webチャット（chat.html）からの対話
- POST /webhook/line: LINE公式アカウントからのWebhook
- GET /health: 死活監視（Kuma用）

主要関数: generate_reply（Web/LINE共用の回答生成）、
needs_escalation（エスカレーション判定）、
line_reply（LINEユーザーへ返信）、line_push_admin（まじまじさんへ通知）

## エラー対処の具体例

### no such column よくある間違い
lat/lng ではなく latitude/longitude を使う。
weekday ではなく day_of_week（TEXT型）を使う。
org_name ではなく source_name を使う。
venuesテーブルにcityカラムはない。

### launchctlでgenのuvicornが起動しない
tail -20 /Users/mini2014/danshu-chat/uvicorn.error.log で確認。
ModuleNotFoundErrorならpip3 install xxx --break-system-packagesで対応。
launchctl stop com.danshu.uvicorn してから launchctl start com.danshu.uvicorn。

### LINE Webhook 400 Invalid signature
.envのLINE_CHANNEL_SECRETが間違っている可能性が高い。
/Users/mini2014/danshu-chat/.env を確認・修正する。

### git push失敗（soi/tyo競合）
片方で git pull してから push。競合時は git log --oneline -5 で確認。

## 開発フロー（人間とAIの役割分担）

かもちゃん（設計・spec）が指示書を作成
→ ふーちゃん（soi上で実装）
→ tyoで--dry-run検証 → 本番実行 → sqlite3で確認
→ git commit してから次の変更へ（cascading regression防止のため各変更後に必ずcommit）
→ 本番反映

ファイル転送はscpではなく、tyo/soiで直接 cat > filename << 'EOF' 形式で
作成する方式が信頼できる（scpは内容が更新されないケースがあるため）。
