# 会員登録機能（簡易版・ブラウザ登録）実装記録

作成日: 2026-08-13
作成者: ふーちゃん（Claude Code, soi）
指示書: かもちゃん作成「会員登録機能（簡易版・ブラウザ登録）実装指示書」（2026-08-12）
ステータス: フロント・バックエンドとも実装・デプロイ・E2E検証（公開URL経由）まで完了。

## 背景

かもちゃんの指示書を実装する前に、指示書が「実装前に必須」とした前提確認
（`user_accounts`の`display_name`/`prefecture`/`city`カラムの実在確認）を行った
ところ、指示書の想定と実際のtyo/gen実装にズレがあることが分かった。まじまじさん
に報告し、指示書セクション10の3項目とバックエンド実装の分担について確認を得た
上で実装した。

## 前提確認で分かったこと（指示書との差分）

1. **`user_accounts.display_name` / `prefecture` / `city` は既に存在する**
   `danshu-tools/schema/user_accounts.sql`（2026-07-10作成）の`CREATE TABLE`に
   最初から含まれており、2026-08-04時点で本番7件のレコードも実測確認済み
   （`danshu-tools/docs/notes/2026-08-04-favorites-my-calendar-api-deployed.md`）。
   指示書セクション4の`ALTER TABLE`は**不要**。

2. **identity解決の仕組みが指示書の想定より新しい設計に切り替わっている**
   指示書は「`browser_token`を`user_accounts.browser_token`とそのまま照合」という
   前提だが、実際は2026-07-12以降`user_identity_service.py`でHMACハッシュ化した
   `user_browser_identities`テーブル経由の解決に変わっている
   （`user_accounts.browser_token`は後方互換用の無意味なcompat値）。
   フロント（`X-Client-Token`ヘッダー送信）への影響はないが、tyo側の新規実装は
   `favorite_tyo_api.py`と同じパターン（`user_identity_service.resolve_or_create_browser_identity()`
   を使う）に揃える必要がある。

3. **`docs/detail/db-schema.md`は指示書の指摘通り古いまま**
   会員系4テーブル（`user_accounts`、`user_browser_identities`、
   `user_favorite_meetings`、`user_calendar_settings`）が全11テーブルの一覧に
   含まれていない。今回の実装を機に別途更新が必要（指示書セクション11、未着手）。

## まじまじさんの決定事項（指示書セクション10）

1. **display_nameの重複チェック**: 不要（同名許可、指示書どおり）
2. **都道府県未入力時の案内文言**: もう少し丁寧な説明文を出す
3. **編集動線の表示**: 登録後は「登録情報の編集」に文言を出し分ける
4. **バックエンド実装の担当**: ふーちゃん（Claude Code, soi）がフロント＋
   バックエンドのコード案一式を用意する。ただしgen/tyoへの実配置・再起動は
   読み取り専用MCPしかなく直接行えないため、まじまじさん or ふーちゃん
   （Codex, gen）が本ノートのコード案を適用する。

## フロント実装（danshu-de-go、実装・テスト完了）

- [js/profile-api.js](../../js/profile-api.js) 新規作成
  `favorite-api.js`/`identity-api.js`と同一パターン（純関数・silent-fail・
  8秒タイムアウト・内部ID非返却）。`DanshuProfileApi.get(userToken)` /
  `DanshuProfileApi.update(userToken, {display_name, prefecture, city})`。
  404（未登録）と通信エラーはどちらも`null`（呼び出し側はどちらも
  「新規登録フォームを表示」という同じ扱いになるため区別不要）。
