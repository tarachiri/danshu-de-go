# 2026-07-10 GOGO・会員登録スキーマ精査への回答（確定版）

作成日: 2026-07-10
作成者: かもちゃん（Claude Sonnet）
参照元: `2026-07-10-gogo-schema-review.md`（ふーちゃんによる精査）
ステータス: 4点中3点確定、1点は提案のまま採用

## 経緯

ふーちゃんによる `organizations` / `contributor_accounts` スキーマ精査
（`2026-07-10-gogo-schema-review.md`）を受け、まじまじさんに優先確認事項
4点のうち3点を確認した。回答を反映した確定版スキーマを以下に示す。

## まじまじさんの回答

### 1. 複数団体の兼務は「あり得る」

1つのLINEアカウント（1人）が、複数の末端断酒会の責任者・事務局を兼ねる
ケースは実際に起こり得る（人手不足の地域など）。

→ `contributor_accounts.line_user_id` の単独UNIQUE制約は撤廃し、
`UNIQUE(line_user_id, organization_id)` に変更する。

### 2. 責任者と事務局の兼務は「しない前提でよい」

理由: 事務局は「責任者が高齢でITスキルに障壁がある場合のWeb代行担当」
という位置づけであり、責任者自身がITを使えるなら事務局は本来不要な役割。
兼務を許すと事務局という役割の存在意義が崩れるため、同一団体内での
責任者・事務局兼務は禁止する。

→ アプリ側バリデーションで、同一 `contributor_accounts.id` が同一団体の
`representative_contributor_id` と `secretariat_contributor_id` の
両方に入ることを明示的に禁止する。

### 3. organizationsは「正式マスタとして育てる」

`organizations`（都道府県・ブロック・全国連盟を含む階層）は、権限管理用の
簡略マスタに留めず、今後の正式な組織マスタとして育てていく前提とする
（ふーちゃん提案のA案を採用）。

→ `parent_organization_id` は全階層（national→block→prefecture→local）で
使用する。削除権限の判定は従来通り「localからparentを1回辿ればprefecture
に届く」設計のままでよく、実装の複雑さは増えない。

## 未確定のまま採用する提案（4点目）

「local/prefecture等の制約をDBトリガーで守るか、アプリ側で守るか」

初期実装はアプリ側の共通バリデーション関数に寄せる方針を維持する
（SQLiteのトリガーはメンテコストが高く、初期段階では過剰と判断）。
将来的にデータ量が増え、アプリ側チェックの抜け漏れリスクが無視できなく
なった場合に、トリガー導入を再検討する。

## 確定版スキーマ

```sql
-- ============================================================
-- organizations: 断酒会組織（正式組織マスタとして育てる）
-- ============================================================
CREATE TABLE organizations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    organization_type TEXT NOT NULL DEFAULT 'local'
        CHECK (organization_type IN ('national', 'block', 'prefecture', 'local')),
    parent_organization_id INTEGER,        -- 全階層で使用
    representative_contributor_id INTEGER, -- localのみ運用。責任者
    secretariat_contributor_id INTEGER,    -- localのみ運用。事務局
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (parent_organization_id) REFERENCES organizations(id)
        ON DELETE RESTRICT,
    FOREIGN KEY (representative_contributor_id) REFERENCES contributor_accounts(id),
    FOREIGN KEY (secretariat_contributor_id) REFERENCES contributor_accounts(id)
);

CREATE INDEX idx_organizations_type ON organizations(organization_type);
CREATE INDEX idx_organizations_parent ON organizations(parent_organization_id);

-- ============================================================
-- contributor_accounts: 運営参加者アカウント
-- 1つのLINE IDが複数団体の役職を兼ねることを許容する
-- 同一団体内でrepresentativeとsecretariatの兼務は不可（アプリ側チェック）
-- ============================================================
CREATE TABLE contributor_accounts (
    id INTEGER PRIMARY KEY,
    line_user_id TEXT NOT NULL,            -- 単独UNIQUEは付けない
    display_name TEXT,
    organization_id INTEGER NOT NULL,      -- 所属する末端断酒会（local）
    status TEXT NOT NULL DEFAULT 'applied'
        CHECK (status IN ('applied', 'confirmed', 'rejected', 'on_hold', 'retired')),
    applied_at TEXT NOT NULL DEFAULT (datetime('now')),
    confirmed_at TEXT,
    retired_at TEXT,
    exception_note TEXT,
    linked_user_account_id INTEGER,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),

    UNIQUE (line_user_id, organization_id),
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
        ON DELETE RESTRICT,
    FOREIGN KEY (linked_user_account_id) REFERENCES user_accounts(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_contributors_org_status ON contributor_accounts(organization_id, status);
CREATE INDEX idx_contributors_line_user ON contributor_accounts(line_user_id);
```

