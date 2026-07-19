# gen: Tailscale導入と外出先アクセス確立 (2026-07-13)

## 目的
genのOllama APIに、外出先(モバイル回線、Wi-Fi外)からもアクセスできるようにする。

## 実施内容
1. genに `brew install --cask tailscale` でTailscaleをインストール
2. genとiPhoneを同じTailscaleアカウント(`majimakenta@`)でログイン
3. `tailscale ip -4` でgen自身のTailscale IPを確認 → **`100.69.98.47`**(デバイス名 `gen-1`)

## つまずいた点
- genのTailscaleを何度かログアウト/ログインした結果、同一マシンなのに複数のデバイス名(`gen`, `gen-1`, `node`)が重複登録されてしまった。
- `tailscale status` の一覧では紛らわしいので、**自分自身のIPを知りたい時は `tailscale ip -4` を使うのが確実**(他のデバイス一覧に惑わされない)。
- 古い重複登録(`gen` = 100.111.176.44、offline)は未整理。後でTailscale管理画面 (https://login.tailscale.com/admin/machines) から削除するとスッキリする。

## 検証結果
- iPhoneのSafariでWi-Fiをオフにし、モバイル回線のみの状態で `http://100.69.98.47:11434/api/tags` にアクセス → genのモデル一覧JSONが正常に返り、**外出先からのアクセスに成功**。

## 成果物の更新
- `gen-chat.html` の接続先をLAN IP(`192.168.0.22`)からTailscale IP(`100.69.98.47`)に変更。
  - Tailscaleが有効な状態なら、自宅LAN内・外出先どちらからでも同じURLでアクセス可能。

## 注意点 (次回作業時)
- genのOllamaサーバー(`ollama serve`)は `export OLLAMA_HOST=0.0.0.0:11434` / `export OLLAMA_ORIGINS="*"` のセッション限定設定で動いている。**genを再起動した場合、この2行を再実行してから `ollama serve` すること**(詳細は `gen-ollama-setup-2026-07-13.md` 参照)。
- TailscaleのIPアドレスはデバイス側で変わることがある。繋がらない場合はまず `tailscale ip -4` で現在のIPを再確認する。

## 次のステップ (未着手)
- genのOllama起動設定を永続化する(再起動しても自動で正しい設定で立ち上がるようにする、例: launchdへの登録)
- 重複したTailscaleデバイス登録の整理
- 将来的にSwiftUI(iOSアプリ)からTailscale経由でgenのOllama APIを呼び出す形に発展させる
