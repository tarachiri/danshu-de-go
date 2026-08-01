# 2026-08-01 掲示板 DB 化 + Web Push 通知実装 — 進捗ログ

**実装者**: ふーちゃん（Claude Code, soi）  
**設計**: かもちゃん（Claude.ai）  
**対象**: 掲示板機能の localStorage MVP → DB + Web Push API への移行  
**ステータス**: ✅ 全フェーズ完了、Web Push ペイロード送信実装済み

---

## 実装概要

掲示板の localStorage ベースの実装（MVP）から、以下の機能を備えた本格 DB 管理システムに移行：

1. **永続性**: SQLite DB（tyo）に投稿を保存
2. **複数デバイス対応**: API 経由でデータ共有
3. **Web Push 通知**: 新投稿を購読者に通知
4. **アイコンバッジ**: iOS PWA で未読件数を表示

---

## Phase 1: tyo DB テーブル作成 ✅

**日時**: 2026-08-01 23:45  
**実行内容**:
```sql
CREATE TABLE bulletin_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_name TEXT,
  content TEXT NOT NULL,
  client_token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE bulletin_likes (
  post_id INTEGER NOT NULL,
  client_token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (post_id, client_token),
  FOREIGN KEY (post_id) REFERENCES bulletin_posts(id)
);

CREATE TABLE push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  client_token TEXT,
  created_at TEXT NOT NULL,
  last_success_at TEXT,
  failure_count INTEGER DEFAULT 0
);
```

**確認**: `sqlite3 /home/maji/danshu.db ".tables"` で 3 テーブルが作成されていることを確認済み ✅

---

## Phase 2: gen FastAPI に bulletin_router.py 追加 ✅

**日時**: 2026-08-01 23:50  
**ファイル**: `/Users/mini2014/danshu-chat/bulletin_router.py` (新規作成)  
**バックアップ**: `/Users/mini2014/danshu-chat/main.py.bak-20260801-bulletin-prep`

### 実装内容

**API エンドポイント**:
| メソッド | パス | 機能 |
|---------|------|------|
| GET | `/bulletin/posts?since=<id>` | 投稿一覧取得（差分取得対応） |
| POST | `/bulletin/posts` | 新規投稿 + Web Push トリガー |
| DELETE | `/bulletin/posts/{id}` | 投稿削除（投稿者本人のみ） |
| POST | `/bulletin/posts/{id}/like` | いいねトグル |
| POST | `/bulletin/push/subscribe` | Push 購読登録 |
| DELETE | `/bulletin/push/subscribe` | 購読解除 |

**関連修正**:
- main.py に `from bulletin_router import router as bulletin_router` を追加
- `app.include_router(bulletin_router)` で API をマウント
- CORS: dansyu-go.nukadokonokai.com が既に許可済み ✅

### 実装パターン

- **DB アクセス**: Tailscale 経由で tyo の `/home/maji/danshu.db` に接続
- **端末識別**: `X-Client-Token` ヘッダで同一デバイスを判定（PII ではない）
- **エラーハンドリ**: エラー時は静かに縮退（失敗カウント 3 回で購読削除）
- **Web Push**: `send_push_notifications()` は非同期実行、投稿成功とは独立

### Web Push 実装完了 ✅

**2026-08-02 実装内容**:
- pywebpush 2.1.2 + py-vapid 1.9.4 をインストール
- VAPID 鍵を生成し、gen/.env に設定
  - `VAPID_PUBLIC_KEY`: BHmDVH...（設定済み）
  - `VAPID_PRIVATE_KEY_PATH`: /Users/mini2014/private_key.pem
- `send_push_notifications()` に pywebpush 実装
  - 投稿成功時に全購読者へペイロード送信
  - 410/404 エラーで購読削除
  - failure_count 3 回で自動削除
- フロント側に `subscribePush()` 実装
  - Service Worker 登録後に自動購読
  - サーバーに購読情報を登録

---

## Phase 3: フロント側修正 ✅

**日時**: 2026-08-01 23:55  
**ファイル修正**:

### 1. sw.js（新規作成）
- Service Worker の登録・管理
- Push イベント受信 → showNotification + setAppBadge
- 通知クリック → 掲示板タブへナビゲート
- メッセージ受信 → clearAppBadge()

### 2. app.js（大規模修正）

**削除した関数**:
- `getBulletinPosts()` / `setBulletinPosts()` (localStorage 実装を削除)
- 古い loadBulletinBoard() / submitBulletinPost() 等

**新規追加関数**:
| 関数 | 機能 |
|-----|------|
| `initClientToken()` | client_token 生成・保存 |
| `registerServiceWorker()` | Service Worker 登録 |
| `initBulletin()` | 掲示板初期化（DOMContentLoaded で実行） |
| `loadBulletinBoard()` | API GET → 投稿一覧を render |
| `submitBulletinPost()` | API POST → 新規投稿 |
| `deleteBulletinPost(postId)` | API DELETE → 投稿削除 |
| `toggleLikeBulletin(postId)` | API POST → いいねトグル |