## アプリ側で必ず担保するバリデーション

1. `contributor_accounts.organization_id` に紐づく `organizations.organization_type` が `local` であること
2. 同一団体内で、同じ `contributor_accounts.id` が `representative_contributor_id` と `secretariat_contributor_id` の両方に入らないこと（兼務禁止）
3. `status` を `confirmed` に更新する際は `confirmed_at` も同時にセット。`retired` にする際は `retired_at` も同時にセット
4. 登録順序を厳守する: ① `organizations` を責任者・事務局NULLで作成 ② `contributor_accounts` を作成 ③ `organizations.representative_contributor_id` / `secretariat_contributor_id` を更新

## 次のアクション

- このスキーマでdanshu.db（tyo）への実装可否をふーちゃんに確認してもらう
- GOGO側テーブル（`gogo_submissions`等）との接続方法をチャッピーとすり合わせる（Issue #1で継続議論中）
- 都道府県以上の`organizations`データ投入方法（まじまじさんによる手動投入）の具体的な手順を別途詰める

## 関連ドキュメント

- `2026-07-10-member-registration-schema-draft.md`（かもちゃん初期案）
- `2026-07-10-gogo-schema-review.md`（ふーちゃんによる精査、本メモの元）
- `tarachiri/dansyu-gogo` Issue #1（GOGO専用スキーマ検討、チャッピー担当）

---

## 追記（ふーちゃん / Claude Code, soi / 2026-07-10）

実装可否確認のため tyo の `danshu.db` を読み取り専用で確認したところ、
**`organizations` という名前が本体アプリ側の既存設計と衝突する**ことが判明した。

- tyo には既に `org_hierarchy`（id, level, level_value, parent_id, ...）テーブルが存在（中身は空）。
- これは `danshu-de-go/docs/phase1-organizations-design.md` で設計された
  「venues/meetingsの組織名寄せ用」の `organizations` / `organization_hierarchy` の
  受け皿として用意されたもので、**目的が全く別**（本メモのGOGO用organizationsは
  責任者・事務局の権限管理が目的）。
- 同じ`organizations`という名前で別目的のテーブルを両方作ると混乱するため、
  まじまじさんと相談の上、**GOGO用テーブルは `gogo_organizations` にリネーム**して
  名前空間を分けることに決定した。

### 実装時の変更点（本メモのスキーマに対する差分）

- `organizations` → `gogo_organizations` にリネーム
- `contributor_accounts.organization_id` の参照先も `gogo_organizations(id)` に変更
- `representative_contributor_id` / `secretariat_contributor_id` の自己参照も `gogo_organizations(id)` に変更
- カラム構成・CHECK制約・インデックス方針は変更なし（テーブル名のみの変更）
- phase1設計の`organizations`（本体・venues/meetings用）は今回未着手のまま。将来実装時にtyoの`org_hierarchy`を使うか再設計するかは別途判断する

この差分を反映した最終DDLは、tyo実装時にあらためて`danshu-tools`側で作成する。