- [js/menu.js](../../js/menu.js) にプロフィールモーダル関連の関数を追加
  （`openProfileModal` / `openProfileModalFresh` / `setProfileMenuLabel` /
  `checkInitialProfileLabel` / `showToast` など）。
  **重要**: 当初これらの関数をmenu.js内の`initMenuButton()`が作る
  フローティング「☰ メニュー」ボタン（`#menu-toggle-float`）のメニュー項目に
  紐づけたが、ブラウザで確認したところこのボタンは`display:none`で
  **CSS上完全に無効化された死んだコンポーネント**だった（おそらく後発の
  下部ナビ「メニュー」タブ・`#menu-sheet`に置き換わった際の残骸）。
  実際に使われているのは`index.html`内の`#menu-sheet`（下部ナビの
  「メニュー」ボタン→`openMenuSheet()`で開く）の方なので、メニュー項目は
  こちらに実装し直した。menu.js側の関数はグローバル関数として定義済み
  （menu.js自体がプレーンスクリプトのため`#menu-sheet`のinline onclickから
  直接呼べる）なので、モーダル・API呼び出しロジックはそのまま流用できた。
  **別件のクリーンアップ候補**: `#menu-toggle-float`（フローティング
  メニューボタン）自体が死んでいるなら`js/menu.js`の`initMenuButton()`
  IIFE全体が不要コードの可能性がある。今回はスコープ外として触れていない。
- [index.html](../../index.html) の`#menu-sheet`に
  `<button class="menu-item" id="menu-item-profile" onclick="closeMenuSheet(); openProfileModalFresh();">📝 かんたん会員登録</button>`
  を追加（「📝 例会情報を登録する」の直後）。登録済みなら
  `setProfileMenuLabel(true)`で「✏️ 登録情報の編集」に文言を出し分け。
  ページ読み込み時に一度`DanshuProfileApi.get()`を叩いて初期ラベルを判定
  （`checkInitialProfileLabel()`、favoritesの`loadFavorites()`と同じ
  タイミング設計）。
  `js/profile-api.js`のscriptタグを`favorite-ui.js`の後・`app.js`の前に追加。
- 都道府県未入力時の案内文言（まじまじさん決定「もう少し丁寧」に対応）:
  「都道府県を入力しておくと、お住まいの地域に近い例会を優先的に表示できる
  ようになります。あとからいつでも登録・変更できるので、今すぐ分からなければ
  空欄のままで大丈夫です。」
- [tests/profile-api.test.js](../../tests/profile-api.test.js) 新規作成
  （`favorite-api.test.js`と同じパターン、11ケース）。

### 動作確認

- `node --check js/profile-api.js` / `node --check js/menu.js`: OK
- `node tests/profile-api.test.js`: 11ケース全成功
- 既存回帰: `browser-identity.test.js` / `favorite-api.test.js` /
  `favorite-ui.test.js` / `identity-api.test.js` すべて成功
- ブラウザ実機確認（`.claude/launch.json`の`static-preview`、localhost:8765）:
  - 下部ナビ「メニュー」→「📝 かんたん会員登録」が表示・クリック可能
  - モーダル表示、表示名未入力時は保存ボタン無効化（`opacity:0.5`）、
    入力すると有効化
  - 保存実行 → バックエンド未実装のため404 → 「時間をおいて再度お試し
    ください」を表示し入力内容を保持（想定どおりのsilent-fail挙動）
  - コンソールエラーは想定内の404（`/identity/profile`未実装）とincognito
    Push API警告（既存・無関係）のみ

## バックエンド コード案（gen / tyo、未適用）

`/identity/profile`は既存の`identity_router.py`（gen）・`identity_tyo_api.py`
（tyo）に追加する設計とした。favoritesのように新規ポート・新規systemdサービス
を切ることも検討したが、`/identity/resolve`と同じ「ブラウザトークン→
user_account解決」ロジックをそのまま再利用でき、URL階層も`/identity/profile`
なので、既存の2ファイルへの追加が最小変更で自然と判断した（別サービスにすべき
という判断があれば要相談）。

### tyo: `identity_tyo_api.py` への追加

`db()`コンテキストマネージャに`conn.row_factory = sqlite3.Row`を追加
（`favorite_tyo_api.py`と同様。既存の`/resolve`エンドポイントは
`user_identity_service`側でタプルとして行を展開しているため、Row化しても
互換性は壊れない）。

