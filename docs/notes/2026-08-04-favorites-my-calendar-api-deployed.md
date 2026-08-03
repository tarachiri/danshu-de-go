# お気に入り・MyカレンダーAPI 本番配置記録（tyo / gen / E2E疎通）

日付: 2026-08-04
対象: tyo（favorite-tyo-api）・gen（公開プロキシ有効化）

【要約＆感想】
- 何をしたか：実装済みのお気に入り・MyカレンダーAPIを本番投入し、公開URL経由のE2E疎通（読み書き→後片付け）まで完了した。
- なぜ嬉しいか：ブラウザIDだけでお気に入り・表示設定を保存できる機能が、PWAと同じ経路で実測確認できた。
- ひとこと感想：E2Eでgenルータのパス結合バグ（設定系が `/internal/favorites/calendar-settings` を呼び405→502）を実測で発見・修正した。テストだけでは気づけない本番確認の価値を再確認した。

---

## 1. tyo 本番配置

- `favorite_tyo_api.py` を `/home/maji/danshu-tools/` へ配置（chmod 750・チェックサム照合済み）
- systemdユーザーサービス `favorite-tyo-api.service` 新規作成（identity-tyo-api と同一構成・port 8771・100.101.127.28 Tailnet限定・EnvironmentFile は identity-api.env を共用）
- `systemctl --user enable --now favorite-tyo-api` → active (running)
- 実測: port 8771 LISTEN／未認証→401／認証済みhealth→`{"status":"ok","tables":[...5テーブル...]}`
- DB実測: `user_favorite_meetings` / `user_calendar_settings` テーブル存在・0行

## 2. gen 本番配置

- `/Users/mini2014/.config/danshu/identity-api.env`（600）に `FAVORITE_TYO_API_URL=http://100.101.127.28:8771/internal` を追記（バックアップ `identity-api.env.bak-20260804-favorites` 作成）
- `launchctl kickstart -k` で com.danshu.uvicorn を実再起動（PID 28075→28500→28564 と変化を確認）
- `/favorites` ルート稼働確認（トークンなし→400）

## 3. E2Eで発見・修正したバグ

- 症状: `GET /favorites/calendar-settings` が 502（`{"detail":"Method Not Allowed"}`）
- 原因: genルータのベースURLが `/internal/favorites` だったため設定系が `/internal/favorites/calendar-settings` を呼び、tyoの実ルート `/internal/calendar-settings`（`/internal` 配下）に届かず405→502。モックテストのパスも実態とずれていた
- 修正: gen `favorite_router.py` のベースURLを `/internal` に変更し、パスを `/favorites`・`/favorites/{id}`・`/calendar-settings` に統一。モックテストも実ルートに合わせ、ローカル12件再成功
- コミット: `3dfe349`（fix）・`9743720`（test align）・プッシュ済み

## 4. E2E疎通結果（公開URL https://chat.nukadokonokai.com 経由・テストトークン）

| 項目 | 結果 |
|---|---|
| CORS preflight（x-client-token） | 200・allow-origin 許可 |
| 設定取得 GET /favorites/calendar-settings | 200 既定値 |
| 設定更新 PUT（name_only/normal） | 200 |
| お気に入り登録 PUT /favorites/1 | 200 favorited:true |
| 一覧 POST /favorites | 200（富士見例会・19:00等の実データ） |
| 削除 DELETE /favorites/1 | 200 favorited:false |
| 後片付け確認 | favorites 0行／settings 既定値に戻し |

## 5. 本番DBの状態（実測）

- `user_accounts`: 7件（うちテスト利用者は id=3〜7 の5件。本番利用者は id=1〜2 と推定）
- `user_favorite_meetings`: 0件（E2E後片付け済み）
- `user_calendar_settings`: 1件（テスト利用者の既定値行）

## 6. ロールバック手順（記録）

- tyo: `systemctl --user stop --now favorite-tyo-api`（+ disable）／unit・ファイル削除
- gen: envの `FAVORITE_TYO_API_URL` 行削除＋`favorite_router.py` の2行をmain.pyから除去＋uvicorn再起動
- バックアップ: `favorite_router.py.bak-20260804-before-pathfix`・`identity-api.env.bak-20260804-favorites`

秘密情報（共有キー・HMAC鍵・トークン）は本ファイルに一切記載していない。
