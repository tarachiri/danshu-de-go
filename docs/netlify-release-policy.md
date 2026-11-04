<!-- ファイル名: netlify-release-policy.md -->

# Netlify本番公開の回数制御

【要約＆感想】
- 何をしたか：日々の例会情報はGitHubへ保存しながら、利用者向けサイトの公開を毎週月曜・木曜と緊急時にまとめる仕組みを定めました。
- なぜ嬉しいか：限られた無料枠を守りつつ、断酒会の誤案内修正など、本当に急ぐ更新のための余裕を残せます。
- ひとこと感想：回復を支える情報を止めないために、更新の速さと運用の持続性を両立させる一歩です。

## 目的

`main`への日々の自動pushと、Netlifyの本番デプロイを分離する。
GitHubには毎日の更新履歴を残し、Netlifyは公開専用ブランチ
`netlify-production`が更新されたときだけ本番デプロイする。

```text
tyoの日次生成 → main（毎日保存）
                   ↓ 月曜・木曜 05:30 JST／緊急時だけ昇格
              netlify-production
                   ↓ Netlifyが本番デプロイ
              Cloudflare → 本番URL
```

## 公開スケジュール

- 定期公開：毎週月曜・木曜 05:30（日本時間）
- 緊急公開：誤案内修正、緊急非公開など、待てない変更に限定
- 変更がない場合：公開ブランチを更新せず、デプロイを発生させない
- 想定上限：定期公開は月8〜10回、緊急公開は月4回を運用上の目安とする

GitHub ActionsのcronはUTCなので、ワークフローでは
日曜・水曜 20:30 UTC（日本時間では翌日の月曜・木曜 05:30）を指定する。

## GitHub側の実装

`.github/workflows/netlify-production-release.yml` が、最新の`main`を
`netlify-production`へfast-forwardする。

- 定期実行は上記スケジュールだけ
- GitHub Actions画面の`Run workflow`から緊急公開できる
- 緊急公開では理由の入力を必須とする
- 公開ブランチへ直接変更が入り履歴が分岐した場合、強制pushせず失敗する
- 同じコミットならpushしないため、変更のない定期実行ではNetlifyを起動しない

## Netlify側で必要な一回限りの設定

対象は、チーム`nukadokonokai`のプロジェクト`dansyu-de-go`。

1. Production branchを`main`から`netlify-production`へ変更する。
2. 無料枠の次回復活後、Stop buildsを解除する。
3. `netlify-production`の更新1回だけで本番デプロイされることを確認する。
4. `main`だけの更新では本番デプロイされないことを確認する。

2026年11月4日時点では、無料枠超過によりNetlify画面に
`production deploys and Agent Runners are paused`と表示されている。
そのため、枠が復活するまでは本番デプロイ試験を行わない。

## 緊急公開の操作

1. GitHubの`Actions`を開く。
2. `Netlify production release`を選ぶ。
3. `Run workflow`を選び、緊急公開の理由を入力する。
4. 完了後、Netlifyのデプロイ成功と本番URLの対象変更を別々に確認する。

「GitHub Actionsが成功した」だけでは本番公開完了としない。
Netlify、Cloudflare、本番URLを分けて確認する。

## 料金枠の考え方

2026年11月4日に確認したクレジット制Freeプランでは、本番デプロイにも
クレジットを使い、通信量やリクエストも同じ月間枠から消費される。
料金体系は変更される可能性があるため、毎月の利用状況を確認し、
公開回数だけで無料枠を使い切らないこと。

緊急用の回数はNetlifyが自動予約する枠ではなく、運用上残しておく予算である。
残量が少ない場合は定期公開を止め、誤案内修正などを優先する。

## GitHub Pagesとの関係

GitHub Pagesの独立バックアップは`main`を元にするため、日々の更新を維持する。
この設定は本番DNS、Cloudflare Worker、GitHub Pagesの公開元を変更しない。
