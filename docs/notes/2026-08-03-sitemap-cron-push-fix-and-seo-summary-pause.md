# 2026-08-03 sitemap.xml cron push失敗の修正 & SEO-SUMMARY一時停止対応

## 背景・症状
Search Consoleでsitemap.xmlを手動登録しようとしたところ「ファイルが見当たらない」と
表示された。調査の結果、以下が判明した。

- tyoのcrontabには`generate_sitemap.py`の自動実行（毎日5:10）が既に登録済みだった
  （過去のドキュメント記録・かもちゃんの記憶が古く、この存在を把握できていなかった）
- スクリプト自体は正常に動作し、ローカルにsitemap.xmlを正しく生成できていた
- しかし`git push`が`non-fast-forward`で毎日リジェクトされ続けていた
  （原因：ワンライナーに`git pull`が入っておらず、直前5:00の`generate_map_v6.py`の
  pushとの間でリモートより遅れた状態のままpushしていた）
- 2回連続の失敗ログの中に`detached HEAD`状態でのコミットが記録されており、
  `.git/rebase-merge`の残骸（壊れたinteractive rebase）が実際にローカルへ残っていた

## 対応

### 1. cron修正（tyo crontab、根本原因）
sitemap関連ジョブの先頭に`git pull origin main`を追加。

```
10 5 * * * cd /home/maji/danshu-de-go && git pull origin main >> /home/maji/logs/sitemap_cron.log 2>&1 && python3 /home/maji/generate_sitemap.py >> /home/maji/logs/sitemap_cron.log 2>&1 && git add sitemap.xml && git commit -m "auto: sitemap.xml自動更新" >> /home/maji/logs/sitemap_cron.log 2>&1 && git push origin main >> /home/maji/logs/sitemap_cron.log 2>&1
```

### 2. 壊れたrebase状態の解消
`git rebase --abort`で中断されたinteractive rebaseを解消。作業ツリーはclean
だったため実害なし。

### 3. diverge解消（ローカル3件 vs リモート8件）
ローカルの3件はすべて自動コミット（news.json / venues.json・schedule.json /
sitemap.xml）で人手による変更は含まれないことを`git log origin/main..HEAD`で
確認したうえで、`git reset --hard origin/main`によりリモート側（チャッピーの
SEO-SUMMARY撤去・スプラッシュ画面実装を含む）を正として採用。

### 4. SEO-SUMMARY撤去との根本的な整合対応
diverge解消の過程で、チャッピーが2026-08-02に`index.html`のSEO-SUMMARYブロックを
撤去し、スプラッシュ画面に「想いの文章ブロック」を追加していたことが判明
（一時的な撤去であり、将来復活の可能性あり、との方針を本人に確認済み）。

このままでは翌朝5:00の`generate_map_v6.py`（内部で`generate_seo_summary.py`を
呼び出す）が、SEO-SUMMARYマーカー不在を「初回導入前」と誤認し、`#app-shell`直後に
SEO-SUMMARYブロックを勝手に再挿入してしまう構造的リスクがあった。

対応として、可逆性を保ったまま一時停止する仕組みを追加：

- **danshu-tools** `generate_seo_summary.py`（main: `9c9982b`）：
  `PAUSE_MARKER = "<!-- SEO-SUMMARY:PAUSED -->"` を定義し、index.html読込直後に
  このマーカーの有無をチェック。存在すれば何もせず終了する。
- **danshu-de-go** `index.html`（main: `a53d504`）：
  スプラッシュメッセージ末尾（229行目付近）にPAUSEDマーカーのHTMLコメントを追加。
  画面表示には影響しない。復活させたい場合はこのコメント2〜4行を削除するだけで、
  次回cron実行時に元通りSEO-SUMMARYが自動挿入される。

## 未実施・要フォロー
- 明日以降のcronログ（`/home/maji/logs/generate_map_cron.log`、
  `/home/maji/logs/sitemap_cron.log`）で、
  - SEO-SUMMARYが「一時停止中」ログを出して正常終了しているか
  - sitemap.xmlのpushが`non-fast-forward`エラーなく完走しているか
  を確認する。
- `agent/bulletin-tyo-api`ブランチ（チャッピーの掲示板tyo API作業）は
  未マージのまま残存。今回の作業では一切変更していない
  （`bulletin_tyo_api.py`関連の未コミット変更・untrackedファイル多数あり、
  意図せぬ`git checkout main`のブロック要因になった。要フォローだが本記録の
  スコープ外）。
- ブログ承認待ち記事2件（`2026-07-31-auto-...chat_today_weekday_bug`、
  `2026-08-02-auto-...venue_matching_generic_word_bug`）はvisible:falseのまま
  未対応。sitemap.xml・blog一覧どちらにも未反映（仕様通り）。
