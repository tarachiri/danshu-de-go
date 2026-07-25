# SEO修正指示書と実際のリポジトリ状態の食い違い

日付: 2026-07-25
作業: ふーちゃん（Claude Code, soi）
参照元: かもちゃん作成「断酒でGO!! SEO修正フルセット 作業仕様書」（2026-07-25付、チャットで受領）

## 経緯

かもちゃんから上記の作業仕様書を受け取り、実装前に`danshu-de-go`リポジトリの
現状を確認したところ、仕様書の「根本原因の調査結果」が実際のリポジトリ状態と
大きく食い違っていた。まじまじさんの判断で**実装は保留**し、この記録を残して
かもちゃん側に現状を伝える。

## 仕様書が「無い」としていたが、実際は既に存在するもの

- `robots.txt` — 存在（`User-agent: *` / `Allow: /` / `Sitemap:`指定あり）
- `sitemap.xml` — 存在。仕様書が想定する簡易版ではなく、全都道府県の
  `chiiki/`階層・`org-*`ページ・ブログ記事（`blog/posts/*.html`、001〜012と
  日付付きファイル）まで網羅した本格的な内容（最終更新エントリ:
  `2026-07-21-auto-2026-06-29-line-webhook.html`, lastmod 2026-07-22）
- `<meta name="description">` — 存在。コミット`e3a9b14`（2026-06-22、
  「seo: meta description og追加」）で追加済み
- OGPタグ（`og:title`/`og:description`/`og:url`/`og:type`）— 存在
- `<meta name="google-site-verification" content="7EhXvtjVoRS35w2Ag4aOtzV5998UUlyJdXe5ST7Dvic" />`
  — 存在。コミット`e121611`（「chore: Google Search Console認証タグ追加」）で
  追加済み。仕様書Step 6-3の所有権確認（HTMLタグ方式）はおそらく完了済みと
  思われる（サーチコンソール側でのステータス未確認）

## 実際に欠けているもの

- `og:image` / `og:locale` — 一度はコミット`6f6aa88`（2026-06-11、
  「feat: OGP・メタタグ・twitter cardを追加」）で追加されたが、
  コミット`e3a9b14`（2026-06-22）のhead書き換えで消えている
- `twitter:card` / `twitter:title` / `twitter:description` / `twitter:image`
  — 同じく`6f6aa88`で追加されたが`e3a9b14`で消えている
- JSON-LD構造化データ（Schema.org）— 追加された形跡なし、現状も無し

## その他

仕様書は`/home/claude/seo-fix/robots.txt`等、かもちゃん側サンドボックスの
ファイルを「そのまま配置」する前提で書かれているが、soi側にはそのパスは
存在しない。今後この種の指示書を作る場合、リポジトリの現状（少なくとも
`index.html`のhead・`robots.txt`・`sitemap.xml`の有無）を先に確認してから
作業内容を確定してほしい。

## 次にやること（実装未着手）

- `og:image`・`og:locale`の復元
- Twitter Cardタグの追加
- JSON-LD構造化データ（WebSite/Organization等）の新規追加
- 上記のみをスコープとした指示書に作り直すか、かもちゃんと方針をすり合わせてから着手
