# 2026-07-03 作業記録・課題・次の一手

<!-- ファイル名: 2026-07-03-work-status.md -->

> Grokセッションでの調査・実装・コミット内容の引き継ぎメモ。
> 対象リポジトリ: `tarachiri/danshu-de-go`（本番: https://dansyu-go.nukadokonokai.com）

---

## 本日の作業内容

### 1. リポジトリ・データ構造の調査

- ローカル `/Users/pro2015/danshu-de-go` と GitHub `tarachiri/danshu-de-go` を確認。
- 関連リポジトリ: `danshu-de-go-dev`（確認用）、`danshu-tools`（private・生成スクリプト群）。

**主要JSONの役割を整理:**

| ファイル | 件数（概算） | 単位 | 用途 |
|---------|------------|------|------|
| `venues.json` | 1,216 | 会場（1ピン=1施設） | 地図タブ・ポップアップ |
| `schedule.json` | 1,516 | 開催予定（1行=1例会） | 日程タブ・断かも検索 |
| `venues_base.json` | 試作 | 会場固定情報 | 未接続 |
| `meetings_live.json` | 試作 | 例会・例外・venue_states | 未接続 |

**生成ロジック（現行）:** `danshu-tools/generate_map_v6.py`（tyo・毎朝5:00 cron）

```text
danshu.db (venues + meetings + schedule_exceptions)
  ↓ compute_next_date() で次回日を算出
venues.json（meetings[] ネスト）
  ↓ フラット展開
schedule.json
```

- `next_date` は **DBにはなく**、生成時に `day_of_week` + `week_of_month` から計算している。
- `schedule.json` は `venues.json` の `meetings[]` のコピー展開であり、データが二重になっている。

### 2. 日程タブに開催日時を表示（実装・反映済み）

**コミット:** `e5bbe8c` — `feat(schedule): 日程タブのカードに開催日時を表示`

| ファイル | 変更 |
|---------|------|
| `schedule.js` | `_formatCardDateTime()` 追加。各カードに `📅 7/8（水曜） 19:00〜21:00` 形式を表示 |
| `style.css` | `.sch-datetime` スタイル追加 |

- ポップアップと同じ `formatDate()` を利用し、「今日」「明日」ラベルも表示。
- 左カラムの開始・終了時刻表示は維持。

### 3. その他のコミット・プッシュ（反映済み）

**コミット:** `82a8deb` — `chore: ドキュメント・試作JSON・お知らせタブ修正を追加`

| ファイル | 内容 |
|---------|------|
| `js/news-tab.js` | リンクURLの属性エスケープ（`escapeHtmlAttr`） |
| `AGENTS.md` | 開発ガイド |
| `docs/app-js-guide.md` 等 | フロント構成・読み込みフロー・作業ログ |
| `gen-main.schedule-work.py` | 断かも検索用スケジュール参照スクリプト |
| `meetings_live.json` / `venues_base.json` | 分割JSON試作データ |

**意図的にコミットしなかったもの（ローカルに残存）:**

- `memories.json` / `users.json` — 個人情報・メール含む
- `019df61a-*.json` / `e1aff970-*.json` — 無関係なエクスポート
- `gen-main.schedule-work.py.before` — バックアップ
- `__pycache__/` — 生成物

---

## 本日の議論で整理した設計判断

### JSON一本化について

- `venues.json` の `meetings[]` と `schedule.json` は **中身がほぼ同じ**（派生関係）。
- 一本化の方向性: `venues_base.json` + `meetings.json`（試作は `meetings_live.json`）に分離し、フロントで `venue_id` JOIN。
- `schedule.json` は廃止候補。DB変更は不要（生成スクリプトとフロントの切り替えで足りる）。

### `meetings` テーブルに `next_date` カラムは要るか

- **現状のPWAだけなら不要。** JSONに毎朝計算結果が載るため十分。
- DBカラムが有用になるのは、サーバーAPIがSQLで「今日の例会」を引く場合など。
- 足すなら「計算結果のキャッシュ」として。源泉は `day_of_week` / `week_of_month` のまま維持。

### ポップアップの日付表示

- ポップアップは `venues.json` の `meetings[].next_date` を参照。
- JSON一本化時も、`app.js` が `meetings.json` + `venues_base.json` をJOINすれば日付は維持できる。
- **venues.json から meetings を外すだけ**だとポップアップが壊れるので、フロント変更はセットで行う。

---

## 現在抱えている課題

### データ・生成まわり

| 課題 | 詳細 |
|------|------|
| JSON二重構造 | `venues.json` と `schedule.json` に同じ例会情報が重複 |
| fallback会場 | `meetings[]` が空の会場が **177件**。`fallback_*` フィールドで表示している |
| venuesテーブルのレガシーカラム | `meeting_name` / `schedule` / `next_date` 等が venues に残存（`db_redesign_spec_v1.md` で削除予定） |
| 座標キーの不一致 | venues: `lat`/`lng`、schedule: `latitude`/`longitude` |
| 例外情報の欠落 | `schedule.json` には `has_exception` / `exc_note` がない（日程タブで中止表示不可） |
| 旧スクリプト残存 | `schedule_enrich.py`（iCal直取り・7日先）は現行 v6 に置き換え済みだがコードは残っている |

