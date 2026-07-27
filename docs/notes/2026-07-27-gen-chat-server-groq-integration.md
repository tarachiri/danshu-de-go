# gen-chat-server：Groq（llama-3.3-70b/8b）連携パッチ適用

作成日：2026-07-27
作成者：ふーちゃん（Claude Code, soi）
対象ファイル：
- `/Users/mini2014/gen-chat-server/main.py`（gen上、git管理外）
- `/Users/mini2014/gen-chat-server/gen-chat-v2.html`（gen上、git管理外）
- `/Users/mini2014/gen-chat-server/groq_provider.py`（gen上、まじまじさんが事前配置。中身未確認だったので今回読んで確認した）
- `/Users/mini2014/gen-chat-server/.env`（`GROQ_API_KEY`追加、まじまじさんが追記）

## 背景

まじまじさんから「gen-chat-server/main.pyへのGroq追加パッチ」という設計ドキュメント
（差分1〜4）を受け取り、実装・適用した。既存のOllama中継に加えて、`conv["model"]`が
Groq系モデル名（`llama-3.3-70b-versatile` / `llama-3.1-8b-instant`）の場合は
Groq APIを呼ぶよう分岐する変更。

## 前提条件の確認

適用前に`groq_provider.py`と`.env`の`GROQ_API_KEY`が未整備だった（設計ドキュメントの
前提が満たされていない状態）。まじまじさんに指摘したところ、その場で両方とも
配置・追記してもらい、以下を確認してから適用した。

- `groq_provider.py`は`httpx`で直接Groq APIを叩く実装（`groq`パッケージ非依存）。
  `call_groq_with_messages(messages, model_key)` → `GroqResponse(text=...)`、
  `GroqProviderError`、`GROQ_MODEL_LIST_ENTRIES`、`is_groq_model()`が
  設計ドキュメント通りのシグネチャで揃っていた
- 429リトライ・システムプロンプト先頭付与・タイムアウト30秒はgroq_provider.py側で実装済み

## 対応内容

1. バックアップ作成：
   - `main.py.bak-20260727-add-groq`
   - `gen-chat-v2.html.bak-20260727-add-groq`
2. `main.py`に3箇所パッチ（Python heredocで文字列置換、`ast.parse`で構文確認）
   - import追加（`from groq_provider import ...`）
   - `/models`エンドポイント：Ollama一覧に`GROQ_MODEL_LIST_ENTRIES`を追加して返す
     （Ollama接続失敗時もGroqだけは選べるようフォールバック）
   - `send_message()`：`is_groq_model(conv["model"])`で分岐し、Groq系なら
     `call_groq_with_messages()`、それ以外は従来通りOllama `/api/chat`
3. `gen-chat-v2.html`の`loadModels()`にラベル表示（`GROQ_LABELS`辞書、任意の差分4も適用）
4. launchdサービス`com.majima.gen-chat-server`（port 8100, `KeepAlive=true`）を
   `launchctl kickstart -k gui/501/com.majima.gen-chat-server`で再起動

## 検証結果

- 起動ログ（`uvicorn.error.log`）にトレースバックなし、`Application startup complete`
- `GET /gen-chat/models` → Ollamaモデル一覧末尾に`llama-3.3-70b-versatile` /
  `llama-3.1-8b-instant`が追加されて返る
- Groq `llama-3.1-8b-instant`（`use_rag=false`）で会話作成→送信→応答確認（正常）
- Groq `llama-3.3-70b-versatile`（`use_rag=true`）で会話作成→送信→応答確認
  （RAGコンテキスト付与も正常、断酒会についての説明が返った）
- 回帰確認：既存Ollama `qwen2.5:3b`でも会話作成→送信→応答確認（引き続き正常）
- テスト用に作成した会話3件（Groq×2、Ollama×1）はDELETE APIで削除済み

## 今後の注意点

- `.env`の`GROQ_API_KEY`は本ノートには記載していない（値は伏せた）。他機体で
  作業する際は`gen-chat-server/.env`を直接確認すること
- 現状`GROQ_MODEL_LIST_ENTRIES`はOllama接続失敗時のフォールバックにも入るため、
  Ollama側が落ちていてもGroqだけは選べる設計になっている（意図通り）
- `gen-chat-v2.html`側のラベル表示（差分4）はUI上の見た目調整のみで、動作には
  必須ではない
