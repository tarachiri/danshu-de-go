# 断酒でGO!! アーキテクチャ概要（開発・運用・設計まとめ） - architecture_next.md

依存症・アルコール依存症からの回復を支える、断酒会例会の検索サービス。
エラー発生時はまず本ドキュメントで全体像と該当領域を特定し、詳細は `docs/detail/` 配下の各ファイルを参照する。

---

## 1. リポジトリ構成

- **`danshu-de-go` (Main/フロントエンド)**
  - https://github.com/tarachiri/danshu-de-go
  - HTML/CSS/JavaScript/Node.js のフロントエンド、および公開用静的JSON。GitHub PagesおよびCloudflare CDN経由で公開。
- **`danshu-tools` (データ処理・バックエンド - Private)**
  - https://github.com/tarachiri/danshu-tools
  - Pythonスクリプト保管庫（iCal取得・クローラー・スクレイピング・DB更新・自動JSON生成）。

> [!IMPORTANT]
> 役割は厳格に分離。フロント修正は `danshu-de-go`、データ収集・DB操作は `danshu-tools` で行う。
> 過去に `generate_map_v6.py` の自動コミット（毎日5時）と開発者の手動コミットが競合したため分離された。作業時は必ず `git remote -v` を確認すること。

---

## 2. インフラ構成（3台）

| ホスト | 実機 | 役割 |
|---|---|---|
| **tyo** | Mac mini Server 2011（Ubuntu導入） | メインDB（`danshu.db`）・cron・スクレイピング・ニュース＆マップJSONの自動生成とGitHubへのpush |
| **soi** | MacBook Pro 2015 | 開発環境・VSCode・ふーちゃん（Claude Code）ローカルGit環境 |
| **gen** | Mac mini 2014 | 断かもFastAPI・Ollama（RAG）の稼働、LINE WebhookおよびWebチャットのエンドポイント |

---

## 3. 全体データフロー

1. 各種収集スクリプト（iCal/スクレイピング）がDBを更新。
2. `raw_meetings` / `raw_events`（1次情報保管庫）に一時格納。
3. `meeting_master`（名寄せ）を経て `meetings`（本体）へ昇格。`venues` は施設マスタ（1ピン=1会場）。
4. **`generate_map_v6.py`**（`tyo`にて毎日5:00実行）がDBから `venues.json` / `schedule.json` を生成し、`danshu-de-go` リポジトリへ自動push。
5. **`app.js`**（地図タブ）および **`schedule.js`**（日程タブ）が最新JSONを読み込んでブラウザに描画。
   - `gen`側のAPIによるJSON取得はキャッシュバスター（`?v=...`）付きURLを用い、古いキャッシュを防止。

---

## 4. データベース構成（`danshu.db`）

**場所：** `/home/maji/danshu.db`（`tyo`上のSQLite）

### 4.1 基本例会データ関連テーブル（1次・2次・3次）
- **`venues`**: 施設マスタ（1ピン=1会場）。緯度・経度（`latitude`, `longitude`）は国土地理院APIやGoogle Maps APIで自動取得。失敗時も `needs_verification=1` として座標NULLのまま登録を許容する設計。
- **`meetings`**: 例会スケジュール、時間、対象などを保持。`venue_id` で `venues` と1対多で紐づく。
- **`schedule_exceptions`**: 中止や祝日変更情報を格納する例外テーブル（12,000件超）。
- **`raw_meetings` / `raw_events` / `events`**: 外部から取り込まれた1次情報および特別単発イベント。
- **`zendanren_organizations`**: 全日本断酒連盟加盟団体（535件）のマスタデータ。プチHP（`org-XXX`）の自動生成源。
- **`org_hierarchy`**: 組織の親子階層保持用テーブル（現状0件で未使用、新規 `organizations` と並存中）。

