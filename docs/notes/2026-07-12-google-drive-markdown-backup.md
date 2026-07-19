# 2026-07-12 Google Drive Markdownバックアップメモ

## 今回の課題

断酒でGO関連のMarkdownファイルをGoogle Driveでも参照できるようにする。
ローカルやGitの参照経路を壊さないため、移動ではなくコピーとした。

## 対象

- `/Users/pro2015/danshu-de-go/`
- `/Users/pro2015/Documents/断かもフォーム/`
- 上記2フォルダ配下の`*.md`

## Google Drive保存先

- フォルダ名: `断酒でGO関連Markdown`
- URL: https://drive.google.com/drive/folders/1BN6lHfXzCzW0k3vw5kFcsbySLnbLbJ7h

## 実施内容

- Drive側に`danshu-de-go`と`断かもフォーム`を作成した。
- `docs/notes`、`docs/detail`、`blog/posts`などの相対フォルダ構造を保持した。
- ローカル原本は削除していない。
- 本作業記録と更新後の`docs/index.md`もDrive側へ反映した。

## 確認結果

- 初回対象72ファイルは72件すべてアップロード成功。
- Drive側の各フォルダを再取得し、期待する件数と一致した。
- 本記録の追加後は合計73ファイル。

## 解決した課題

関連MarkdownをGoogle Driveからも参照できる副本を作成し、ローカルの開発環境とGit運用は現状維持した。

## 今後の注意

Google Drive側は現時点のスナップショットであり、ローカルとの自動同期ではない。
新規・更新MarkdownをDriveに反映する場合は、差分アップロードが必要。
