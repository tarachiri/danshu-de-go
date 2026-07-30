# 断酒でGO!! 開発記録目次

更新日: 2026-07-12

`docs/notes/` の作業記録を機能別に探すための目次。
同じ記録が複数の機能に関係する場合は、探しやすさを優先して重複掲載する。

## はじめに読む

- [作業引き継ぎ書](notes/handover_2026-07-03.md) — リポジトリ、3台のマシン、データ、優先タスクの全体像。
- [作業記録・課題・次の一手](notes/2026-07-03-work-status.md) — フロントエンドとJSON構造の調査、変更、残課題。
- [開発原則：機能スコープと土台の堅牢性](notes/2026-07-11-dev-principle-minimal-scope-vs-solid-foundation.md) — 小さく作る範囲と、最初から固める基礎設計の判断基準。
- [複数AIのIssue連携](notes/2026-07-09-ai-team-issue-workflow.md) — Claude、Codex、まじまじさんの役割とGitHub Issue・Markdownの共有方法。

## フロントエンド構成・リファクタリング

- [`app.js`分割とデータ分離試作](notes/2026-06-30-js-split-worklog.md) — 機能ごとのJS分割、検証、venues/meetings分離試作。
- [作業記録・課題・次の一手](notes/2026-07-03-work-status.md) — 主要JSONとフロント構成の調査・実装記録。

## 地図UI・タブ・表示

- [フッターのタブ別表示修正](notes/2026-07-04-footer-tab-visibility.md) — マップで非表示、日程・お知らせで表示する切り替え。
- [Leaflet著作権表示の位置修正](notes/2026-07-04-leaflet-attribution-fix.md) — attributionによる白い帯と地図表示領域圧迫の解消。
- [venue_id誤マッチ修正](notes/2026-07-09_venue_matching_generic_word_bug.md) — 昭島例会などが別会場に誤紐付きし、正しいピンに出ない問題の根本原因。

## 日程・会場・地図データ生成

- [断かもの「今日/明日/今から」週次判定修正](notes/2026-07-09_chat_today_weekday_bug.md) — 曜日だけでなく第何週かを判定する修正。
- [venue_id誤マッチ修正](notes/2026-07-09_venue_matching_generic_word_bug.md) — 正規化後の汎用語・短文字列による誤紐付けと再発防止。
- [単発イベントの日付誤解釈修正指示](notes/generate_map_v6_single_event_fix.md) — `generate_map_v6.py`でセミナー等を毎週開催と誤解釈する問題。
- [wiki参照によるスクリプト整理](notes/2026-07-06-wiki-script-summary.md) — DB収集から`venues.json`・`schedule.json`生成までの役割整理。

## お知らせ・ニュース

- [お知らせタブの安全修正](notes/2026-07-02-news-tab-safe-fixes.md) — 文字化け、イベント名破損、メタデータ表示の局所修正。
- [wiki参照によるスクリプト整理](notes/2026-07-06-wiki-script-summary.md) — `generate_news.py`を含むtyo側生成スクリプトの全体像。

## 断かも・LINE・Webチャット

- [断かもLINE統合と505団体の問い合わせ窓口化](notes/2026-06-29-line-webhook.md) — LINE Webhook、Webとの応答共通化、団体ページからの導線。
- [LINE問い合わせ配送路](notes/2026-07-05-line-inquiry-delivery.md) — 問い合わせ検知、継続メッセージ、管理者LINE通知。
- [Web版かもちゃん問い合わせのLINE通知](notes/2026-07-05-web-chat-inquiry-delivery.md) — `/inquiry`、JSONL保存、LINE Push通知の実装。
- [断かもの「今日/明日/今から」週次判定修正](notes/2026-07-09_chat_today_weekday_bug.md) — 会話検索で実際に開催されない例会が混ざる問題の修正。

## GOGO・例会情報登録アプリ

- [GOGO初期設計](notes/2026-07-07-gogo-app-domain-and-input-plan.md) — 入力形式、直接入力、ドメイン、本体反映の方針。
- [GOGO試作作成](notes/2026-07-07-gogo-prototype-build.md) — 登録、一覧、状態管理、カレンダー、印刷、連携JSONの静的試作。
- [かもちゃんチャット登録試作](notes/2026-07-08-kamo-chat-prototype.md) — 必要項目を順番に聞く対話式登録と画面変更。
- [GOGO保存方式とテストデータ](notes/2026-07-09-gogo-storage-and-testdata-check.md) — localStorageの制約と本体`schedule.json`からの試験データ生成経路。
- [GOGO設計確認](notes/2026-07-10-gogo-design-clarifications.md) — tyo保存、人間確認、対応ファイル、将来の自動反映方針。
- [開発原則：機能スコープと土台の堅牢性](notes/2026-07-11-dev-principle-minimal-scope-vs-solid-foundation.md) — 投稿受付実装で先に固める保存パス、ID解決、status再計算。

