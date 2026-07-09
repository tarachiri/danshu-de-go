# 2026-07-06 Cloudflare Access wiki curl確認

## 背景

`https://wiki.nukadokonokai.com/` へのCloudflare Access Service Token疎通確認で、
Codex側のcurlでは一時的に403が続いていた。

Cloudflare側で `danshu-wiki` アプリケーションにService Authポリシーが付いていることを
画面で確認し、利用トークンの紐付けを見直した後、再確認した。

## 確認結果

Codex側から以下の条件で再実行し、HTTP 200を確認した。

- URL: `https://wiki.nukadokonokai.com/`
- ヘッダー名: `CF-Access-Client-Id`
- ヘッダー名: `CF-Access-Client-Secret`
- Client ID長: 39文字（末尾 `.access`）
- Secret長: 64文字
- 結果: `code=200`

## 注意

Service TokenのSecretは実質パスワードのため、この記録には実値を残さない。
会話上に貼られたSecretは、確認完了後にCloudflare側でローテーションすることを推奨する。

## 切り分け結論

Cloudflare Access、`danshu-wiki` アプリケーション、Service Authポリシー、
Service Tokenヘッダーによる疎通は正常に動作した。

403が続いた期間は、Accessアプリに付いているポリシーと実際にcurlで使っている
Service Tokenの対応が一致していなかった、または設定反映前だった可能性が高い。
