# ブログ承認フロー（visible制御）統合完了記録

日付: 2026-07-22
作業: ふーちゃん（Claude Code, soi）
参照元: Google Drive `2026-07-21_blog-review-visible-flow-handoff.md`（かもちゃん作成）
        `blog_review_addon.py`（同フォルダ）

## やったこと

1. `blog_review_addon.py` の内容（`parse_posts` / `get_pending_posts` /
   `approve_post` / `reject_post` / `render_blog_review_list` と
   `/blog-review` 系ルート）を tyo の実運用ファイル
   `/home/maji/danshu-tools/gogo_review_app.py` に統合。
   - 統合前に `gogo_review_app.py.bak-20260721-blog-review-integration` を
     同ディレクトリにバックアップとして残した。
   - アドオン側コメントは `page()` を呼ぶ想定だったが、実際の
     `gogo_review_app.py` の関数名は `html_page()` なので呼び出しをそちらに
     合わせて修正。
   - import に `re`, `subprocess` を追加（`urllib.parse` は既存で使用済み）。
   - `html_page()` のnav行に「ブログ確認」リンクを追加。
2. サービス再起動はsudoパスワードが必要なため、まじまじさんに
   `sudo systemctl restart gogo-review.service` を実施してもらった。

## 検証で見つかった問題（重要）

ハンドオフ文書は「gen側は`visible:false`付きで記事生成・push完了」と
書いていたが、実際にはgen（`/Users/mini2014/danshu-de-go`）側で
**未コミットのまま**残っていた（`blog/index.html`の`visible`フィルタ修正、
新規記事 `posts/2026-07-21-auto-2026-06-29-line-webhook.html` とも）。
tyo/GitHub側にはまだ届いていなかった。

→ まじまじさんに確認の上、gen上でcommit・pushを実施（コミット `9dd9b3d`）。

さらに、pushされた新規記事エントリ自体に **`visible:false`が付いていない**
ことが判明（file/title/date/tagsのみ）。`auto_blog_generator_v2.py`の
`append_to_blog_index()`修正（ハンドオフ文書に記載）が、この記事の生成時点
では反映されていなかったと見られる。パーサーは`visible`未指定を
「既存記事＝表示中」として扱う仕様のため、このままでは承認待ち0件のまま
だった。

→ まじまじさんの承認を得て、gen上で該当エントリに手動で`,visible:false`を
追加し、再commit・push（コミット `63d22a6`）。tyo側でgit pullして反映。

**要フォローアップ**: `auto_blog_generator_v2.py`の`append_to_blog_index()`が
実際に`visible:false`を付与できているか、gen側で次回の自動生成時に再確認
すること。今回は手動追加でしのいだだけで、生成スクリプト自体は未調査。

## 動作確認結果（全てtyo上 `curl` 経由、127.0.0.1:8010）

1. `/blog-review` アクセス: ログイン→200 OK、ナビに「ブログ確認」リンク表示。
2. 承認待ち1件（上記記事）が一覧に表示されることを確認。
3. `/blog-preview/posts/...` プレビュー: 200 OK。
4. 承認ボタン（`POST /blog-review/.../approve`）実行:
   - `blog/index.html`の該当エントリが`visible:true`に書き換わったことを確認。
   - tyo側でgit commit（`0d32ece chore: ブログ記事公開 (...)`）・pushが
     実行されたことを`git log`・`git status`（clean）で確認。
   - GitHub `origin/main`にも反映されていることをsoi側から`git fetch`して確認。
5. 承認後、`/blog-review`一覧が再度0件に戻ることを確認（正しい挙動）。

却下（reject）ボタンは今回未テスト（承認フローのみ依頼されたため）。

## 経路まとめ

- gen: `/Users/mini2014/danshu-de-go`（記事生成・visible:false付与元）
- tyo: `/home/maji/danshu-de-go`（`gogo_review_app.py`が書き換え・push実行）
       `/home/maji/danshu-tools/gogo_review_app.py`（統合先アプリ本体）
- GitHub: `tarachiri/danshu-de-go`（tyoのremote URLにPATが平文で含まれる件は
  ハンドオフ文書記載の既知課題、今回は対応せず）
