# gen-chat-server：kanri画面にシステムプロンプト編集機能を追加

作成日：2026-07-27
作成者：ふーちゃん（Claude Code, soi）
対象ファイル：
- `/Users/mini2014/gen-chat-server/main.py`（gen上、git管理外）
- `/Users/mini2014/rag-server/rag-admin.html`（gen上、git管理外。`/gen-chat/kanri`で配信される実体）
- `/Users/mini2014/gen-chat-server/system_prompt.txt`（新規、gen上、git管理外）
- `/Users/mini2014/Library/LaunchAgents/com.majima.gen-chat-server.plist`（gen上）

## 背景

[2026-07-27-gen-chat-server-groq-integration.md](2026-07-27-gen-chat-server-groq-integration.md)
の作業中に判明した通り、システムプロンプト（「ぬかちゃん」人格設定）は
`groq_provider.py`内に`DEFAULT_SYSTEM_PROMPT`としてハードコードされており、
**Groq経路にしか適用されていなかった**（Ollama経路は`send_message()`で
システムプロンプトなしで会話履歴をそのまま`/api/chat`に渡していた）。

まじまじさんから`nukadokonokai.com/gen-chat/kanri`（RAG管理画面）に
プロンプト編集機能を追加したいと依頼があったため、上記の非対称性も
合わせて解消する形で実装した。

## 対応内容

1. バックアップ作成：
   - `main.py.bak-20260727-add-prompt-editor`
   - `rag-admin.html.bak-20260727-add-prompt-editor`
   - `com.majima.gen-chat-server.plist.bak-20260727-add-prompt-editor`
2. プロンプトを`/Users/mini2014/gen-chat-server/system_prompt.txt`に切り出し。
   初期値は従来の`DEFAULT_SYSTEM_PROMPT`と同じ文言にして、編集前の挙動を変えないようにした
3. `main.py`に`get_system_prompt()`を追加（`SYSTEM_PROMPT_PATH`はfile未存在時
   `DEFAULT_SYSTEM_PROMPT`にフォールバック）。Ollama分岐の`ollama_messages`先頭に
   `{"role": "system", "content": get_system_prompt()}`を追加し、Groq経路と
   同じプロンプトが効くようにした
4. `com.majima.gen-chat-server.plist`の`EnvironmentVariables`に
   `NUKACHAN_SYSTEM_PROMPT_PATH=/Users/mini2014/gen-chat-server/system_prompt.txt`
   を追加。これにより`groq_provider.py`の`_load_system_prompt()`（既存実装、
   同じ環境変数を見る設計だった）も同じファイルを参照するようになり、
   Ollama/Groq両経路が単一のプロンプトファイルを共有する構成になった
5. `main.py`に`GET /gen-chat/kanri-api/prompt`（現在値取得）・
   `POST /gen-chat/kanri-api/prompt`（更新、空文字は400で拒否）を追加。
   既存の`kanri-api/*`と同じく`require_kanri_auth`（Basic認証）で保護
6. `rag-admin.html`に「⑤ プロンプト設定（システムプロンプト）」セクションを追加。
   `textarea`＋保存／再読み込みボタン、ページロード時に現在値を自動取得
7. plistは`EnvironmentVariables`変更のため`launchctl kickstart -k`では反映されず、
   `launchctl bootout gui/501/com.majima.gen-chat-server` →
   `launchctl bootstrap gui/501 <plist>`で再読み込みした

## 検証結果

- `plutil -lint`でplist構文確認、`ast.parse`で`main.py`構文確認、いずれもOK
- 再起動後のログにトレースバックなし
- `GET /gen-chat/kanri-api/prompt`：認証なしは401、Basic認証ありで現在のプロンプトを返す
- `POST /gen-chat/kanri-api/prompt`にテスト文言（「テストぬかちゃん」「なのだ」語尾）を送信し、
  `system_prompt.txt`に書き込まれることを確認
- Ollama（`qwen2.5:3b`）・Groq（`llama-3.1-8b-instant`）の両方で会話送信し、
  どちらも「なのだ」語尾で応答することを確認 → 単一ファイルが両経路に効くことを確認できた
- 検証後、プロンプトを元の「ぬかちゃん」デフォルト文言に戻した
- テスト会話はすべてDELETE APIで削除済み
- ブラウザでの目視確認は、このセッションの環境からTailscale MagicDNS
  （`gen-3.taile44373.ts.net`）への到達性がなく実施できなかった。
  `curl -u maji:gen2014 http://127.0.0.1:8100/gen-chat/kanri`（gen上）で
  レンダリング済みHTMLに新セクションの要素が含まれることは確認済み。
  実機ブラウザでの見た目確認はまじまじさんにお願いしたい

## 今後の注意点

- プロンプトの編集履歴はバックアップを取っていない（`system_prompt.txt`は
  上書き保存のみ）。重要な文言変更をする際は事前に手元にコピーを残すことを推奨
- 保存時のバリデーションは「空文字拒否」のみ。文字数上限や不正な内容の
  チェックは入れていない
- ログ確認中、`llama-3.1-8b-instant`でGroqの無料枠TPM制限（6000/分）に
  よる413エラーが実運用で複数回発生していた（本パッチとは無関係の
  既存事象）。頻発するようなら`llama-3.3-70b-versatile`優先や
  レート制御の検討が必要かもしれない
