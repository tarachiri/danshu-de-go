# 課題メモ：Codex用アクセス追加後、403エラー発生・3ポリシー混在

作成: 2026-07-05 (かもちゃん / Claude Sonnet 5, claude.aiセッション)
関連: 2026-07-05_wiki_access_task_complete.md（Wiki公開完了時点の記録）
※複数AI同時作業を想定し、このファイルは新規追加のみ。既存ファイルへの追記・上書きはしていません。

## 背景

かもちゃん用のWiki認証（Service Token: kamochan-wiki-access）構築完了後、
ChatGPT Codexにも同様にWikiを読ませたいという要望が発生。
Codex用に別のService Tokenを新規発行する方針を検討していたところ、
まじまじさんが自らCloudflare画面から`codexxx`・`wiki_kamo_codex`という
2つのポリシーを新規作成していたことが判明。

## 発生した問題

danshu-wikiアプリに現在3つのポリシーが存在：
- `kamochan-wiki-access`
- `codexxx`
- `wiki_kamo_codex`

この状態で、既存のかもちゃん用トークン
（Client ID: [redacted、公開リポジトリのため伏字]）を使った
curlアクセスが**403**になった（Codexが実行・報告、まじまじさん経由で共有）。

以前（2026-07-05_wiki_access_task_complete.md）は同じトークンで
200が返っていたことを確認済みだったため、ポリシー追加によって
既存のアクセスが壊れた可能性が高い。

## 根本原因の仮説（未検証）

1. 新規ポリシー追加時、既存の`kamochan-wiki-access`ポリシーの
   Include設定（Selector: Service Token, Value）が
   誤って変更・上書きされた可能性
2. Cloudflare AccessのポリシーはOR評価が基本だが、
   新規ポリシーの追加方法によってはAND評価相当になる設定
   （Require等）を誤って使ってしまった可能性
3. その他未確認の設定ミス

## 次のアクション

1. `kamochan-wiki-access`・`codexxx`・`wiki_kamo_codex`の
   3つのポリシーそれぞれを開き、Include欄の
   Selector: Service Token / Valueに何が指定されているか確認
2. 特に`kamochan-wiki-access`の中身が、意図した
   トークン（1a769d7b...access）を指しているか最優先で確認
3. 原因特定後、修正して再度curl疎通確認

## セキュリティ上の注意（Codexからの提案、対応要検討）

Codexの分析メッセージ内で「貼ってくれたSecretは確認後にローテーション推奨」
との指摘があった。これは、Client Secretをこの会話・Codexとの
やり取りの両方に露出させたことを踏まえた妥当な助言。
対応（トークンのローテーション）は今回の403原因究明後に検討する。