### 4.2 会員登録・GOGO関連テーブル（2026年7月新規追加・実装）
- **`user_accounts`**: 一般利用者（本体・GOGO共通、ブラウザ識別番号ベース）。LINE連携でのログインをサポート。
- **`user_calendar_settings`**: Myカレンダー設定（表示モード、見切れないための大文字設定、印刷用設定など）。
- **`user_favorite_meetings`**: 一般ユーザーがお気に入りに登録した例会リスト。
- **`user_suggested_meetings`**: 所属団体の例会がない日に近隣（デフォルト半径30km内）の例会を自動提案する「自動例会カレンダー機能」の提案データを格納。
- **`meeting_managers`**: 例会管理権限（多対多）。1人の責任者が複数例会を兼務・編集可能にする。
- **`contributor_accounts`**: 責任者・事務局アカウント（登録時に運営による電話確認等を実施）。
- **`gogo_organizations`**: 全断連組織階層（GOGO用。`organizations` との名前空間衝突を避けるため分離）。
- **`gogo_submissions`**: GOGO投稿（例会情報の新規登録・修正提案）の受付レコード。
- **`gogo_submission_files` / `gogo_extracted_meetings` / `gogo_audit_log`**: GOGOの提出添付ファイル、抽出された例会データ、操作の監査ログ。

---

## 5. cronジョブ（tyoサーバー）

毎日早朝の「データ収集」→「静的JSON生成・push」の2段階パイプラインが稼働。

```
02:00  DBバックアップ（backup_db.sh）
03:00  全都道府県コレクター（danshu_collector_v4.py）
03:25  generate_news.py + news.json の自動生成および git push
04:00〜04:40  各県iCal更新（埼玉、東京新生会、多摩、千葉、神奈川、愛知、福岡、茨城、香川）
05:00  generate_map_v6.py + git push（venues.json・schedule.jsonを一括生成）
毎週月曜06:00  mirror更新（栃木スクレイプ）
毎月1日・16日  静岡県・京都府（平安）PDF解析処理とDB反映
```

---

## 6. フロントエンド構成

```
danshu-de-go/
├── index.html        メインマップ・スプラッシュ免責同意画面
├── manifest.json     PWA設定
├── style.css         全体のUI・Leaflet用カスタムスタイル
├── js/
│   ├── analytics.js  アクセス解析
│   └── app.js, schedule.js, news-tab.js 等
├── blog/
│   ├── index.html    開発ブログ一覧
│   └── posts/        ブログ記事（001.html〜。スマホ閲覧時のため必ず生HTMLで書く）
└── docs/
    ├── philosophy.md 開発哲学
    └── architecture.md / architecture_next.md (本作)
```

---

## 7. AIチーム構成

各AIがそれぞれの環境と担当領域で分担して作業を行う。

- **かもちゃん** (Claude Sonnet / Claude.ai チャット): 設計・診断・会話・指示書作成担当。
- **ふーちゃん** (Claude Code on `soi`): フロントエンド（`danshu-de-go`）実装・マークダウン記録等。
- **チャッピー** (Codex on `tyo` / `danshu-tools`): バックエンドのPythonツール、SQLスクリプト、DB作業担当。
- **断かも** (Claude Haiku on `gen`): 「断酒でGO!!」WebチャットおよびLINE公式アカウントのWebhook応答。
- **ぬかちゃん** (Claude Haiku on `gen`): 「ぬか床の会」チャット対応（別プロジェクト）。

---

## 8. 重要ルール・開発原則

### 1. 絶対パスの徹底
`tyo` サーバー上では、cron実行時にホームディレクトリ展開（`~/`）が不安定になるのを防ぐため、すべてのスクリプト・DB指定で絶対パス（`/home/maji/danshu.db`など）を使用すること。

### 2. 必ず dry-run を実行する
Pythonスクリプトを実行する際は、まず `python3 script.py --dry-run` を実行し、影響範囲をログ等で確認してから本番実行を行う。

### 3. 名寄せ時の汎用語（GENERIC_NAMES）除外
自動名寄せマッチングの際は、`例会` `懇談会` `家族会` `ミーティング` などの極端に一般的な文字列はマッチ対象から除外すること。

