# 2026-07-10 GOGO用organizationsテーブルの命名衝突と解決

作成: ふーちゃん（Claude Code, soi）

## 経緯

GOGO（`tarachiri/dansyu-gogo`）の会員登録スキーマ確定版
（かもちゃん作成、GOGO側 `docs/notes/2026-07-10-gogo-schema-review-response.md`）を
tyoのdanshu.dbに実装できるか確認するため、`sqlite3 danshu.db '.tables'` /
`.schema` を読み取り専用で実行した。

## 判明したこと

- `organizations` / `contributor_accounts` / `user_accounts` はtyoに未作成（新規追加は可能）。
- ただし `org_hierarchy`（id, level, level_value, parent_id, is_independent, ...）が
  既に存在（中身は空）。これは本リポジトリの
  [phase1-organizations-design.md](../phase1-organizations-design.md) で設計した、
  venues/meetingsの組織名寄せ用 `organizations` / `organization_hierarchy` の受け皿。
- GOGO確定版スキーマの `organizations`（責任者・事務局の権限管理が目的）とは
  **名前は同じだが目的が全く別**。両方を同じ名前でtyoのdanshu.dbに作ると混乱する。

## 決定

まじまじさんと相談し、GOGO用テーブルは **`gogo_organizations`** にリネームして
名前空間を分けることにした。カラム構成・制約・インデックスはそのまま、
テーブル名と自己参照・外部キー参照先のみ変更。

phase1設計側の`organizations`（本体venues/meetings用）は今回は未着手のまま。
将来実装時に既存の`org_hierarchy`を流用するか作り直すかは別途判断する。

## 関連ドキュメント

- [phase1-organizations-design.md](../phase1-organizations-design.md)（本体側organizations設計、未実装）
- GOGO側 `docs/notes/2026-07-10-gogo-schema-review.md`（ふーちゃんによる精査）
- GOGO側 `docs/notes/2026-07-10-gogo-schema-review-response.md`（かもちゃん確定版＋本件追記）
- `tarachiri/dansyu-gogo` Issue #1
