# 会員登録機能 DBスキーマ（案）現段階まとめ

作成日: 2026-07-10
作成者: かもちゃん（Claude Sonnet）
ステータス: 仮案・未実装・要チャッピー合流確認

## 背景

断酒でGO!!の会員登録機能（会員登録・Myカレンダー・例会登録）の実装に向けて、
DBスキーマの方針を検討した。既存の `future-member-features.md` /
`future-member-features-schema.md` / `phase1-organizations-design.md` で
未確定だった2点（会員種別のテーブル分割方式、所属団体の階層）について、
まじまじさんと会話しながら方針を確定させた。

並行して `tarachiri/dansyu-gogo` Issue #1 でチャッピー（Codex）が
GOGO専用スキーマを検討中だが、長時間応答が止まる不具合が発生しており、
本メモは断酒でGO本体側の会員登録設計として独立してまとめている。
チャッピー側の設計（`gogo_submissions` 等）と合流時にすり合わせが必要。

## 決定事項

### 1. 会員種別はテーブル分割（フラグ管理ではなく）

`user_accounts`（一般利用者）と `contributor_accounts`（運営参加者・例会情報の
登録担当）は、属性の非対称性（LINE ID・電話確認状態 vs ブラウザ識別番号など）
と状態遷移の非対称性（電話確認フローは運営参加者にしか存在しない）から、
1テーブル+フラグではなく別テーブルとする。

同一人物が両方を兼ねるケースは `contributor_accounts.linked_user_account_id`
で紐付ける。

### 2. 組織階層と削除権限の対象を絞り込み

実際の組織構造:

```
全日本断酒連盟（トップ、責任者なし）
  └ ブロック（責任者なし）
      └ 都道府県断酒会（責任者・事務局あり、変更少、主催は限定的）
          └ 末端断酒会（責任者・事務局あり、変更・登録数が最も多い）
```

都道府県断酒会以上は既に公開されている責任者情報を元に
まじまじさんが直接手入力で管理し、LINE申請・電話確認・削除権限の仕組みは
不要と判断。いたずら登録防止が本当に必要なのは
**末端断酒会・例会の責任者と事務局のみ**。

このため `contributor_accounts` は `organization_type = 'local'` の
団体にのみ紐づく前提とし、削除権限は以下の2者のみに絞る。

- まじまじさん本人
- 対象の末端断酒会が属する都道府県断酒会の責任者・事務局
  （`organizations.parent_organization_id` を1回辿るだけで判定可能。
  ブロック・全国連盟までの遡上は不要）

### 3. 登録フロー（運営参加者）

1. LINE公式アカウントで申請
2. まじまじさんが電話で本人確認・操作説明・注意点の説明
3. 確認完了で `status` を `confirmed` に

通話内容は原則メモを取らない。ただし以下は例外的に記録する。

- 通常フロー外の対応をした場合（例: 家族が代理申請、高齢のため別手段で確認）
  → `exception_note` に簡潔に記録
- 登録を保留・却下した場合の理由
  → 同上（確認OKで通常通り進んだ場合は何も記録しない）

### 4. 責任者・事務局は1団体につき各1名

「1団体につき責任者1名・事務局1名まで」というルールは、
`contributor_accounts` 側にカウント制約を持たせるのではなく、
`organizations` 側に `representative_contributor_id` /
`secretariat_contributor_id` の専用カラムを持たせることで表現する。

理由:
- 空席かどうかが「NULLか否か」の1点確認で済む
- 「この団体の責任者は誰か」が `organizations` を見るだけで即答できる
- カラムが2つしかないため、3人目を入れる場所がそもそもデータ構造上存在しない

責任者・事務局の交代時は、旧レコードを削除せず
`contributor_accounts.status` を `retired` にして履歴として残す。

## 仮スキーマ

```sql
-- ============================================================
-- organizations: 断酒会組織
-- ============================================================
CREATE TABLE organizations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    organization_type TEXT NOT NULL DEFAULT 'local'
        CHECK (organization_type IN ('national', 'block', 'prefecture', 'local')),
        -- national=全国連盟, block=ブロック, prefecture=都道府県, local=末端断酒会
    parent_organization_id INTEGER,        -- localのみ都道府県のIDを持つ
    representative_contributor_id INTEGER, -- localのみ使用。責任者
    secretariat_contributor_id INTEGER,    -- localのみ使用。事務局
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (parent_organization_id) REFERENCES organizations(id),
    FOREIGN KEY (representative_contributor_id) REFERENCES contributor_accounts(id),
    FOREIGN KEY (secretariat_contributor_id) REFERENCES contributor_accounts(id)
);

-- ============================================================
-- user_accounts: 一般利用者アカウント
-- 目的: Myカレンダー、お気に入り例会登録などの個別最適化
-- ============================================================
CREATE TABLE user_accounts (
    id INTEGER PRIMARY KEY,
    display_name TEXT,
    prefecture TEXT,
    city TEXT,                            -- 丁目・番地は持たない
    browser_token TEXT UNIQUE,             -- 本人確認ではなく端末識別用
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at TEXT
);

-- ============================================================
-- contributor_accounts: 運営参加者アカウント
-- 対象は末端断酒会・例会の責任者/事務局のみ
-- ============================================================
CREATE TABLE contributor_accounts (
    id INTEGER PRIMARY KEY,
    line_user_id TEXT UNIQUE NOT NULL,
    display_name TEXT,                     -- LINEプロフィール名のスナップショット
    organization_id INTEGER NOT NULL,      -- 所属する末端断酒会（local）
    status TEXT NOT NULL DEFAULT 'applied'
        CHECK (status IN ('applied', 'confirmed', 'rejected', 'on_hold', 'retired')),
    applied_at TEXT NOT NULL DEFAULT (datetime('now')),
    confirmed_at TEXT,
    exception_note TEXT,                   -- 例外対応時のみ記録。通常は空
    linked_user_account_id INTEGER,        -- 同一人物のuser_accounts紐付け（任意）

    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (linked_user_account_id) REFERENCES user_accounts(id)
);
```

## アプリケーション側で担保する制約（DB制約にしない理由）

- 「1団体2名まで」はテーブル構造（専用カラム2つ）で自然に表現されるため、
  追加のCHECK制約は不要
- 登録処理時に「同一 organization_id の該当ロールが既に埋まっていないか」を
  アプリ側でチェックする

## 未確定・次に決めること

- `linked_user_account_id` を申請時点で自己申告してもらうか、後から手動紐付けか
- 都道府県以上の責任者・事務局情報を `organizations` 側にどう持たせるか
  （専用カラムか、別の軽量な参照テーブルか）
- GOGO側（Issue #1、チャッピー検討中）の `gogo_submissions` /
  `gogo_extracted_meetings` との接続方法。特に「未確認(applied)の
  contributor_accounts が投稿した情報」の扱い方針
- 責任者・事務局の交代フローの具体的な画面・操作手順

## 関連ドキュメント

- `danshu-de-go/docs/future-member-features.md`（会員登録全体のエンティティ整理、TBD2点は本メモで確定）
- `danshu-tools/docs/future-member-features-schema.md`（旧スキーマ案、本メモで更新方針を上書き）
- `danshu-de-go/docs/phase1-organizations-design.md`（organizations設計の前身）
- `tarachiri/dansyu-gogo` Issue #1（GOGO専用スキーマ検討、チャッピー担当）