```python
# db() 内、conn = sqlite3.connect(...) の直後に追加
conn.row_factory = sqlite3.Row
```

`favorite_tyo_api.py`の`resolve_user_account_id()` / `require_client_token()`
と同じ内容のヘルパーを追加（このファイルには未実装のため新規追加）:

```python
def resolve_user_account_id(conn: sqlite3.Connection, browser_token: str) -> int:
    """X-Client-Token をこの接続の user_account_id に解決する。

    identity_service は自身でトランザクションを持つ（BEGIN IMMEDIATE -> COMMIT）
    ため、同一接続上の他の書き込みより先に呼び出すこと。
    """
    try:
        hmac_key = load_hmac_key()
    except (OSError, RuntimeError) as exc:
        raise HTTPException(status_code=500, detail="identity key unavailable") from exc

    try:
        result = identity_service.resolve_or_create_browser_identity(
            conn,
            scope=ACCEPTED_SCOPE,
            token=browser_token,
            hmac_key=hmac_key,
        )
    except identity_service.RevokedIdentityError:
        raise HTTPException(status_code=403, detail="identity revoked")
    except identity_service.InvalidIdentityError:
        raise HTTPException(status_code=400, detail="invalid browser token")
    except identity_service.IdentityError:
        raise HTTPException(status_code=500, detail="identity resolution failed")
    except sqlite3.Error:
        raise HTTPException(status_code=500, detail="identity resolution failed")
    return result.user_account_id


def require_client_token(x_client_token: str = Header(default="")) -> str:
    if not x_client_token:
        raise HTTPException(status_code=400, detail="invalid browser token")
    return x_client_token
```

`ResolveRequest`の下あたりに追加:

```python
class ProfileRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=30)
    prefecture: str = Field(default="", max_length=20)
    city: str = Field(default="", max_length=50)
```

エンドポイント本体（ファイル末尾、`if __name__ == "__main__":`の手前に追加）:

```python
@app.get(
    "/internal/identity/profile",
    dependencies=[Depends(require_internal_key)],
)
def get_profile(client_token: str = Depends(require_client_token)) -> dict:
    with db() as conn:
        user_account_id = resolve_user_account_id(conn, client_token)
        row = conn.execute(
            "SELECT display_name, prefecture, city FROM user_accounts WHERE id = ?",
            (user_account_id,),
        ).fetchone()
    if row is None or row["display_name"] is None:
        raise HTTPException(status_code=404, detail="profile not registered")
    return {
        "display_name": row["display_name"],
        "prefecture": row["prefecture"] or "",
        "city": row["city"] or "",
    }


@app.put(
    "/internal/identity/profile",
    dependencies=[Depends(require_internal_key), Depends(require_body_size_limit)],
)
def update_profile(
    body: ProfileRequest,
    client_token: str = Depends(require_client_token),
) -> dict:
    display_name = body.display_name.strip()
    if not display_name:
        raise HTTPException(status_code=422, detail="display_name is required")
    prefecture = body.prefecture.strip()
    city = body.city.strip()
    with db() as conn:
        user_account_id = resolve_user_account_id(conn, client_token)
        conn.execute(
            """
            UPDATE user_accounts
            SET display_name = ?, prefecture = ?, city = ?, updated_at = datetime('now')
            WHERE id = ?
            """,
            (display_name, prefecture, city, user_account_id),
        )
        conn.commit()
    return {"display_name": display_name, "prefecture": prefecture, "city": city}
```

`require_body_size_limit`は既存の`MAX_BODY_BYTES = 4096`をそのまま使用（更新不要）。

### gen: `identity_router.py` への追加

`ResolveRequest`の下あたりに追加:

```python
class ProfileRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=30)
    prefecture: str = Field(default="", max_length=20)
    city: str = Field(default="", max_length=50)


def _client_token(request: Request) -> str:
    token = request.headers.get("x-client-token", "")
    if not token:
        raise HTTPException(status_code=400, detail="invalid browser token")
    return token
```