### フロントエンド

| 課題 | 詳細 |
|------|------|
| 試作JSON未接続 | `venues_base.json` / `meetings_live.json` はコミット済みだがアプリ未使用 |
| `app.js` の肥大化 | `popup.js` 切り出しは未着手（`2026-06-30-js-split-worklog.md` 参照） |
| 日程タブの日付重複 | 日付グループ見出し + カード内日時の二重表示（意図的だが、すっきりさせる余地あり） |

### インフラ・運用

| 課題 | 詳細 |
|------|------|
| 生成タイミング | `generate_map_v6.py` は毎朝5:00（tyo cron）。ドキュメント内に旧記載3:30が残っている箇所あり |
| soi / tyo 競合 | フロント編集（soi）と cron push（tyo）の git 競合リスク |
| 未追跡ファイル | 個人データ系JSONがローカルに残存。`.gitignore` 未整備 |

### データ品質（既知）

- `needs_verification=1` の会場が多数（季節・天候で会場変動する例会など）
- 同一施設への複数例会（最大18件/会場）のポップアップ表示
- iCal未対応地域は `compute_next_date()` のルールベース計算に依存

---

## 次にやること（優先度順）

### Androidアプリ試作（2026-07-03追記）

- `/Users/pro2015/AndroidStudioProjects/GO` に作成済みのAndroid Studioプロジェクトを確認。
- `AndroidManifest.xml` に `INTERNET` 権限を追加。
- `activity_main.xml` の初期 `Hello World!` を `WebView` 全画面表示へ変更。
- `MainActivity.kt` で `https://dansyu-go.nukadokonokai.com/` を読み込み、Androidの戻る操作でWebView内履歴を戻る処理を追加。
- `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew :app:assembleDebug` でデバッグビルド成功。
- 次はAndroid Studioから実機またはエミュレーターへ実行し、地図・日程・新着タブの動作確認。

### すぐ確認できること

1. **本番で日程タブの日時表示を確認** — `e5bbe8c` 反映後、スマホでカードに `📅 日付 時刻` が出るか。
2. **GitHub Pages / CDN キャッシュ** — 古い `schedule.js` が残っていないか。必要ならハードリロード。

### 短期（安全に進められる）

3. **`.gitignore` 整備** — `__pycache__/`, `*.before`, `memories.json`, `users.json`, ルートの UUID json を除外。
4. **`popup.js` 切り出し** — `buildPopup()` / `formatDate()` を `js/popup.js` へ（手順は `2026-06-30-js-split-worklog.md`）。
5. **日程タブの例外表示** — `schedule.json` 生成時に `has_exception` / `exc_note` を含めるか、カードで中止を表示。

### 中期（設計変更）

6. **JSON分割の本番化**
   - `generate_map_v6.py` → `venues_base.json` + `meetings.json` 出力
   - `app.js` / `schedule.js` を JOIN 方式に変更
   - `schedule.json` 廃止
7. **fallback 177件の解消** — meetings 未紐づき会場の `venue_id` 名寄せ
8. **venues テーブルスリム化** — 例会系カラムの段階的 NULL 化・削除（`db_redesign_spec_v1.md` フェーズ順）

### 長期

9. **断かも検索のデータ源統一** — `gen-main.schedule-work.py` とフロントが同じ `meetings.json` を参照
10. **会場変動例会のDB設計** — あおぞら例会・季節会場など `needs_verification` 系の扱い

---

## 関連ファイル早見表

```text
フロント（danshu-de-go）
  app.js              地図・ポップアップ・タブ切替
  schedule.js         日程タブ
  js/news-tab.js      お知らせタブ
  venues.json         地図データ（tyo生成）
  schedule.json       日程データ（tyo生成）

バックエンド（danshu-tools / tyo）
  generate_map_v6.py  venues.json + schedule.json 生成
  generate_news.py    news.json 生成
  danshu_collector_v4.py  全国データ収集（3:00）

設計ドキュメント
  docs/architecture.md
  docs/code-structure.md
  danshu-tools/db_redesign_spec_v1.md
```

---

## 直近コミット履歴

```text
82a8deb chore: ドキュメント・試作JSON・お知らせタブ修正を追加
e5bbe8c feat(schedule): 日程タブのカードに開催日時を表示
bd25ced blog: 断かも検索精度向上の記録
722bf10 docs: cronスケジュール記載を実crontabに合わせ修正
3838544 auto: venues.json・schedule.json更新 v6
```

---

*最終更新: 2026-07-03*

---

## 2026-09-28 追記：家族向けマップ入口の試作

