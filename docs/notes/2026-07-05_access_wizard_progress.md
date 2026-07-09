# 進捗記録：Cloudflare Access設定ウィザード進行中

作成: 2026-07-05 (かもちゃん / Claude Sonnet 5, claude.aiセッション)
関連: 2026-07-05_external_connectivity_confirmed_no_auth_yet.md（直前の記録）
実行者: まじまじさん本人（Cloudflareダッシュボード、ブラウザ操作）
※複数AI同時作業を想定し、このファイルは新規追加のみ。既存ファイルへの追記・上書きはしていません。

## 経緯（つまずいた点と解決）

1. Zero Trustの「ようこそ画面」からApplicationsメニューに進めず迷った
2. `switch-organizations`という無関係なCloudflare公式ドキュメントに一時的に迷い込んだが、
   これは今回のタスクと無関係と判断し無視
3. `/one/onboarding`のURLに遷移 → プラン選択画面が表示された
   → 根本原因確定：**このCloudflareアカウントはZero Trustの初回オンボーディングが
   未完了だった**ことが、Applications画面に辿り着けなかった真因
4. プラン選択を通過（Freeプランと思われるが詳細未確認）し、
   「Access でアプリケーションを定義する」ウィザードに到達

## ウィザード内の入力内容（ステップ1で確認済み）

- アプリケーション名: `danshu-wiki`
- 内部ホスト名: `wiki.nukadokonokai.com`（正しい、既存指示書と一致）
- プロトコル: HTTP
- ポート: **443を入力するよう案内**
  （外部公開用ホスト名に対するAccessポリシーのため、内部の8765ではなく
  外部から見たHTTPS標準ポートを指定する想定）

## 現在地：ステップ4「トンネルを割り当てる」

ここで選ぶべきトンネルは**`tyo`**（今回新規構築したWiki用トンネル、
ID: 6abc3be5-c808-4073-899d-efc7ee1fe12a）。

**`sasakibe`は絶対に選ばないこと**——これは別の本番サービス
（sbirts.nukadokonokai.com）用のトンネルであり、誤って選ぶと
今回のインシデント（DNS誤登録）と同種の混同が起きる。

## 次に確認すること

- ステップ4の選択肢一覧に`tyo`が表示されているか（未確認、スクリーンショット待ち）
- 表示されていれば`tyo`を選択して次へ進む
- 表示されていなければ、別途原因調査が必要（トンネル一覧の同期状態等）

## 完了済みの前提（変更なし、参照用）

- tyo上のWiki（MkDocs Material, 127.0.0.1:8765）稼働中
- tyoトンネル（6abc3be5...）systemd化済み、`cloudflared-wiki.service`で常時稼働
- DNS: `wiki.nukadokonokai.com` → tyoトンネルに正しく登録済み（`--overwrite-dns`で修正済み）
- 外部疎通確認済み（curl 200、ただし現状Access未設定＝認証なし状態のため今回の作業で解消する）
