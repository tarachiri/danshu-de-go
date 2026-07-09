# 課題メモ：Cloudflare Tunnel構成、根本原因確定（gen調査結果）

作成: 2026-07-05 (かもちゃん / Claude Sonnet 5, claude.aiセッション)
関連: 2026-07-05_cloudflare_tunnel_reality_check.md（tyo側調査、前段）
実行者: ふーちゃん (Claude Code, soi→genへSSH)
※複数AI同時作業を想定し、このファイルは新規追加のみ。既存ファイルへの追記・上書きはしていません。

## 確定した事実（gen側調査完了、変更は一切なし）

genで3つのcloudflaredプロセスが稼働：

| トンネル名 | ID | 実体 | 稼働場所 |
|---|---|---|---|
| nukadoko | 70c94070 | `/Users/mini2014/.cloudflared/config.yml` | gen (mini2014) |
| danshu-chat | 33b8fb13 | `danshu-chat.yml` | gen (mini2014) |
| nukadoko-bot | 794798d0 | token埋め込み型・ローカル定義なし（ダッシュボード管理） | 推定gen (root) ※未確定 |
| sasakibe | 67011626 | `/etc/cloudflared/config.yml`（tyo側で確認済み） | **tyo** (root, systemd) |
| tyo | 6abc3be5 | 認証情報jsonのみtyoに存在、config記述なし | **未使用** |

genの`nukadoko`トンネルのingressに、`api.nukadokonokai.com`・`bot.nukadokonokai.com`
・`sbirts.nukadokonokai.com`・`sbirts-api.nukadokonokai.com`・`nukadoko.nukadokonokai.com`
が定義されている。`danshu-chat`トンネルには`chat.nukadokonokai.com`。

## 根本原因（前回指示書のミスの本質）

Cloudflare Tunnelのingressの`service:`は、**そのcloudflaredデーモンが動いている
マシンのlocalhost**を指す。tyoとgenは別マシンなので、gen上のconfig.ymlに
`wiki.nukadokonokai.com → http://localhost:8765`と書いても、それは
**genのlocalhost:8765**を見にいくだけで、tyoで動いているWikiには絶対に届かない。

前回の指示書（2026-07-05_cloudflare_tunnel_access_setup.md）は
「既存のcloudflaredインフラに相乗りする」という発想自体は正しかったが、
「api/bot系の設定がtyo上にある」という前提が誤りだった。
正しくは「Wikiが動いているtyo自身の上のトンネル（sasakibeか、未使用のtyoトンネル）
に追加する」必要がある。

## 副次的に発見された既存の設定不整合（今回のタスクとは別件・対応不要）

`sbirts.nukadokonokai.com`が`sasakibe`（tyo）と`nukadoko`（gen）の
両方のconfigに重複定義されている。DNS上は1ホスト名=1トンネルのはずなので、
どちらか一方は実際には無効なデッド設定と推定される。
**今回は対応せず、記録のみ。次に触る人・AIへの申し送り事項。**

## 確定した次の方針

Wiki（tyo上で稼働）を公開するには、**tyo上で完結する経路**を選ぶ必要がある。
選択肢は2つ：

1. 既存の`sasakibe`トンネル（tyo, `/etc/cloudflared/config.yml`）のingressに
   `wiki.nukadokonokai.com → http://localhost:8765`を追加
2. 未使用の`tyo`トンネル（認証情報のみ存在、6abc3be5）用に新規config.ymlを作り、
   tyo上で別プロセスとして起動

→ 次のファイルで比較検討し、指示書を確定させる。
