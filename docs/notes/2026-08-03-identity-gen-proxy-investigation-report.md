<!-- ファイル名: 2026-08-03-identity-gen-proxy-investigation-report.md -->

# 作業報告書：ブラウザID解決APIのgen公開プロキシ実装前調査と設計提示

日付: 2026-08-03（JST）
状態: 実測・調査・設計提示完了。ローカル実装と本番配置は承認待ち。

【要約＆感想】
- 何をしたか：tyoで稼働中のブラウザID解決API（identity-tyo-api）を実測し、genに公開プロキシを追加するための調査と設計の骨子をまとめた。
- なぜ嬉しいか：PWAから安全に「同じ人を一人の利用者として」解決する経路が、既存の掲示板プロキシと同じ方式で追加できる見込みが立った。
- ひとこと感想：裏側のAPIは既に正しく単独稼働しているので、表側（genプロキシ）も一段ずつ実測と承認を挟んで進めたい。

---

## 1. 背景・目的

2026-08-02に進められたブラウザID統一基盤（`user_browser_identities`、
HMAC-SHA-256ハッシュ保存、`user_identity_service`による二重登録防止、
PWAの`danshu_user_token`導入、tyo内部APIの独立配置）の次の工程として、
genに公開プロキシを実装する前の実測と設計確認を行った。

読み取り専用の調査のみ実施。本番DB・サービス・コードへの変更は行っていない。

## 2. 実測結果

### tyo

| 項目 | 結果 |
|---|---|
| identity APIサービス | `identity-tyo-api.service` active（2026-08-02 22:51起動、18時間稼働） |
| 待受 | `100.101.127.28:8770` のみ（Tailnet専用） |
| エンドポイント | `GET /internal/identity/health`、`POST /internal/identity/resolve` |
| 認証 | 両方とも `X-Internal-Key` ヘッダー必須（`IDENTITY_INTERNAL_KEY`） |
| 防御 | ボディサイズ上限（Content-Length検査）実装済み |
| ファイル権限 | `identity-api.env` 600、HMAC鍵 600、Pythonコード 750 |
| スコープ | 現状 `danshu_go` のみ受け付け |

### gen

| 項目 | 結果 |
|---|---|
| 公開プロキシ | `identity_router.py` は未実装（存在しない） |
| 共有キー | `/Users/mini2014/.config/danshu/` 自体が存在せず、未配置 |
| 公開経路 | `chat.nukadokonokai.com` → localhost:8000（launchd `com.danshu.uvicorn`、cwd=`/Users/mini2014/danshu-chat`） |
| CORS | `https://dansyu-go.nukadokonokai.com` と localhost を許可済み |
| 稼働 | uvicorn がポート8000/8100/8200で稼働、cloudflared が `chat.nukadokonokai.com` を8000へ接続 |

### 既存プロキシパターン（再利用可否）

genの`bulletin_router.py`とtyoの`bulletin_tyo_api.py`の実測結果、
ブラウザID解決API（`identity_tyo_api.py`）も**同じ共有キー方式**を採用している。

```text
gen bulletin_router.py
  -> X-Internal-Key: 環境変数から読んだ共有キー
  -> httpx.AsyncClient(timeout=8.0)
  -> Tailnet URL（100.101.127.28:8769）
  -> tyo bulletin_tyo_api.py（X-Internal-Key照合）
```

identity APIはtyo側ポート8770で同形式の`X-Internal-Key`照合を行うため、
**gen側プロキシはbulletin_router.pyと同一パターンで再利用できる**と判断した。

## 3. 設計の骨子（gen公開プロキシ）

1. 追加先: genの既存8000プロセス（main.py）へ`identity_router.py`を新規追加し、
   `app.include_router()`を1行追加。tyo側は変更なし。
2. 認証: `IDENTITY_INTERNAL_KEY`を環境変数で読み、`X-Internal-Key`ヘッダーで
   tyoへ転送（bulletinと同一方式）。
3. 共有キー: genに`/Users/mini2014/.config/danshu/`（700）と
   `identity-api.env`（600）を新設し、tyoのidentity-api.envと同じ
   `IDENTITY_INTERNAL_KEY`を配置。値は画面・ログ・Git・報告へ出さない。
4. PWAへの応答: `{"resolved": true, "created": true/false}` のみ返す。
   **`user_account_id`は外部へ返さない**（tyo内部で閉じる）。
5. 防御: Content-Length上限（約2KB）、per-IPの簡易レート制限（例: 1分10回）、
   `browser_token`はmax 512、tyo不通時は汎用502。
6. 変更ファイル: gen側のみ
   - `identity_router.py`（新規）
   - `main.py`（include 1行追加）
   - `/Users/mini2014/.config/danshu/identity-api.env`（新規）

## 4. 配置・再起動・ロールバック

```text
1. ローカル実装 + 自動テスト（モックtyo）
2. 承認後に gen へ転送（秘密値は中身を通さない方法で転送）
3. 承認後に launchd 再起動（launchctl kickstart -k gui/<uid>/com.danshu.uvicorn）
4. health / resolve の疎通確認（未認証401・認証OK・再送で利用者が増えないこと）
5. ロールバック: include行削除 + identity_router.py退避 + 再起動
```

本番再起動と共有キー配置はそれぞれ別承認とする。

## 5. 並行作業と安全境界

- genの`bulletin_router.py`に未コミット変更あり（他作業）。今回触らない。
- tyoの`danshu-tools`は`agent/bulletin-tyo-api`ブランチでdirty。今回触らない。
- ローカルの`/Users/pro2015/danshu-chat`はgit管理外かつ古いため、
  実装はgenの実物を基準に同じ構造で行う。
- HMAC鍵はtyoのみ。gen・ブラウザへコピーしない。

## 6. 関連して判明した事項（参考）

- GitHub `tarachiri/danshu-tools` のmain先頭は`9c9982b`
  （SEO-SUMMARY一時停止用PAUSE_MARKER追加、親は`55f70a2`）。
  tyoのdanshu-toolsクローンは未fetch・別ブランチのためこの差分が見えていなかった。
- tyoの`agent/bulletin-tyo-api`ブランチに同一変更の別ハッシュコミット
  `fb59b3d`が残存（未push）。今回の作業とは無関係だが、整理が必要な状態。

## 7. 次のアクション（承認事項）

1. 本設計の承認
2. 手順3: ローカル実装 + 自動テスト（`identity_router.py`、main.pyのinclude）
3. 承認後: genへの共有キー配置
4. 承認後: genへの配置・launchd再起動・疎通確認

---

秘密情報（共有キー、HMAC鍵、トークン）は本報告書に一切記載していない。
