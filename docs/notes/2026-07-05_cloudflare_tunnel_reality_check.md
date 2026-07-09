# 課題メモ：Cloudflare Tunnel構成、指示書前提の誤りが判明

作成: 2026-07-05 (かもちゃん / Claude Sonnet 5, claude.aiセッション)
関連: 2026-07-05_cloudflare_tunnel_access_setup.md（誤った前提の指示書）
実行者: ふーちゃん (Claude Code, soi→tyoへSSH)
※複数AI同時作業を想定し、このファイルは新規追加のみ。既存ファイルへの追記・上書きはしていません。

## 発覚した問題：指示書の前提がtyoの実環境と食い違っていた

`2026-07-05_cloudflare_tunnel_access_setup.md`は「tyo上に`api.nukadokonokai.com` /
`bot.nukadokonokai.com`用のcloudflared設定があり、既存config.ymlに1エントリ足すだけ」
という前提で書いたが、これは誤りだった。

## ふーちゃんの調査結果（tyo側、sudo不使用で確認）

tyo上で実際に稼働しているcloudflaredは以下の1つのみ：

```
/usr/bin/cloudflared --no-autoupdate --config /etc/cloudflared/config.yml tunnel run
(root権限、systemd cloudflared.service、active/running)
```

`/etc/cloudflared/config.yml`の中身：
```yaml
tunnel: 67011626-12fb-4e21-9f9b-3c8b3153dc04   # トンネル名: sasakibe
credentials-file: /home/maji/.cloudflared/67011626-...json
ingress:
  - hostname: sbirts.nukadokonokai.com
    service: http://localhost:80
  - service: http_status:404
```

`cloudflared tunnel list`には他に4つのトンネルが登録されている：

| NAME | ID | 状況 |
|---|---|---|
| danshu-chat | 33b8fb13... | tyo上に認証情報ファイルなし。稼働場所不明（gen疑い） |
| nukadoko | 70c94070... | 同上（api.nukadokonokai.com用と推定） |
| nukadoko-bot | 794798d0... | 同上（bot.nukadokonokai.com用と推定） |
| tyo | 6abc3be5... | tyo上に認証情報ファイルなし。名前と裏腹に未使用の可能性 |
| sasakibe | 67011626... | **これだけtyo上で実際に稼働中**（sbirts.nukadokonokai.com） |

tyo上の認証情報ファイルは`67011626...json`と`6abc3be5...json`の2つのみ確認。
つまり`danshu-chat`・`nukadoko`・`nukadoko-bot`はtyo上で動く前提の認証情報すら無い。

## 根本原因の暫定仮説

これまでの記憶では「api.nukadokonokai.com / bot.nukadokonokai.com はgen上で
cloudflaredトンネルとして動いている」という情報があった。これはgen側の話であり、
tyo側の話と混同して指示書を書いたのが今回のミスの根本原因。

## 次のアクション（このあと着手）

ふーちゃんがgenにもSSHアクセス可能と確認できたため、gen側の実態調査指示書を
別ファイルで作成し、以下を確認する：

1. genで`nukadoko`・`nukadoko-bot`・`danshu-chat`トンネルが実際に稼働しているか
2. genのcloudflared config.ymlの中身（ingressのhostname一覧）
3. Wiki用エントリをどのトンネル・どのマシンに追加するのが適切か
   （tyo上のsasakibeに相乗りは筋が違うため非推奨、gen側の適切なトンネルへの追加を検討）

## 変更は一切実施していない

ふーちゃんは指示書の「進めず報告」ルールに従い、config.ymlや DNS設定への変更を
一切行っていない。tyo上のsbirts.nukadokonokai.com（本番稼働中と思われる）への
影響はゼロ。
