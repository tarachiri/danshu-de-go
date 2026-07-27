# tyo DNS障害〜AdGuard Home導入完了（かもちゃんへ申し送り）

作成日: 2026-07-27
作成者: ふーちゃん（Claude Code, soi）
詳細版（Google Drive）: https://docs.google.com/document/d/1GVxmElWVMeKxlzdvm8F8AwueRZub_fLD79NydLLA42E/edit

## 要約

GOGO投稿レビュー画面（`gogo_review_app.py`、tyo）の「記事生成」ボタンが
動かない件を調査した結果、2つの問題が見つかり、両方対応した。

1. `gogo_review_app.py`の`GEN_SSH_HOST`が古いTailscaleホスト名
   `gen-3.taile44373.ts.net`のままだった（Tailscale側で`gen`にリネーム済み）。
   → `gen.taile44373.ts.net`に修正、バックアップ
   `gogo_review_app.py.bak-20260727-fix-gen-hostname`。**`gogo-review.service`の
   再起動がまだ未実施**（sudoが要るためまじまじさんに依頼中）。
2. さらに根本で、**tyo自体のDNS解決がシステム全体で壊れていた**。原因は
   `ADGUARD_HOME_SETUP.md`（かもちゃん作成、2026-07-25付）のステップ[0]〜[3]は
   実施済みだったが、**ステップ[4]の`docker compose up -d`が未実行のまま
   2日間放置**されていたこと。`DNSStubListener=no`だけが先に効いていて、
   AdGuard Homeが127.0.0.1:53に居ない状態だった。

## かもちゃんへのお願い：`ADGUARD_HOME_SETUP.md`への追記

導入を完了させる過程で、手順書に無かった以下2点が必要だったので、
次に手順書を更新する際に反映してほしい：

1. **アップストリームDNSに`[/ts.net/]100.100.100.100`を追加する手順が抜けている**
   （Tailscale併用環境では必須。無いとAdGuard導入後にTailscaleホスト名が
   解決できなくなり、今回の発端と同じ問題が再発する）
2. **ステップ[4]を飛ばした場合の危険性の注意書きが無い**
   （`DNSStubListener=no`だけ先に適用されると、AdGuard未起動のまま
   DNSが機能停止する「危険な中間状態」になる。今回まさにこれで2日間気づかず放置）

作業中、YAMLに`[`始まりの値を無クォートで追記してAdGuard Homeを
クラッシュループさせてしまう自爆もあった（`docker cp`で復旧済み）。
手順書にYAML編集時の注意も書いておくと親切かもしれない。

詳しい経緯・検証ログはGoogle Drive版を参照。
