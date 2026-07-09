# インシデント記録：wiki.nukadokonokai.com DNS誤登録

作成: 2026-07-05 (かもちゃん / Claude Sonnet 5, claude.aiセッション)
関連: 2026-07-05_cloudflare_tunnel_setup_v2.md（実行中の指示書）
実行者: ふーちゃん (Claude Code, tyo上)
※複数AI同時作業を想定し、このファイルは新規追加のみ。既存ファイルへの追記・上書きはしていません。

## 発生した事象

指示書のステップ2「DNS登録」で以下を実行：
```
cloudflared tunnel route dns tyo wiki.nukadokonokai.com
```

期待：`tyo`トンネル（ID: 6abc3be5...）へのCNAME作成
実際の結果：
```
Added CNAME wiki.nukadokonokai.com which will route to this tunnel
tunnelID=67011626-12fb-4e21-9f9b-3c8b3153dc04
```
→ `67011626...`は`sasakibe`トンネルのID。意図と異なるトンネルにCNAMEが向いた。

ふーちゃんは指示書の「進めず報告」ルールに従い、ここで停止・報告。
**この時点でステップ3（tyoトンネル起動）以降は未実施。実害は限定的。**

## 根本原因（暫定・確度高）

`cloudflared tunnel route dns <name>`コマンドは、`--config`オプションで
明示的に指定しない限り、**デフォルトのconfig.yml
（tyo上では`/etc/cloudflared/config.yml`、sasakibe用）を暗黙に参照する**
可能性が高い。この場合、コマンド引数の`tyo`という文字列は単なる
ラベル指定として扱われ、実際にルーティングされる先は
デフォルトconfigに書かれた`tunnel:`の値（＝sasakibeのID）になる。

**指示書側の不備**：ステップ2で`--config ~/.cloudflared/tyo-wiki-config.yml`を
明示的に指定するコマンドにしていなかったことが直接原因。
（v2指示書のステップ1では`--config`を使っていたが、ステップ2のroute dnsコマンドに
同様の明示指定が抜けていた。）

## 現状のリスク評価

- `wiki.nukadokonokai.com`のCNAMEレコードは現在**sasakibe（67011626...）を指している**
- sasakibeのconfig.yml（`/etc/cloudflared/config.yml`）には
  `wiki.nukadokonokai.com`のingressルールが**無い**ため、
  現状アクセスすると404になるだけ（Wikiには繋がらないが、実害もない）
- **sbirts.nukadokonokai.com（本番稼働中、sasakibe担当）への影響はゼロ**
  （sasakibeのconfig.yml自体は変更されていないため）

## 次のアクション

1. まず読み取り調査のみ許可：なぜ`--config`未指定でsasakibeが選ばれたか、
   cloudflaredのデフォルト参照順序を確認
2. 誤登録されたCNAMEを削除し、`--config`を明示した正しいコマンドで
   tyoトンネルに向け直す
3. 修正版の指示書（v3）を作成し、以降のroute dnsコマンドには
   必ず`--config`を明示する

## この教訓（今後の指示書作成ルールへの反映）

cloudflaredの`tunnel`サブコマンドを使う際は、**すべてのコマンドに`--config`を
明示すること**。これを標準ルールとして以降の指示書に組み込む。
