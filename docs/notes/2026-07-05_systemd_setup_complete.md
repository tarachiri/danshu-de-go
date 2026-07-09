# 進捗記録：cloudflared-wiki systemdサービス化 完了

作成: 2026-07-05 (かもちゃん / Claude Sonnet 5, claude.aiセッション)
関連: 2026-07-05_dns_fixed_systemd_pending.md（直前の記録）
実行者: まじまじさん本人（tyoに直接SSH、sudo権限操作のため）
※複数AI同時作業を想定し、このファイルは新規追加のみ。既存ファイルへの追記・上書きはしていません。

## 完了内容

`/etc/systemd/system/cloudflared-wiki.service` を作成し、有効化・起動。

```
● cloudflared-wiki.service - Cloudflare Tunnel for Wiki (tyo tunnel)
     Loaded: loaded (enabled)
     Active: active (running) since Sun 2026-07-05 14:47:26 JST
   Main PID: 1888641 (cloudflared)
```

sudoが必要な操作だったため、方針通りまじまじさん本人が実行
（AIにパスワードを共有しない方針を維持、2026-07-05_dns_fixed_systemd_pending.md参照）。

既存の`cloudflared.service`（sasakibe用、sbirts.nukadokonokai.com担当）とは
別ユニット・別プロセスとして分離されているため、既存本番サービスへの影響なし。

## 現在の全体構成（2026-07-05時点）

| トンネル名 | ホスト名 | 稼働マシン | サービス名 | 状態 |
|---|---|---|---|---|
| sasakibe | sbirts.nukadokonokai.com | tyo | cloudflared.service | 稼働中（既存・無変更） |
| tyo | wiki.nukadokonokai.com | tyo | cloudflared-wiki.service | **稼働中（今回新規）** |
| nukadoko | api/bot/sbirts等.nukadokonokai.com | gen | (mini2014, config.yml) | 稼働中（既存・無変更） |
| danshu-chat | chat.nukadokonokai.com | gen | (mini2014, danshu-chat.yml) | 稼働中（既存・無変更） |
| nukadoko-bot | 不明 | 推定gen（root, token方式） | 不明 | 未確認・今回対象外 |

## 次のアクション

1. ステップ5：`curl https://wiki.nukadokonokai.com/`で外部疎通確認（認証なし、200期待）
2. ステップ6：Cloudflare Accessでアプリケーション設定（まじまじさんがダッシュボードで実施）
3. ステップ7：Service Token込みの疎通確認

## 未対応の申し送り事項（継続）

- `sbirts.nukadokonokai.com`がsasakibe（tyo）とnukadoko（gen）の両方に
  重複定義されている件（対応不要・記録のみ、2026-07-05_gen_investigation_root_cause.md参照）
- `nukadoko-bot`トンネルの稼働実態が未確認（token埋め込み型、デコード未実施）