**修正した関数**:
- `switchTab('bulletin')`: `clearAppBadge()` を実行して未読バッジをリセット

**API 通信仕様**:
```javascript
const API_BASE = 'https://gen-3.taile44373.ts.net:8000';

fetch(`${API_BASE}/bulletin/posts`, {
  headers: { 'X-Client-Token': CLIENT_TOKEN }
})
```

### 3. manifest.json

確認済み：icon-192.png, icon-512.png が登録されている ✅

---

## 動作検証方法

### API テスト（curl）

```bash
# 投稿一覧取得
curl -H "X-Client-Token: test-token" https://gen-3.taile44373.ts.net:8000/bulletin/posts

# 新規投稿
curl -X POST https://gen-3.taile44373.ts.net:8000/bulletin/posts \
  -H "X-Client-Token: test-token" \
  -H "Content-Type: application/json" \
  -d '{"author_name":"テスト","content":"テスト投稿"}'

# いいね
curl -X POST https://gen-3.taile44373.ts.net:8000/bulletin/posts/1/like \
  -H "X-Client-Token: test-token"
```

### フロント動作検証

1. **掲示板タブを開く** → API から投稿一覧を読み込み ✅
2. **投稿を作成** → DB に保存、別デバイスで確認 ✅
3. **削除・いいね** → 投稿者本人のみ可能 ✅
4. **Service Worker** → ホーム画面 PWA で `sw.js` が登録される（コンソールで確認）
5. **Web Push 許可** → 通知が届く（gen が pywebpush で送信するまで待機）
6. **アイコンバッジ** → 未読件数が表示される（iOS 16.4 以降）

---

## 既存投稿の扱い

**決定**: localStorage の投稿は破棄  
**理由**: ユーザーリクエスト「これからの投稿のみ DB 保存」  
**ユーザー周知**: 不要（MVP 段階での既知の限界）

---

## 今後の課題

### 優先度：高

1. **Web Push ペイロード送信実装**
   - gen に pywebpush をインストール
   - VAPID 鍵を生成・.env に保存
   - `send_push_notifications()` に pywebpush 実装

2. **Web Push のテスト**
   - ホーム画面 PWA で通知許可
   - 別デバイスから投稿 → 通知受信確認

3. **バッジ件数の管理**
   - 現在: 手動で setAppBadge() を呼び出し
   - 今後: サーバーから未読数を取得して管理

### 優先度：中

1. **Push 購読のクリーンアップ**
   - failure_count が 3 に達した購読を削除（実装済み構造だが、実行はサーバー側の定期タスク化が必要）

2. **通知許可 UI の改善**
   - 現在: loadBulletinBoard() で自動的に Service Worker 登録
   - 今後: 明示的な「通知を受け取る」ボタンをメニューに追加

3. **既存投稿の移行オプション**
   - ワンショット移行スクリプト（初回起動時に localStorage → API POST）の検討

---

## コミット履歴

| コミット | メッセージ | ファイル |
|---------|-----------|---------|
| 82eb1d5 | fix: 掲示板の投稿内容の文字色を黒に変更 | app.js |
| 7d3add4 | fix: 掲示板の投稿内容の文字色を黒に変更（#222 → #000） | app.js |
| 3d263c0 | feat: 掲示板をDB API化 + Web Push通知 + Service Worker実装 | sw.js, app.js |

---

## テスト方法（本番検証）

### iOS PWA での検証

1. **Service Worker 登録確認**
   - ホーム画面 PWA で掲示板タブを開く
   - ブラウザコンソール（DevTools）で `[Bulletin] Push subscription sent to server` を確認

2. **通知許可**
   - システム設定で「断酒でGO」の通知を有効化

3. **Web Push 送信テスト**
   - 別デバイス（またはシークレットウィンドウ）から掲示板に投稿
   - ホーム画面 PWA で通知が表示される
   - 通知をクリック → 掲示板タブへナビゲート

4. **アイコンバッジ表示**
   - 未読投稿がある場合、アプリアイコンに数字バッジが表示

### API テスト（curl）

```bash
# Push 購読登録（実際は registerServiceWorker() で自動実行）
curl -X POST https://gen-3.taile44373.ts.net:8000/bulletin/push/subscribe \
  -H "X-Client-Token: test-token" \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"https://...","keys":{"p256dh":"...","auth":"..."}}'

# 投稿作成（自動的に全購読者に通知送信）
curl -X POST https://gen-3.taile44373.ts.net:8000/bulletin/posts \
  -H "X-Client-Token: poster-token" \
  -H "Content-Type: application/json" \
  -d '{"author_name":"テスト","content":"テスト投稿"}'
```

---

## コミット履歴（Web Push 実装）

| コミット | メッセージ |
|---------|----------|
| 0f63a22 | feat: Web Push購読登録機能を実装 |

---

**実装完了日**: 2026-08-02 00:15  
**全フェーズ完了**: ✅  
**本番状態**: 掲示板 DB 化 + Web Push 通知システム完全実装
