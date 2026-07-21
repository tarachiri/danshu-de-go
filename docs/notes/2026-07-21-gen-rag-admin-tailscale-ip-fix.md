# gen rag-admin.html：Tailscale IP不一致による接続不可の修正

作成日：2026-07-21
作成者：ふーちゃん（Claude Code, soi）
対象ファイル：`/Users/mini2014/gen-chat-server/rag-admin.html`（gen上、git管理外）

## 背景

まじまじさんが`file:///Users/mini2014/gen-chat-server/rag-admin.html`を開いたところ
「接続できません」と報告。rag-admin.htmlは国立国会図書館デジタルコレクションの
検索・取り込み・RAG検索テストを行うgen上の運用管理画面（HTML単体、バックエンドは
gen上のuvicorn API）。

## 調査経路

1. soiから`ssh mini2014@192.168.0.22`でgenに接続確認 → OK
2. ファイル自体は存在（`/Users/mini2014/gen-chat-server/rag-admin.html`、11.5KB、7/14更新）
3. HTML内の接続先設定（`#hostInput`のデフォルト値）が`http://100.69.98.47:8200`と
   ハードコードされていた
4. gen上で`lsof`確認 → バックエンドは`localhost:8200`で正常稼働中（`curl localhost:8200/documents` → HTTP 200）
5. しかし`curl http://100.69.98.47:8200/documents`はタイムアウト（exit 28）
6. gen上のTailscale CLI（`/Applications/Tailscale.app/Contents/MacOS/Tailscale ip -4`）で
   現在のgen自身のTailscale IPを確認 → **`100.115.171.32`**（HTMLに書かれた
   `100.69.98.47`とは別IP）

## 根本原因

genのTailscale IPが何らかのタイミングで`100.69.98.47`→`100.115.171.32`に変わっており、
rag-admin.html側のデフォルト接続先が追従していなかった。バックエンドAPI自体は
正常稼働していたため、「バグ」ではなく「静的HTMLに書かれたIPが古くなっていた」だけ。

## 対応内容

1. genの現行ファイルをバックアップ：
   `/Users/mini2014/gen-chat-server/rag-admin.html.bak-20260721-fix-tailscale-ip`
2. `sed`でデフォルト値を書き換え：
   `http://100.69.98.47:8200` → `http://100.115.171.32:8200`
3. 修正後、gen上から`curl http://100.115.171.32:8200/documents` → HTTP 200で疎通確認済み

## 今後の注意点

- genのTailscale IPは変動しうる。同様の「静的ファイルにIPをハードコード」している
  他のツール（他にもgen上に運用画面があれば）がないか、気づいたら同じ手口で確認する
- gen機のTailscale CLIは`/Applications/Tailscale.app/Contents/MacOS/Tailscale`に
  あり、PATHには入っていない（`tailscale`コマンド単体では`command not found`）
