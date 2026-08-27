# スプラッシュ表示・起動体感速度の改善（2026-08-27）

## 課題

サイト起動時に待ち時間がある一方、スプラッシュとプログレスバーが表示されない、または進捗が途中で止まって見える状態だった。

## 確認できた原因

- LeafletとMarkerClusterのJavaScriptが`<head>`で同期読み込みされ、スプラッシュDOMの解析より先に待ち時間が発生していた。
- スプラッシュ内のGoogle Fonts `@import`とQRコードライブラリも初期表示を待たせる構成だった。
- `venues.json?v=`へ毎回`Date.now()`を付け、約10分のブラウザキャッシュを毎起動時に無効化していた。
- 進捗80%設定直後に同期的な地図ピン生成へ入り、ブラウザが80%の状態を描画する時間を持てなかった。

公開配信の`venues.json`は約1.9MB、gzip転送時は約170KBだった。実測ではgzip条件で約0.43秒だったが、キャッシュを毎回避ける必要はなく、通信環境が悪い場合の影響が大きくなる構成だった。

## 変更内容

- LeafletとMarkerClusterのJavaScriptをページ末尾へ移動
- 地図CSSとGoogle Fontsをpreloadによる非同期適用へ変更
- スプラッシュ内のGoogle Fonts `@import`を廃止
- QRコードライブラリをasync化し、読み込み後に安全に描画
- `fetch('venues.json?v=' + Date.now())`を`fetch('venues.json')`へ変更
- 進捗を30%・55%・80%・95%・100%へ細分化
- 55%・80%・95%で処理を一度イベントループへ返し、画面描画の機会を確保
- `app.js`の配信バージョンを`20260827b`へ更新

GitHub Pagesの`venues.json`は`Cache-Control: max-age=600`のため、データ更新後も最大約10分で更新される。日次更新データを恒久的に固定する変更ではない。

## テスト

- `node --check app.js`: 成功
- 既存JavaScriptテスト6ファイル: 全成功
- 新規`tests/splash-loading-order.test.js`: 成功
- `git diff --check`: 成功
- ローカル実機表示: 約4.5秒で100%、スプラッシュ、プログレスバー、QRコード、同意ボタンを確認
- 起動変更に関係するJavaScriptエラーなし

ローカルプレビューでは掲示板APIへの接続エラーが1件出たが、静的localhostから本番APIへ接続する際の既存CORS/通信条件によるもので、今回の起動処理とは無関係。

## 現在の状態

- 専用worktree: `/Users/pro2015/Downloads/danshu-de-go-splash-speed`
- ブランチ: `codex/splash-speed-20260827`
- ローカル実装・テスト済み
- 未コミット、未プッシュ、本番未反映
