# チャッピーへの指示書：東北5県データのraw_meetings取り込み＋ジオコーディング

対象リポジトリ: **danshu-tools**
作成日: 2026-07-12
優先度: 中

## 前提・注意事項（必読）

- 作業開始前に必ず`git status`・`git log origin/main --oneline -5`を確認し、
  他セッションとの衝突がないか確認すること
- 本タスクは今回の会員登録機能実装（`organizations`/`meeting_managers`等）とは
  完全に別系統。venues/meetings/raw_meetingsの既存パイプラインへの追加投入。
- 本番`danshu.db`への書き込みは、必ずdry-run→まじまじさん確認→本番の順。
  バックアップも前回同様（`danshu.db.bak_日付_before_内容`）取得すること

## 背景

まじまじさんが東北6県（宮城・岩手・福島・秋田・山形）の断酒会例会情報を
画像（PDF/紙資料の写真）で入手し、かもちゃんが手動でテキスト化・
構造化した。ソースは以下の通り、性質が異なる：

- 宮城・岩手・秋田：断酒会自身が作成した一次資料（PDF相当）
- 福島：断酒会HPの月次更新ページ（定期パターンのみ抽出、具体日付は破棄済み）
- 山形：**山形県精神保健福祉センター（行政）作成の二次資料**。信頼性は
  PDFと同等（中）として扱う方針で確定

## 添付データ

本指示書と併せて以下のCSVを渡す（かもちゃん作成、`/home/claude/tohoku_data/`）：

- `raw_meetings_tohoku_all.csv`（5県統合、69件、`raw_meetings`投入用フォーマット）
- `organizations_akita.csv`（秋田県断酒連合会＋地域断酒会5団体の階層データ）

## 実装タスク

### 1. `raw_meetings_tohoku_all.csv` の取り込み

CSVのカラムは`raw_meetings`の既存カラムに対応させてある：
`pref, group_name, meeting_name, facility_name, address_raw, schedule_raw,
audience, official_site, source_url, collector_script, source_type,
start_time, end_time`

以下の点に注意して取り込みスクリプトを書くこと：

- `collector_script`は`manual_image_transcription_2026-07-12`で統一している
  （誰が・いつ・どうやって収集したデータか追跡できるようにするため）
- `UNIQUE(pref, facility_name, schedule_raw)`制約があるため、重複行があれば
  `INSERT OR IGNORE`等でスキップし、スキップ件数を報告すること
- `needs_human_review`は全件`1`（要確認）で投入する。全国既存データと同様、
  「登録は通すが要確認フラグを立てる」既存方針を踏襲
- 宮城の2件（アメシスト例会・院内例会）は「中止中」の情報がある。
  `note`カラムに`"中止中（元資料で斜線表記）"`と記録し、
  `raw_meetings`昇格後は`meetings.is_hidden=1`となるようにすること
  （既存の`is_hidden`カラムをそのまま利用、新規カラム不要）
- 岩手・秋田の「酒害相談」枠（`audience`列に'酒害相談'と入っている行）は、
  `meeting_types`マスタに新しい種別として`酒害相談`を追加した上で、
  `meetings.meeting_type='酒害相談'`として昇格させること
  （予約制等の追加属性は不要、種別追加のみで対応する方針）

### 2. `meeting_types`への種別追加

```sql
INSERT INTO meeting_types (name) VALUES ('酒害相談');
```
※実際のカラム構成を`sqlite3 danshu.db '.schema meeting_types'`で確認してから
　カラム名を合わせること（本指示書のSQLは概念例）

### 3. `facility_name`の表記ゆれ・重複チェック

取り込み前に、既存`venues`テーブルと今回の`facility_name`が重複していないか
確認すること。特に「東北会病院」（宮城、複数例会で共通利用）のような
既存venuesとの重複可能性が高い会場名は要注意。

完全一致だけでなく、前方一致（8文字以上）でも既存の`aichi_match_venues.py`
と同様の緩やかなマッチングを行い、マッチ候補があれば
`needs_human_review=1`のまま報告し、自動マージはしないこと。

### 4. Google Geocoding APIによるジオコーディング

`address_raw`が入っている行（岩手・秋田・山形。宮城・福島は住所情報が
元資料になく空欄）について、既存の`register_venue.py`と同様の方式で
Google Maps Geocoding APIを呼び出し、緯度経度を取得する。

- 既存方針を踏襲：ジオコーディングは必ず実行するが、失敗しても登録の
  必須条件にはしない。失敗時は緯度経度NULLのまま`needs_verification=1`
  で登録を通す
- `GOOGLE_API_KEY`のtyo環境変数への恒久化が未対応（既知の課題、メモリ参照）
  なので、cron実行ではなく手動実行を前提に進めること。もし環境変数が
  見つからない場合はその旨を報告し、まじまじさんに確認すること

### 5. `organizations_akita.csv` の投入

`organizations`テーブル（本セッションで先ほど空のマスタとして作成済み）に、
秋田県断酒連合会＋地域断酒会5団体を投入する。

```
name, org_type, parent_org_name, note
秋田県断酒連合会, 連合会, (なし), 全日本断酒連盟正会員
秋田中央断酒会, 地域断酒会, 秋田県断酒連合会, 会員6名
...
```

`parent_org_name`は名前文字列なので、実際の投入時は
`organizations.id`を引いてから`organization_hierarchy`に
`parent_org_id`/`child_org_id`として登録すること（2段階の処理になる）。

`source_type='zendanren_official'`、`needs_verification=0`
（断酒会自身の一次資料のため、他の抽出データより信頼性が高いと判断）。

## 実装後の確認事項

- 取り込み件数（成功・重複スキップ・要確認件数）を報告
- ジオコーディング成功/失敗件数を報告
- `meeting_types`への'酒害相談'追加が既存データに影響しないか確認
  （既存の`meeting_type`が空文字列や別デフォルト値を期待していないか）
- 宮城の中止中2件が正しく`is_hidden=1`で登録されるか確認
- per-script commit、作業記録を`docs/notes/`に日付付きで追記

## 関連ドキュメント

- `docs/detail/db-schema.md`（raw_meetings/venues/meetings/organizations等の正確なカラム構成）
- `docs/phase1-organizations-design.md`（organizations設計原本）
- 添付: `raw_meetings_tohoku_all.csv`, `organizations_akita.csv`
