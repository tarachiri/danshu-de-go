# 課題メモ：Codexアクセス問題 最終解決（設定反映ラグと推定）

作成: 2026-07-06 (かもちゃん / Claude Sonnet 5, claude.aiセッション)
関連: 2026-07-06_isolation_test_result_codex_side.md（直前の記録）
※複数AI同時作業を想定し、このファイルは新規追加のみ。既存ファイルへの追記・上書きはしていません。
※Codex側も別途 /Users/pro2015/danshu-de-go/docs/notes/2026-07-06-cloudflare-access-wiki-curl-check.md
  に作業記録を追加済み（soi上、こちらは触れていない）。

## 最終結果

Codex側で同じcurlコマンドを再実行したところ、**200**が返った。

```
url=https://wiki.nukadokonokai.com/
Client ID length=39, suffix=.access
Secret length=64
code=200
```

これにより、kamochan-wiki-accessトークン・Service Auth・
danshu-wikiアプリのポリシー紐付けは正常に機能していることが
Codex側からも確認できた。

## 結論：一連の403の原因

最も可能性が高い説明：**ポリシー設定変更直後、Cloudflare側の
反映が完了する前にアクセスを試みたための一時的な403**。
Cloudflare Accessの設定変更は即座に全エッジに伝播するとは限らず、
数秒〜数十秒のラグが生じることがある。

トークンやポリシーの紐付け自体に恒久的な誤りはなかった。

## 今回の一連の作業で得られた教訓（今後の参考）

1. Cloudflare Access設定変更直後にテストして失敗した場合、
   即座に設定不備と断定せず、少し時間を置いて再試行することも
   切り分けの選択肢に含める
2. 複数のAI（かもちゃん・Codex）が同時に同じインフラを
   触る場合、tyo側での直接curl確認が最も信頼できる
   切り分け手段として機能した
3. Service Tokenは用途ごとに分けて発行する方針
   （kamochan-wiki-access、codex）が有効に機能した

## 残タスク（整理、優先度低）

- danshu-wikiアプリに紐付いている`codexxx`・`wiki_kamo_codex`
  ポリシーの要否確認（`codex`トークンを正しく参照しているか、
  もしくは`kamochan-wiki-access`のみに一本化しても支障ないか）
- 全体ポリシー一覧にある実体のない7個のポリシー
  （wiki_kamo_codex, wiki_codex, codex×3, codexxx等、
  2026-07-06_token_reality_two_only.md参照）の整理
  → いずれも実害はなく、緊急性は低い

## 今回のCodex連携タスクは実質完了

かもちゃん（Client ID: [redacted、公開リポジトリのため伏字]）・
Codex（別トークン`codex`使用）ともに、https://wiki.nukadokonokai.com/
への認証付きアクセスが確認できた。
