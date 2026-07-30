# 2026-07-29 sitemap.xml 全国展開への更新

## 背景
`sitemap.xml`が東北ブロックのみ（region/prefecture/org階層）を含む状態のまま2026-07-22で止まっていた。
`chiiki/`配下は実際には10ブロック・47都道府県・505団体ページ（計563ページ、コミット日はいずれも2026-06-29）が存在しており、
東北以外の9ブロックがサイトマップから丸ごと漏れていた。また新着ブログ記事も2026-07-17分までしか登録されておらず、
7/21〜7/28分の可視記事16件が未反映だった。

## 対応
- `chiiki/`配下を実ディレクトリ走査してregion(10)/prefecture(47)/org(505)の全URLを生成し追加
  - lastmodは全ページ共通で最終コミット日 `2026-06-29`
  - changefreq/priorityは既存の東北ブロックのパターン（region:weekly/0.8, prefecture:monthly/0.7, org:monthly/0.6）を踏襲
- `blog/index.html`の`POSTS`配列を正とし、`visible:false`の記事（2026-07-29分3件・2026-07-28-auto-2026-07-07-gogo-app-domain-and-input-plan、承認待ち）を**除外**して掲載
- 各ブログ記事のlastmodは`git log`のコミット日を使用
- トップページ・chat.html・calendar.html・gogo-submit.html・blog/index.htmlのlastmodも実コミット日に更新

## 結果
- URL数: 40 → 606
- 旧ファイルはgit管理下にあるため`git diff`/`git checkout -- sitemap.xml`で復元可能（別途.bak化はしていない）

## 未対応・要検討
- サイトマップの自動生成をcronの`generate_map_v6.py`または専用スクリプトに組み込むかは未着手。現状は手動更新。
- `visible:false`記事が承認されて公開された際、サイトマップへの追記も手動で必要になる点に注意。
