# 2026-07-10 GOGO・会員登録スキーマ精査メモ

## 対象

かもちゃん案の以下2テーブルを精査した。

- `organizations`
- `contributor_accounts`

※ `user_accounts` は `danshu-de-go/docs/2026-07-10-member-registration-schema-draft.md`
側に案があるため、ここでは接続前提だけ確認する。

## 結論

方向性は良い。

- 一般利用者 `user_accounts` と運営参加者 `contributor_accounts` を分ける方針は妥当。
- 末端断酒会の責任者・事務局を `organizations` 側の専用カラムで持つ案は、
  「1団体1名ずつ」をシンプルに表現できる。
- 電話確認前の `applied`、確認済みの `confirmed`、退任の `retired` を分けるのも良い。

ただし、このまま実装すると後で詰まりやすい点がある。

## 実装前に決めるべき点

### 1. `organizations` は本体の組織マスタか、権限管理用の簡略マスタか

過去の `phase1-organizations-design.md` では、
都道府県ごとに階層が違うため `organization_hierarchy` で可変階層を扱う案だった。

今回の案は、

```text
local -> prefecture
```

を1回辿れば削除権限を判定できる、という実務目的に寄せた簡略設計になっている。

これは悪くないが、次のどちらかを明示した方がよい。

- A案: `organizations` は本体の正式な組織マスタとして使う。
  - その場合、`parent_organization_id` は national / block / prefecture / local の全階層で使う。
  - 例: block -> national, prefecture -> block, local -> prefecture。
- B案: 今回の `organizations` は会員・権限管理用の簡略マスタとして使う。
  - その場合、既存の可変階層案とは別物として扱う。
  - 後で本体組織マスタと突き合わせるためのIDや対応表が必要。

現時点のおすすめはA案。
削除権限の判定では local から parent を1回辿れば都道府県に届く設計にしておけば、
階層全体を持っていても実装は複雑にならない。

### 2. コメントだけでは制約にならない

以下はコメント上の前提で、SQLiteの制約としては効かない。

- `contributor_accounts.organization_id` は local のみ
- `representative_contributor_id` / `secretariat_contributor_id` は local のみ
- `local.parent_organization_id` は prefecture のみ

SQLiteの `CHECK` は別テーブルの値を見られないため、
必要ならトリガーかアプリ側バリデーションで守る。

初期実装ではアプリ側チェックでもよいが、最低限スクリプト側に共通関数として寄せる。

### 3. `organizations` と `contributor_accounts` は循環参照になる

`organizations` が責任者・事務局として `contributor_accounts` を参照し、
`contributor_accounts` も所属先として `organizations` を参照している。

この構造自体は許容できる。
ただし登録手順は次の順番になる。

1. `organizations` を責任者・事務局NULLで作る。
2. `contributor_accounts` を作る。
3. `organizations.representative_contributor_id` / `secretariat_contributor_id` を更新する。

この手順を仕様に書いておかないと、初期投入スクリプトで混乱しやすい。

### 4. `line_user_id UNIQUE` は強い制約

`line_user_id TEXT UNIQUE NOT NULL` にすると、
1つのLINEアカウントは1つの断酒会にしか紐づけられない。

まじまじさんの現時点の想定が「1人1団体」ならこれでよい。
ただし、次のようなケースがあり得るなら将来詰まる。

- 同じ人が複数の末端断酒会の事務局を兼ねる。
- 都道府県断酒会の担当者が複数団体の投稿を代行する。
- 高齢者の代理で家族や事務局が複数団体分を扱う。

迷う場合は、初期から `UNIQUE(line_user_id, organization_id)` にしておく方が柔らかい。
ただし本人確認をLINE単位で扱いたいなら、将来的には
LINE本人を表すテーブルと、団体ごとの権限テーブルを分ける方が綺麗。

### 5. 状態と日時の整合性

`status='confirmed'` なのに `confirmed_at IS NULL` などが起こり得る。

初期実装ではアプリ側でよいが、確認処理は必ず
`status` と `confirmed_at` を同時更新する。

退任時は `confirmed_at` を残したまま `status='retired'` にする。
必要なら `retired_at` を追加する。

### 6. 削除より退任を基本にする

責任者・事務局の交代履歴を残す方針なら、
`contributor_accounts` は物理削除しない前提がよい。

FKの方針としては以下が自然。

- `organizations.parent_organization_id`: `ON DELETE RESTRICT`
- `representative_contributor_id` / `secretariat_contributor_id`: 基本は削除しないため `RESTRICT` でもよい
- `linked_user_account_id`: 利用者アカウント削除時は `SET NULL` が扱いやすい

### 7. インデックスが必要

初期から最低限ほしい。

```sql
CREATE INDEX idx_organizations_type ON organizations(organization_type);
CREATE INDEX idx_organizations_parent ON organizations(parent_organization_id);
CREATE INDEX idx_contributors_org_status ON contributor_accounts(organization_id, status);
CREATE INDEX idx_contributors_line_user ON contributor_accounts(line_user_id);
```

### 8. GOGO投稿テーブルとは分ける

この案は会員・権限管理の核としては良い。
ただし、GOGOの投稿受付には別途テーブルが必要。

例:

- `gogo_submissions`
- `gogo_submission_files`
- `gogo_extracted_meetings`
- `gogo_review_decisions`

GOGO側では、投稿者が `confirmed` かどうかにかかわらず原本は保存する。
ただし公開反映の扱いを変える。

- `confirmed` 投稿者: 将来は自動反映候補にできる。
- `applied` / 未紐付け投稿者: 受信はするが、必ず人間確認。

## 現時点の修正版方針

最小修正で進めるなら、かもちゃん案に以下を足す。

- `organizations.updated_at`
- `contributor_accounts.updated_at`
- 必要なら `contributor_accounts.retired_at`
- `linked_user_account_id` は `ON DELETE SET NULL`
- local/prefecture制約はアプリ側チェックまたはトリガーで担保
- `line_user_id UNIQUE` を維持するか、`UNIQUE(line_user_id, organization_id)` にするか決める
- `parent_organization_id` を全階層で使うか、localのみの簡略用途にするか決める

## 優先確認事項

1. 1つのLINE IDが複数団体の責任者・事務局を兼ねる可能性を許すか。
2. `organizations` は本体正式マスタにするか、会員・権限用の簡略マスタにするか。
3. local/prefecture等の制約をDBトリガーで守るか、アプリ側で守るか。
4. 責任者と事務局は同一人物でもよいか。

この4点が決まれば、スキーマ案は実装可能な形に落とせる。
