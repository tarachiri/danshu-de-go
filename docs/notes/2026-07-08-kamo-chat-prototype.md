# 2026-07-08 かもちゃんチャット登録 試作メモ

## 今日の課題

- 断酒でGOGOを、かもちゃんとのチャット形式で登録できるようにする。
- まずは自由会話AIではなく、必要項目を順番に聞く安全な登録チャットとして試作する。

## 変更したこと

- 画面に「かもちゃんと登録」パネルを追加した。
- かもちゃんが以下を順番に聞くようにした。
  - 投稿者
  - 団体
  - 例会名
  - 会場
  - 住所
  - 日付
  - 開始時間
  - 終了時間
  - 開催パターン
  - 備考
- 最後に「登録」と入力すると、投稿済みデータとしてWeb一覧へ追加するようにした。
- 下書き内容をチャット下に表示するようにした。
- 「最初から」ボタンでチャット入力をやり直せるようにした。

## 確認したこと

- ローカルの `app/app.js` は構文チェックを通過した。
- GitHubの `tarachiri/dansyu-gogo` に `index.html`, `styles.css`, `app.js` の更新を反映した。
- GitHub上の `index.html` に「かもちゃんと登録」が入っていることを確認した。
- GitHub上の `app.js` に `chatSteps` が入っていることを確認した。

## 注意点

- 現在、GitHub Pagesは `CNAME` により `dansyu-gogo.nukadokonokai.com` へ向く。
- まだCloudflare DNS側で `dansyu-gogo` のCNAMEが未設定または未反映の場合、`https://tarachiri.github.io/dansyu-gogo/` もカスタムドメインへ転送されて名前解決で止まる。
- Cloudflareで `dansyu-gogo` CNAMEを `tarachiri.github.io` に向ける必要がある。

## 次の課題

- Cloudflare DNS設定後、`https://dansyu-gogo.nukadokonokai.com/` で表示確認する。
- チャット入力の途中修正に対応する。
- 日付と時間の入力チェックを強くする。
- かもちゃんチャットから、既存の前回入力テンプレートを呼び出せるようにする。

## 2026-07-08 追加変更

- メニューの「Web一覧」と「HTML表」を同じ画面として扱うようにし、タブ名を「Web一覧・HTML表」に変更した。
- 「本体連携」を「データ提供」に変更し、タブを押すとファイルから登録・JSON提供の画面へ移動するようにした。
- 「かもちゃんと登録」を画面の一番上へ移動した。
- 「フォーム直接入力」は折りたたみではなく、専用タブで画面遷移する形に変更した。
- 断酒でGO本体の `schedule.json` から40件を抽出した `production-test-data.json` を作り、GOGO試作へテスト投入できるボタンを追加した。

## 2026-07-08 確認

- `app/app.js` の構文チェックを通過した。
- `production-test-data.json` は40件として読み込めることを確認した。
- 既存の本番データは直接変更せず、GOGO試作用のコピーとして投入する方式にした。
- GitHubの `tarachiri/dansyu-gogo` に `index.html`, `styles.css`, `app.js`, `production-test-data.json` を反映した。

## 2026-07-08 かもちゃん表示修正

- 「かもちゃんと登録」が白い作業枠の中に入って入れ子に見えていたため、`.workspace` の外へ移動した。
- 見出し、説明文、チャット本文、下書き表示の文字サイズを大きくした。
- ローカルで `かもちゃんと登録` が `.workspace` の前にあることを確認した。
- GitHubの `tarachiri/dansyu-gogo` に `index.html`, `styles.css` の更新を反映した。

## 2026-07-08 meetings DB表ページ追加

- HTML表エリアに「DB表を開く」ボタンを追加した。
- 別ページ `meetings-table.html` を追加し、`meetings` をDBのようにカラムごとに表示するようにした。
- 表示カラムは `id`, `状態`, `日付`, `開始`, `終了`, `団体`, `例会名`, `会場`, `住所`, `投稿者`, `パターン`, `備考`, `source` とした。
- `meetings-table.js` で通常画面と同じ `localStorage` の `meetings` を読み込むようにした。
- `meetings-table.css` で横スクロール、固定ヘッダー、14px本文、広い住所・備考カラムを設定した。
- ローカルで `app/app.js` と `app/meetings-table.js` の構文チェックを通過した。
- GitHubの `tarachiri/dansyu-gogo` に `index.html`, `meetings-table.html`, `meetings-table.js`, `meetings-table.css` を反映した。

## 2026-07-08 meetings 表計算風表示

- `meetings-table.html` のテーブルヘッダーをJS描画に変更し、スキーマ行を表示できるようにした。
- `meetings-table.js` に `schemaColumns` を追加し、列名・キー名・型・説明を1つの定義から描画するようにした。
- 表の上段にA/B/C形式の列番号、左側にレコード番号、2段目にスキーマ情報を表示するようにした。
- `meetings-table.css` で2段固定ヘッダー、左固定の行番号、スキーマ情報の文字サイズを調整した。
- ローカルで `app/meetings-table.js` の構文チェックを通過した。
- GitHubの `tarachiri/dansyu-gogo` に `meetings-table.html`, `meetings-table.js`, `meetings-table.css` を反映した。

## 2026-07-08 MCP tyo/gen 追加確認

- CodexのMCP設定は `/Users/pro2015/.codex/config.toml` にあり、現在は `node_repl` のみ登録されていることを確認した。
- `tyo` と `gen` へのSSH疎通は確認できた。
  - `tyo`: `hostname` が `tyo` として応答。
  - `gen`: `hostname` が `gen` として応答。
- `tyo` / `gen` をMCP化するには、CodexからSSH経由で各マシンへコマンド実行できるサーバーを追加する必要がある。
- この変更は将来の操作権限が広がるため、明示承認を得てから実装する。

## 2026-07-08 MCP tyo/gen 追加完了

- ユーザーの明示承認後、Codex本体設定に `tyo` と `gen` のMCPサーバーを追加した。
- 変更前に `/Users/pro2015/.codex/config.toml.bak-20260708-tyo-gen-mcp` へバックアップを作成した。
- MCPサーバー本体は `/Users/pro2015/.codex/mcp_servers/ssh_exec_mcp.py` に追加した。
- 追加したMCPは、それぞれ固定ホスト `tyo` / `gen` にSSHし、`exec` ツールでコマンド実行結果を返す。
- `codex mcp list` で `tyo` / `gen` が `enabled` として表示されることを確認した。
- MCPの手動呼び出しで `tyo` / `gen` の `hostname; date` が正常に返ることを確認した。
- 現在の会話にツールとして出るかはCodex側のMCP再読み込みタイミングに依存するため、必要ならアプリ再起動または新しい会話で確認する。