### 4. マッチング文字数のガード
施設名などを正規化した後の文字列が**4文字未満**の場合は、名寄せマッチング処理を通さない（「○○会館」の「会館」など、汎用的な部分一致で誤った `venue_id` に誤集約されるのを防ぐため）。

### 5. UNIQUE制約の罠
`meetings(group_name, name, venue_id)` のUNIQUE制約があるため、`venue_id` 更新前に旧レコードを削除するか無効化（`status='inactive'`等）する必要がある。

### 6. セッション開始時のルーティン
複数のAIが非同期で作業するため、作業前に必ず `git status` および `git log origin/main --oneline -5` を実行し、他のAIの作業による競合を防止する。また、過去ログは上書きせず「新規追記」を行う。

---

## 9. Markdown作業記録の保存先（新規ルール）

> [!IMPORTANT]
> - 今後、新規に作成する作業記録・調査記録・指示書などのMarkdownファイルは、リポジトリ内ではなく **Google Driveの専用フォルダ** へ保存する。
>   - **Folder ID:** `1BN6lHfXzCzW0k3vw5kFcsbySLnbLbJ7h`
>   - **URL:** `https://drive.google.com/drive/folders/1BN6lHfXzCzW0k3vw5kFcsbySLnbLbJ7h`
> - `docs/notes/` へ新規保存するのは、まじまじさん（人間）から明示的な指定がある場合のみ。
> - リポジトリの管理に必要な README、仕様書、アーキテクチャドキュメント（本ファイルなど）は、このルールの対象外（Gitで管理）。

---

## 10. 近年の重要バグ・インシデント対策記録

### 10.1 Cloudflare Tunnel DNS 誤ルーティング
- **原因:** `cloudflared tunnel route dns` 実行時に `--config` を明示しないと、デフォルトの `/etc/cloudflared/config.yml` が読まれて別トンネルのCNAMEが登録されてしまった。
- **対策:** `--config` を明示する運用をルール化。

### 10.2 Leafletマップ著作権（attribution）表示崩れ
- **原因:** 帰属表示が画面下部のナビゲーションバーと重なり地図を狭めていた。
- **対策:** Leaflet標準の帰属表示を無効化（`attribution: false`）し、代わりにHTML側に独自DOM `#map-attribution` を定義してナビの上に固定配置。

### 10.3 Web/LINEチャット「今日の例会」判定バグ
- **原因:** 曜日名マッチングのみを行っていたため、第何週の開催周期（例：第1木曜のみ開催など）を考慮できず、その日開催されない例会を表示していた。
- **対策:** 曜日比較を廃止し、`generate_map_v6.py` が祝日・中止周期を計算して出力している **`next_date` (次回開催予定日 YYYY-MM-DD)** と、今日・明日の日付文字列を直接一致判定するロジックへ変更。

### 10.4 経堂地区会館（venue_id=9）への誤集約
- **原因:** 住所正規化処理が「経堂地区会館」の「地区」を「〜区」と誤認して削除し、「会館」という短い文字列でvenuesを検索した結果、IDの若い `venue_id=9` に部分一致で誤マッチした。
- **対策:** 正規化後の文字数が4文字未満の場合は部分一致でのマッチングを行わないガードを追加。

---

## 11. 今後の主要タスク

1. **GOGOレビュー画面の実運用確認・改善**
2. **東北データの残り登録・名寄せ**:
   - `raw_meetings` のvenue未一致（宮城・福島等）の解決（施設名称の変更・統廃合への対応や、住所空欄時の警告メカニズム実装）。
3. **ハンバーバーメニュー復活**:
   - `chiiki/` 配下（505団体分の地域ページ）への導線、およびSEO内部リンクの強化。
4. **自動例会カレンダー提案ロジックの実装**:
   - 会員登録機能の土台の上に、所属団体の例会がない日の近隣30km内自動提案のAPI/バッチ処理を実装する。
5. **PDF印刷＆文字サイズ最適化機能**:
   - Myカレンダーの高齢者向け配慮としての表示調整および印刷対応。

*最終更新: 2026年7月19日*
