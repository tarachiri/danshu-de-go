# Phase2設計メモ：4種類の一次情報スキーマとvenues/meetings責務分離

**日付：2026-07-05**
**対象：danshu-tools（設計方針）、danshu-de-go（表示ロジック、将来対応）**

---

## 発端：福生市民公開セミナーの誤表示

meeting_id=497「福生市民公開セミナー」（venue_id=1955 福生市社会福祉協議会）が、
実際は2026年9月27日の単発開催（年1回）にもかかわらず、「今日開催！毎週日曜」と
誤表示される事象が発生。断酒会・断酒例会の例会情報の正確性は利用者の回復・支援
活動に直結するため、根本原因まで遡って調査した。

### 根本原因（確定）
`generate_map_v6.py`の`build_recurrence()`/`compute_next_date()`が、
`week_of_month`が空のとき機械的に「毎週」と解釈する仕様だった。単発イベント
（`meeting_type='セミナー'`）を区別する情報がこの2関数に渡されていなかったため。

### 対応（完了）
- `meetings`テーブルに`event_date TEXT`カラムを追加（ALTER TABLE実行済み）
- id=497を`event_date='2026-09-27'`, `day_of_week`/`week_of_month`=NULLに修正済み
- `generate_map_v6.py`改修の指示書を作成済み（ふーちゃん実装待ち、未着手）
  - `meeting_type`が'通常'以外なら`event_date`のみで次回開催日・表示文言を決定

---

## 副次的に発見した問題：venue_fallback_migrationの混乱

venuesのfallback系カラム（`meeting_name`/`schedule`/`recurrence`）をraw_meetings
経由でmeetingsに正規化する移行作業（`migrate_venue_fallback_to_raw.py`）で、
105件投入時に一時的に「処理が進んでいないように見える」混乱が発生した。

### 調査の結果（重要な学び）
- `migrate_venue_fallback_to_raw.py`にバグは無かった
- `parse_schedule_raw.py`にもバグは無かった
- 「80件が処理されていないように見えた」原因は、dry-run実行（Claude Haiku API
  呼び出しを含む398件処理、時間がかかる）が完了する前に結果を確認しようとした
  ことによる誤認だった
- 25件は本当にvenues側にスケジュール情報が存在しない（地方の断酒会に多い、
  ical化されていない一次情報の末端）

### 教訓
「狙った結果が出ない」状態を「バグ」と決めつける前に、処理の完了を確実に
待つ・確認する手順を徹底する（`> logfile 2>&1`でログ保存し`tail`で確認する等）。

### 本番実行完了（2026-07-05 追記）

`parse_schedule_raw.py`本番実行（--dry-runなし）：
```
parsed   : 378件
irregular: 18件
failed   : 2件
```

続けて`promote_venue_fallback_to_meetings.py`のdry-run→本番実行を実施。
`meeting_type`固定値'通常'での投入前に、venue_fallback_migration由来80件の
`meeting_name`をキーワード検索（セミナー/講演/研修/大会/年◯回/公開）し、
単発イベントの混入が無いことを確認済み（該当1件「河渡病院月例研修大会」は
第3日曜開催の定期イベントと判明、`meeting_type='通常'`のままで問題なし）。

本番実行結果：
```
INSERT成功: 60件
重複スキップ: 0件
venue_id無し: 0件
```

venue_fallback_migration由来60件が正式に`meetings`テーブルへ昇格完了。

### 未完了事項（次回持ち越し）
- irregular（18件）・failed（2件）は`needs_human_review`扱い、個別確認が必要
- 25件（venues側にschedule/recurrence情報が完全に無い）の扱い方針は未決定
- **重要**：今回昇格させた60件について、venues側の元データ
  （`meeting_name`/`schedule`/`recurrence`カラム）は削除されておらず残存中。
  次にvenues起因の移行スクリプトを実行する際は「既に投入済み」で
  自然にスキップされるため実害は無いが、Phase2最終ゴール
  （venuesから例会情報を完全に抜き取る）はまだ達成されていない

---

## 到達した設計思想：4種類の一次情報 → 共通スキーマ(meetings)

例会情報の一次情報は以下の4種類に分類できる。更新可能性・信頼度の序列も
概ねこの順（ical > PDF > 公式HP > ネット情報の自由記述）。

| 一次情報 | 更新性 | 対応パーサー（例） | 信頼度 |
|---|---|---|---|
| ical | ◎自動更新可 | `*_ical_common.py`（東京/埼玉/神奈川/千葉/愛知/香川/福岡/茨城等） | 高 |
| PDF | 〇 | 未整備（新着タブ改善タスクと重複領域） | 中 |
| 公式HP | △ | `osaka_rengo_scraper.py`, `sakaishi_scraper.py`, `hokusetsu_scraper.py`等 | 中〜低 |
| ネット情報（自由記述） | ▲更新困難 | `migrate_venue_fallback_to_raw.py`→`parse_schedule_raw.py`（Claude Haiku） | 低（`needs_verification`必須） |

### 設計原則（確定）
**4つの入口（情報源ごとの専用パーサー）→ 1つの出口（`meetings`という共通スキーマ）**

- venuesは位置情報・住所・座標のみを持つ「施設の器」に徹する
- meetings作成後にvenue_idで紐付ける（venues先行・meetings後追いという、
  これまでの逆の順序を徹底する）
- 情報源の信頼度に応じて、meetings側に`source_category`
  （`ical`/`pdf`/`official_html`/`net_info`）のような列を持たせ、
  表示・検証要否の判断に使う案を今後検討する

### なぜ今までこの順序が逆だったか
開発初期、venuesとmeetingsの責務区別がついていない段階でデータ投入が
先行したため。venues側に例会名・曜日・時間を書き込む運用が定着し、
後からmeetingsを正式に分離しようとした結果、今回のような「venues由来の
情報が亡霊のように混入し続ける」状態が生まれた（まじまじさん表現）。

---

## 次のアクション（TODO）

1. `parse_schedule_raw.py --dry-run`の完走結果を確認し、venue_fallback_migration
   由来80件のparsed/irregular/failed内訳を把握する
2. 完全に情報が無い25件の扱い方針を決める（`needs_verification=1`＋
   「開催情報未確認」表示、が現時点の有力案）
3. `generate_map_v6.py`改修（event_date対応）をふーちゃんに実装依頼、dry-run確認
4. 4情報源スキーマの設計を、実際に`meetings`テーブルへの`source_category`列
   追加案として具体化する（別途設計ドキュメント化）
5. venues側の`meeting_name`/`schedule`/`start_time`/`recurrence`カラムを、
   移行完了後にDROPする最終計画を立てる（Phase2完了の定義）

---

**変更日：2026-07-05**
**記録者：かもちゃん**