エンドポイント本体（`resolve_identity`の後に追加）:

```python
@router.get(
    "/profile",
    dependencies=[Depends(require_rate_limit)],
)
async def get_profile(request: Request) -> dict:
    headers = internal_headers()
    headers["X-Client-Token"] = _client_token(request)
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(f"{TYO_API_URL}/profile", headers=headers)
    except httpx.RequestError as exc:
        print(f"[identity] tyo API unavailable: {exc}")
        raise HTTPException(status_code=502, detail="本人確認サービスに接続できません") from exc

    if response.status_code >= 400:
        try:
            detail = response.json().get("detail", "本人確認サービスエラー")
        except Exception:
            detail = "本人確認サービスエラー"
        safe_status = response.status_code if response.status_code in {400, 401, 403, 404, 422} else 502
        raise HTTPException(status_code=safe_status, detail=detail)
    return response.json()


@router.put(
    "/profile",
    dependencies=[Depends(require_body_size_limit), Depends(require_rate_limit)],
)
async def update_profile(body: ProfileRequest, request: Request) -> dict:
    if not body.display_name.strip():
        raise HTTPException(status_code=422, detail="invalid display_name")
    headers = internal_headers()
    headers["X-Client-Token"] = _client_token(request)
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.put(
                f"{TYO_API_URL}/profile",
                headers=headers,
                json={
                    "display_name": body.display_name,
                    "prefecture": body.prefecture,
                    "city": body.city,
                },
            )
    except httpx.RequestError as exc:
        print(f"[identity] tyo API unavailable: {exc}")
        raise HTTPException(status_code=502, detail="本人確認サービスに接続できません") from exc

    if response.status_code >= 400:
        try:
            detail = response.json().get("detail", "本人確認サービスエラー")
        except Exception:
            detail = "本人確認サービスエラー"
        safe_status = response.status_code if response.status_code in {400, 401, 403, 422} else 502
        raise HTTPException(status_code=safe_status, detail=detail)
    return response.json()
```

`MAX_BODY_BYTES = 2048`（既存値）のままで問題ない想定（display_name最大30文字
+ prefecture 20文字 + city 50文字の JSON ボディは十分小さい）。

### デプロイ手順（案、まじまじさん or Codexふーちゃん向け）

1. tyo: `identity_tyo_api.py`に上記を追加。`python3 identity_tyo_api.py --check`
   でDB整合性確認（テーブル追加不要、既存カラムのみ使用）
2. tyo: `systemctl --user restart identity-tyo-api`（サービス名は要確認。
   `favorite-tyo-api`と対で存在するはず）
3. tyo: `curl`で疎通確認
   （`X-Internal-Key`欠如→401、`X-Client-Token`欠如→400、
   正常系→新規は404、登録後はdisplay_name等を返すこと）
4. gen: `identity_router.py`に上記を追加
5. gen: `launchctl kickstart -k`でuvicorn再起動
   （`favorite_router.py`修正時と同じ手順、
   `docs/notes/2026-08-04-favorites-my-calendar-api-deployed.md`参照）
6. gen: 公開URL疎通確認
   （`curl https://chat.nukadokonokai.com/identity/profile` に
   `X-Client-Token`付きでGET/PUT）
7. 実機（スマートフォン）で「かんたん会員登録」→登録→編集の一連確認
8. `docs/detail/db-schema.md`に会員系4テーブルを追記（未着手、指示書セクション11）

バックエンド未適用の間、フロント側は404→silent-fail→「時間をおいて再度お試し
ください」表示で安全に失敗するため、他機能への影響はない
（お気に入り機能と同じsilent-fail設計）。

## デプロイ実施記録（2026-08-13、まじまじさん承認の上ふーちゃんがSSHで直接実施）

上記「バックエンド コード案」節のコードを、まじまじさんの許可を得た上でsoiから
tyo（`maji@192.168.0.12`）・gen（`mini2014@192.168.0.22`）へSSH経由で実際に
適用した。手順は以下の通り、両ファイルとも実行前に必ずバックアップを取得。

