# 組織・例会エンティティ再設計 Phase 1（organizations新設）

> 断酒会組織が開く例会・イベントを、会場と日程に正しく結びつけて案内するための
> エンティティ再設計。全体構想の Phase 1（組織マスタの新設）にあたる。
> 現時点では未実装・設計段階。

対象リポジトリ：`danshu-de-go`（本メモ） / `danshu-tools`（実装時のスキーマ反映先）

---

## 背景：なぜ組織構造から手をつけるのか

断酒でGO‼︎は単なる会場地図ではなく、**断酒会組織が開く例会・イベントを、会場と
日程に結びつけて案内するサービス**である。アルコール依存症からの回復を目指す
本人・家族が、自分の状況に合った例会に出会えることを目指している。

全国の断酒会は、以下のように組織階層を持つ。

```
全日本断酒連盟（全断連）
  └─ ブロック
       └─ 都道府県断酒会
            └─ エリア断酒会
                 └─ 各断酒会（支部制を取る場合はさらに支部単位）
```

ただし現実には、都道府県ごとに階層の深さ・呼び方が大きく異なる。
エリア制の県、支部制の県、月1回1会場だけの小規模組織なども存在するため、
**固定段数のテーブル構造では表現できない**。

現状の`venues`/`meetings`テーブルには、この組織階層を表す情報が
`region`（地域）・`group_name`（団体名）という文字列カラムでしか
持たれておらず、組織同士の親子関係は一切構造化されていない。
これが、例会同士の重複判定・表記ゆれ解消を難しくしている一因である。

---

## エンティティ設計

### organizations（組織マスタ）

1行 = 1つの断酒会組織（全断連〜各断酒会・支部まですべて同じテーブルで表現）

| カラム | 型 | 説明 |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | 組織名（例：埼玉断酒新生会） |
| org_type | TEXT | 自由記述。'全断連','ブロック','都道府県断酒会','エリア断酒会','支部' など |
| is_zendanren_member | INTEGER | 全断連加盟かどうか（AAはそもそも対象外のため本テーブルに含めない） |
| source_type | TEXT | データの出所。'zendanren_official'（公式一覧由来）／'extracted'（meetingsから抽出） |
| needs_verification | INTEGER DEFAULT 0 | 抽出由来のデータで、人間の確認がまだのもの |
| created_at | TEXT | |

`org_type`を自由記述にすることで、都道府県ごとに異なる階層の深さ・呼び方の
違いを、テーブル構造ではなくデータ側の多様性として吸収する。

### organization_hierarchy（組織階層の親子関係）

1行 = 組織同士の親子関係。可変の深さに対応する自己参照構造。

| カラム | 型 | 説明 |
|---|---|---|
| id | INTEGER PK | |
| parent_org_id | INTEGER REFERENCES organizations(id) | |
| child_org_id | INTEGER REFERENCES organizations(id) | |

`UNIQUE(parent_org_id, child_org_id)` で同一親子関係の重複登録を防ぐ。

---

## データ投入方針（2系統の突き合わせ）

organizationsへの初期データ投入は、以下2系統を組み合わせる。

```
zendanren_organizations（既存テーブル・公式一覧）
   ↓ 起点として手動整理（正の情報源、source_type='zendanren_official'）
organizations（新設）
   ↑ 突き合わせ・補完
meetings.region / meetings.group_name（既存カラム・実データ由来）
   ↓ 半自動抽出（source_type='extracted', needs_verification=1）
```

- **zendanren_organizations起点**：各断酒会グループが公開している組織図を
  サイトスクレイピング・PDF抽出で収集し、手動で整理する。これを正の情報源とする。
- **meetings由来の半自動抽出**：既存の`region`/`group_name`から組織名候補を
  抽出するが、表記ゆれ（全角半角混在・「〜断酒会」「〜断酒新生会」等の
  表記差）が想定されるため、抽出結果は`needs_verification=1`で登録し、
  zendanren_organizations起点のデータと突き合わせて人間が確認する。

いきなり全自動でマッチさせず、**venue登録・meeting登録で実績のある
「needs_verification フラグを立てて登録は通す」パターンをそのまま踏襲する。**

---

## Phase 1 のスコープ外（あえて含めないこと）

- meetingsテーブルへの`organization_id`カラム追加・紐付け（Phase 3で対応）
- events / event_occurrences の新設（Phase 4で対応）
- audience_scope / visibility の設計（Phase 3以降、meetings再設計と合わせて対応）

Phase 1は「organizations / organization_hierarchyという器を作り、
データを流し込めるようにする」ところまでに留める。既存の`venues`/`meetings`
テーブルには一切変更を加えない。

---

## 関連ドキュメント

- 全体構想（Phase 1〜5の移行順序）は `danshu-tools` 側の設計相談ログを参照
- 既存アーキテクチャ全体像は `docs/architecture.md` を参照

---

*最終更新: 2026-07-04*
*ステータス: 未実装・Phase 1設計段階*
*作成: かもちゃん（本家）*
