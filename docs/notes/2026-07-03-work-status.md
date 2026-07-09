# 2026-07-03 作業記録・課題・次の一手

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