- 起動画面に「ご家族の方へ」の入口を追加。
- 定期開催の家族会は今日から30日後まで、特別イベントは既存の公開期間設定に従って同じ家族向け地図に表示する試作とした。
- 例会と会場は別登録にせず、既存の共通データから家族会の開催分だけを選ぶ。
- 2026-09-28時点の公開JSONでは、「家族」を名称に含む例会が165件、147会場。専用分類は未設定で、現時点では名称判定である。
- 390px幅で入口、家族向け案内帯、地図ピン、通常マップへ戻る導線を確認済み。
- 残課題：名称に依存しない `family_meeting` 相当の分類値を配信データに含めるか、公式情報と照合して判断する。

*最終更新: 2026-09-28*

---

## 2026-09-28 追記：家族会分類フラグの優先表示

- 家族向けマップの判定で、確認済みの `family_meeting=1` を名称より先に見るよう修正した。
- 既存データには家族会でも既定値 `0` の行が多いため、移行が終わるまでは名称に「家族」を含む場合の補助判定を残す。
- 公開JSON 2,017例会の確認では、`family_meeting=1` は11件、名称に「家族」を含むがフラグ未設定の例会は158件だった。
- 現在の公開データに新判定を適用すると、30日以内では名称に「家族」が出ない確認済み3レコードが追加対象になる。埼玉県断酒新生会の公式会場案内で「川越例会/家族会」「合同例会/家族会」と確認した。
- 川越例会には同一日程・同一会場とみられる2会場レコードが残るため、今回は削除や統合を行わず、別途DB側で確認する。
- `family-map.test.js` に数値・文字列フラグ、名称フォールバック、通常例会の除外、名称に家族がない確認済み例会の30日判定を追加した。
- バックエンド側では、家族会名と構造化済みの `audience=家族のみ` を判定する共通処理を追加し、東京・多摩・千葉のiCal登録と仮登録からの昇格で `family_meeting` を保存するよう修正した。再同期時は、明示的な家族会だけを `1` に上げ、既存の手動フラグを `0` へ戻さない。
- 現在フラグ未設定で名称に「家族」がある158件へ新しい判定を試すと、家族会・家族例会・家族昼例会・家族教室・家族の集い等149件が補正候補となり、「本人/家族」等の混在表記9件は自動確定せず確認待ちになる。
- バックエンドの分類・登録試験7件と既存のiCal同期パイプライン試験8件、計15件が成功した。本番DBへの適用・既存行の一括補正は行っていない。
- 大阪の一部収集処理が家族会を除外している問題と、既存158件の公式情報による確認・補正は残課題としてある。

### 本番DBの読み取り監査とコピーDBリハーサル

- tyo本番DBを読み取り専用で確認した時点では、有効例会2,298件、`family_meeting=1` は11件、名称に「家族」がある未設定例会は172件だった。
- SQLiteのバックアップ機能でtyoの一時フォルダにコピーDBを作成し、`integrity_check=ok` とSHA-256を確認してから監査した。
- 未設定172件は、名称から家族会要素を明示判定できる候補157件と、「本人/家族」等の混在表記で確認待ち15件に分かれた。確認待ちはすべて愛知県の表記だった。
- 候補157件のうち、出典URLあり148件、出典URLなし9件、既に `needs_verification=1` のもの19件、既知のiCal同期記録があるもの19件だった。
- iCal同期由来19件にも、重複、古い会場、会場未紐付けが混在していたため、一括補正は行わない方針とした。
- 重複が見当たらない千葉県の柏家族会（コピーDB上のmeeting_id=521）1件だけを `family_meeting=1` に変更するリハーサルを実施。`meeting_type=通常` を維持したまま、生成JSONで次回2026-10-14、次々回2026-11-11、家族会フラグ1を確認した。
- コピーDBの `integrity_check=ok` を再確認。既存の外部キー警告は更新前後とも135件で増加なし。本番DBは変更していない。
- 読み取り専用監査処理と試験を追加し、家族会関連・iCal同期関連の試験18件が成功した。

*最終更新: 2026-09-28*

---

## 2026-09-29 追記：柏家族会1件の本番反映

- 本番DB更新前に `/home/maji/backups/danshu-before-family-meeting-521-20260929-0225.db` を作成し、`integrity_check=ok` とSHA-256を確認した。
- コピーDBでリハーサル済みの柏家族会（meeting_id=521）だけを `family_meeting=1` に更新した。`meeting_type=通常`、会場、曜日、時刻は変更していない。
- 更新後も `integrity_check=ok`。既存の外部キー警告は更新前後とも135件で増加しなかった。
- 本番生成では `venues.json` の柏家族会フラグ1件と、その内容を示す `update_history.json`・起動画面の更新履歴だけが差分になった。
- 公開データはコミット `4b91af6`、今後の東京・多摩・千葉iCal取り込みと仮登録昇格でフラグを保存するバックエンドはコミット `ea762d7` として `main` へ反映した。
- バックエンドは最新のカレンダー安全化変更を含む29試験、フロントは家族マップ・日程計算試験が成功した。

*最終更新: 2026-09-29*