## 会員登録・団体・権限スキーマ

- [会員登録機能DBスキーマ案](notes/2026-07-10-member-registration-schema-draft.md) — 本体側の一般利用者、Myカレンダー、例会登録の未実装設計。
- [GOGO会員登録スキーマ精査](notes/2026-07-10-gogo-schema-review.md) — 一般利用者と運営参加者の分離、団体マスタ、兼務の論点。
- [GOGO会員登録スキーマ精査への回答](notes/2026-07-10-gogo-schema-review-response.md) — 確定した判断、確定版スキーマ、アプリ側バリデーション。
- [GOGO用organizationsの命名衝突と解決](notes/2026-07-10-gogo-organizations-naming-conflict.md) — tyo実DBの`org_hierarchy`との衝突を調査し、`gogo_organizations`へ分離。
- [`gogo_organizations`と`org_hierarchy`の伏線整理](notes/2026-07-10-gogo-organizations-naming-conflict-note.md) — 現時点の分離と将来の統合時に再検討する論点。

## Cloudflare Tunnel・Access・開発Wiki

- [かもちゃんからのWikiアクセス課題](notes/2026-07-05-kamochan-wiki-access-issue.md) — クラウドAIからローカルWikiへ到達する際の構造的制約。
- [Cloudflare Access設定ウィザード](notes/2026-07-05_access_wizard_progress.md) — Zero Trust初回オンボーディング未完了の特定と進捗。
- [Cloudflare Tunnel構成の実態確認](notes/2026-07-05_cloudflare_tunnel_reality_check.md) — 指示書の前提とtyo実環境の不一致。
- [wiki DNS誤登録インシデント](notes/2026-07-05_dns_misroute_incident.md) — 意図しないトンネルへDNSが向いた原因と復旧。
- [Cloudflare Tunnelの根本原因確定](notes/2026-07-05_gen_investigation_root_cause.md) — gen・tyo上の実プロセスとトンネル定義の調査結果。
- [cloudflared-wikiのsystemd化](notes/2026-07-05_systemd_setup_complete.md) — tyo上での常駐化、自動起動、稼働確認。
- [Cloudflare Access越しのwiki curl確認](notes/2026-07-06-cloudflare-access-wiki-curl-check.md) — Service Token付きリクエストのHTTP 200確認。
- [wiki参照によるスクリプト整理](notes/2026-07-06-wiki-script-summary.md) — Access越しにWikiを読み、danshu-toolsの責務を整理。

## インフラ・cron・リポジトリ分離

- [作業引き継ぎ書](notes/handover_2026-07-03.md) — soi・tyo・genの役割、リポジトリ分離、cronと手動コミットの衝突防止。
- [wiki参照によるスクリプト整理](notes/2026-07-06-wiki-script-summary.md) — tyoのDB収集・データ生成・pushチェーン。
- [cloudflared-wikiのsystemd化](notes/2026-07-05_systemd_setup_complete.md) — wikiトンネルのサービス運用。

## 複数AI・GitHub Issue・作業運用

- [複数AIのIssue連携](notes/2026-07-09-ai-team-issue-workflow.md) — 役割分担、IssueとMarkdownの使い分け、開始・完了時の更新項目。
- [開発原則：機能スコープと土台の堅牢性](notes/2026-07-11-dev-principle-minimal-scope-vs-solid-foundation.md) — 実装範囲を絞っても基礎設計を後回しにしない原則。
- [機能別目次の作成](notes/2026-07-12-docs-notes-index-created.md) — 本目次の作成内容と検証結果。
- [Google DriveへのMarkdownバックアップ](notes/2026-07-12-google-drive-markdown-backup.md) — 関連2プロジェクトのMarkdownを構造を保ってDriveへコピーした記録。

## 運用ルール

- 新しい作業記録を`docs/notes/` に追加したら、本目次の該当機能にもリンクと一行要約を追加する。
- 記録が複数機能に関係する場合は、各機能から辿れるよう重複掲載してよい。
- 結論が食い違う場合は新しい日付の記録を優先し、DB・サーバー・公開JSONの実状で再確認する。
- 複数AIが同時作業するときは、既存の作業記録への同時追記を避け、日付付きの新規ファイルを作る。