### tyo: `identity_tyo_api.py`

1. `cp identity_tyo_api.py identity_tyo_api.py.bak-20260813-before-profile`
2. 新コードを`identity_tyo_api.py.new`として配置、チェックサム照合で転送破損なし
   を確認
3. `danshu-tools`ディレクトリ内で一時ファイル名にコピーして`--check`実行
   → `{'status': 'ok', 'tables': [...], 'integrity_check': 'ok'}`
4. 本番ファイルへ`mv`、`systemctl --user restart identity-tyo-api`
5. `curl`で疎通確認:
   - `/internal/identity/health` → `{"status":"ok",...}`
   - `X-Client-Token`未指定の未登録トークンでGET → 404
   - PUT（表示名・都道府県・市区町村）→ 200、保存値を返す
   - PUT直後のGET → 保存値が正しく取得できる（永続化確認）
   - `X-Client-Token`欠如 → 400、`display_name`欠如でPUT → 422
6. 検証で作成したテストアカウント（`user_accounts` / `user_browser_identities`）
   はsqlite3で該当id（70/69, 70/71）のみ特定した上で削除、後片付け完了

### gen: `identity_router.py`

1. `cp identity_router.py identity_router.py.bak-20260813-add-profile-endpoint`
2. 新コードを`identity_router.py.new`として配置、チェックサム照合
3. `.venv/bin/python -m py_compile`で構文確認（`pytest`未インストールのため
   既存の`test_identity_router.py`は実行できず。構文確認＋本番相当の実機
   `curl`確認で代替）
4. 本番ファイルへ`mv`、`launchctl kickstart -k`でuvicorn再起動
   （PID 28564→69719への遷移を確認）
5. `/health`（`{"status":"ok","venues_loaded":1289}`）・
   `uvicorn.error.log`に異常なしを確認
6. gen→tyoのローカル経路（`127.0.0.1:8000/identity/profile`）でGET/PUT/異常系
   すべて確認
7. **公開URL経由**（`https://chat.nukadokonokai.com/identity/profile`、実際に
   PWAが使う経路）でGET（404）→PUT（200）→GET（200、永続化確認）→
   CORS preflight（200）まで確認。テストアカウントは同様にsqlite3で削除済み

### 現在の状態

- `/identity/profile`のGET/PUTは本番で稼働中。フロント（`js/profile-api.js`
  経由）から実際に使える状態
- バックアップは両マシンとも`*.bak-20260813-*`として残置（ロールバック用）
- ロールバック手順: 各マシンで`.bak`ファイルを本番ファイル名へ`mv`で戻し、
  tyoは`systemctl --user restart identity-tyo-api`、genは
  `launchctl kickstart -k`でuvicorn再起動

## フロント→本番バックエンド 実機E2E確認（デプロイ後）

バックエンド本番投入後、ローカルプレビュー（`static-preview`、localhost:8765）
から実際のUI操作で「かんたん会員登録」→表示名入力→保存を実行し、
本番の`https://chat.nukadokonokai.com/identity/profile`に実際に保存される
ことを確認した。加えて`DanshuBrowserIdentity` / `DanshuProfileApi`を
JS実行で直接呼び出し、get→update→get の一連が正しく動作することも確認
（更新前後で値が正しく反映されることを検証）。確認に使ったテストアカウント
（`user_accounts.id=68`とその`user_browser_identities`行）は削除済み。

## 未確認・要フォロー

- `docs/detail/db-schema.md`の会員系テーブル追記は本実装のスコープ外のまま
  （指示書セクション11、次回対応）
- gen側`.venv`に`pytest`が入っておらず、既存の`test_identity_router.py`/
  `test_favorite_router.py`によるユニットテスト回帰確認が実施できなかった
  （本番相当の実機`curl`確認で代替したが、環境整備は別途検討の余地あり）
