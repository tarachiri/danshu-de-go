# generate_map_v6.py 修正指示書：単発イベント（セミナー等）の日付誤解釈修正

**対象リポジトリ：`danshu-tools`（private）**
**対象ファイル：`generate_map_v6.py`**
**作業者：ふーちゃん（soi）**
**作業前に必ず確認：`git status` と `git log origin/main --oneline -5`（他AI・手動作業との衝突防止）**

---

## 背景（根本原因）

`meetings`テーブルの`meeting_type='セミナー'`（単発イベント）が、定期例会用の
`day_of_week`/`week_of_month`カラムに無理やり登録されていたため、
`compute_next_date()`と`build_recurrence()`が「week_of_monthが空＝毎週」と
誤解釈し、「今日開催！」と誤表示される事象が発生した（例：id=497 福生市民公開セミナー、
実際の開催日は2026年9月27日）。

DB側は既に対応済み：
- `meetings`に`event_date TEXT`カラムを追加済み（ALTER TABLE実行済み、tyo上のdanshu.db）
- id=497の`event_date`を`'2026-09-27'`に設定し、`day_of_week`/`week_of_month`はNULLに変更済み

今回はコード側（`generate_map_v6.py`）を、この`event_date`と`meeting_type`を
正しく解釈するように修正する。

---

## 修正1：meetings取得SQLにevent_dateを追加

現状（145〜157行目付近）：
```python
    c.execute("""
        SELECT
            id, venue_id, name, group_name,
            day_of_week, week_of_month,
            start_time, end_time,
            meeting_type, needs_verification,
            official_url
        FROM meetings
        WHERE status = 'active'
          AND venue_id IS NOT NULL
        ORDER BY venue_id, day_of_week, start_time
    """)
```

修正後（`event_date`を追加）：
```python
    c.execute("""
        SELECT
            id, venue_id, name, group_name,
            day_of_week, week_of_month,
            start_time, end_time,
            meeting_type, needs_verification,
            official_url, event_date
        FROM meetings
        WHERE status = 'active'
          AND venue_id IS NOT NULL
        ORDER BY venue_id, day_of_week, start_time
    """)
```

---

## 修正2：compute_next_date() に meeting_type / event_date 対応を追加

現状：
```python
def compute_next_date(day_of_week: str, week_of_month: str) -> str | None:
    """
    day_of_week: "月"〜"日"
    week_of_month: "1,3" / "1,2,3" / "" (毎週) など
    戻り値: "YYYY-MM-DD" or None
    """
    if not day_of_week or day_of_week not in DOW_MAP:
        return None
    ...
```

修正後（関数の先頭に単発イベント分岐を追加）：
```python
def compute_next_date(day_of_week: str, week_of_month: str,
                       meeting_type: str = "", event_date: str = "") -> str | None:
    """
    day_of_week: "月"〜"日"
    week_of_month: "1,3" / "1,2,3" / "" (毎週) など
    meeting_type: "セミナー" 等の単発イベントは event_date のみで判定
    event_date: "YYYY-MM-DD"（単発イベントの開催日）
    戻り値: "YYYY-MM-DD" or None
    """
    # 単発イベント：event_dateが未来（今日含む）なら表示、過去なら非表示
    if meeting_type and meeting_type != "通常":
        if not event_date:
            return None
        try:
            ev = date.fromisoformat(event_date)
        except ValueError:
            return None
        return event_date if ev >= TODAY else None

    if not day_of_week or day_of_week not in DOW_MAP:
        return None
    ...  # 以下既存ロジックそのまま
```

※ `date.fromisoformat`を使うため、ファイル先頭のimportに`from datetime import date`が
既にあるか確認。なければ`datetime`モジュールのインポート行に追記。

---

## 修正3：build_recurrence() に meeting_type / event_date 対応を追加

現状：
```python
def build_recurrence(day_of_week: str, week_of_month: str) -> str:
    if not day_of_week:
        return ""
    if not week_of_month:
        return f"毎週{day_of_week}曜"
    ...
```

修正後：
```python
def build_recurrence(day_of_week: str, week_of_month: str,
                      meeting_type: str = "", event_date: str = "") -> str:
    # 単発イベントは「毎週」等の繰り返し表記をしない。日付そのものを返す
    if meeting_type and meeting_type != "通常":
        return event_date or ""

    if not day_of_week:
        return ""
    if not week_of_month:
        return f"毎週{day_of_week}曜"
    ...  # 以下既存ロジックそのまま
```

---

## 修正4：呼び出し側（meeting_cards生成ループ）を修正

現状（228〜229行目付近）：
```python
        for m in venue_meetings:
            next_date = compute_next_date(m["day_of_week"], m["week_of_month"])
            recurrence = build_recurrence(m["day_of_week"], m["week_of_month"])
```

修正後：
```python
        for m in venue_meetings:
            next_date = compute_next_date(
                m["day_of_week"], m["week_of_month"],
                m["meeting_type"], m["event_date"]
            )
            recurrence = build_recurrence(
                m["day_of_week"], m["week_of_month"],
                m["meeting_type"], m["event_date"]
            )
```

---

## 動作確認手順（tyoでdry-run推奨）

1. `git status` / `git log origin/main --oneline -5` で衝突がないか確認
2. 上記4箇所を修正
3. tyo上でdry-run実行し、venues.jsonの中でvenue_id=1955（福生市社会福祉協議会）の
   meeting_cardsを確認：
   ```bash
   python3 generate_map_v6.py
   grep -A 15 '"id": 1955' venues.json
   ```
   - `next_date`が`"2026-09-27"`になっていること
   - `recurrence`が`"2026-09-27"`（または空でも可、要相談）になっていること
   - 「毎週日曜」という文字列が出ていないこと
4. 他の`meeting_type='通常'`の例会（1571件）が従来通り正しく「今日開催」判定
   されることを、既存の例会（例：id=1918や1919など）で確認
5. 問題なければ commit → push（まじまじさんへの確認後）

---

## 備考

- `meeting_type`が空欄の461件は`'通常'`扱いとして今回の分岐に影響しない
  （`if meeting_type and meeting_type != "通常"`の条件を満たさないため、
  従来の曜日ロジックがそのまま適用される）
- 461件を`'通常'`に統一する一括更新は、今回のスコープ外（別途対応）
- 今後、単発イベント登録時（register_venue系スクリプトやtama_ical等）に
  `event_date`も入力する運用ルールが必要。これはPhase2の別タスクとして
  後日検討する

---

**変更日：2026-07-05**
**変更者：かもちゃん（設計）→ふーちゃん（実装予定）**
**関連：venue_id=1955, meeting_id=497（福生市民公開セミナー）**
