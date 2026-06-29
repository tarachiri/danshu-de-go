# 2026-06-29 断かもLINE統合・505団体問い合わせ窓口化

## 概要

断酒でGO!!のAIアシスタント「断かも」をLINE公式アカウントに統合した。
全国505団体のプチHPにLINE問い合わせボタンを設置し、流入元（団体名）を自動送信する仕組みを実装した。

---

## 実装内容

### 1. LINE Webhook統合（gen: main.py）

**追加したもの：**
- `line-bot-sdk v3` インストール（`pip3 install line-bot-sdk --break-system-packages`）
- `/webhook/line` エンドポイント追加
- `generate_reply()` 共通関数への切り出し（WebチャットとLINEで共用）
- `needs_escalation()` エスカレーション判定関数
- `line_reply()` / `line_push_admin()` ヘルパー関数

**エスカレーションキーワード：**
```python
ESCALATION_KEYWORDS = [
    "登録", "修正", "変更", "削除", "追加", "更新", "間違い", "誤り", "違う", "正しく",
    "取材", "掲載", "メディア", "記者", "新聞", "テレビ", "ラジオ", "雑誌",
    "苦情", "クレーム", "要望", "改善", "バグ", "不具合", "おかしい",
    "担当者", "責任者", "連絡先", "電話番号", "メールアドレス",
    "中止", "休止", "休会", "中断", "お休み", "やめ", "廃止", "閉鎖",
]
```

**フロー：**
```
LINEユーザー → /webhook/line → 署名検証
                                    ↓
                            エスカレーション判定
                           Yes↙         No↘
                受付メッセージ返信      generate_reply()
                まじまじさんに通知      かもちゃん回答返信
```

### 2. LINEアカウント構成

| アカウント | 用途 | Webhook |
|-----------|------|---------|
| 断酒でGO!!（既存OA） | 断かも対話・問い合わせ | `/webhook/line` |
| 【運営】断酒でGO!!（新規） | Kuma監視通知専用 | 不要 |
| ぬか床の会 | ぬかちゃん | 別系統 |

### 3. 505団体プチHPにLINEボタン設置

`generate_chiiki_pages_v3.py` の「参加・お問い合わせ」カードに追加：

```html
<a href="https://line.me/R/ti/p/@867qlgsx?text={org_name}のページから問い合わせ" 
   class="btn-line">🟢 LINEで問い合わせる</a>
```

`chiiki/chiiki.css` に `.btn-line` スタイル追加（背景色 `#06C755`）。

---

## トラブルシューティング記録

### 問題1: 404 Not Found
**原因：** ふーちゃんの出力ファイルがgenに転送されていなかった  
**解決：** soiからgenにscpで転送

### 問題2: ModuleNotFoundError: No module named 'linebot'
**原因：** `pip3 install` したPythonとlaunchctlが使うPythonが別物（pyenvとbrew）  
**解決：** `/usr/local/bin/python3 -c "import linebot"` で確認し `--break-system-packages` でインストール

### 問題3: 400 Invalid signature（LINE検証ボタン）
**原因：** `.env`に別チャンネルのChannel Secretが入っていた  
**解決：** `nano .env` で正しい値に書き直し・再起動

### 問題4: LINEからメッセージを送っても返信が来ない
**原因：** Webhook URLが古い `webhook.site` のままだった  
**解決：** LINE Developersで `https://chat.nukadokonokai.com/webhook/line` に変更

### 問題5: `{org_name}` が展開されない
**原因：** `html += '''` （通常文字列）の中に書いていた  
**解決：** `html += f'''` に変更してfstring展開

### 問題6: chiiki.css に `.btn-line` が大量重複
**原因：** `sed -i` の置換対象が複数箇所にマッチした  
**解決：** `cp chiiki_new.css chiiki.css` でリセットし、`sed -i '278a\...'` で1回だけ追加

---

## 環境変数（gen: .env）

```
ANTHROPIC_API_KEY=...
LINE_CHANNEL_SECRET=...（断酒でGO!!チャンネルのBasic settings）
LINE_CHANNEL_ACCESS_TOKEN=...（断酒でGO!!チャンネルのMessaging API）
LINE_ADMIN_USER_ID=...（まじまじさん個人のLINE User ID）
```

---

## 関連ファイル

| ファイル | 場所 | 役割 |
|---------|------|------|
| `main.py` | gen: `/Users/mini2014/danshu-chat/` | 断かもFastAPI |
| `generate_chiiki_pages_v3.py` | tyo: `/home/maji/` | 505団体ページ生成 |
| `chiiki.css` | tyo: `/home/maji/danshu-de-go/chiiki/` | プチHPスタイル |

---

## 次のステップ

- [ ] 断かもLINEにqa.jsonツリーフロー実装（LINE Flex Message）
- [ ] 友達追加時のfollowイベント処理（UserID取得・あいさつ送信）
- [ ] LINEからGPS位置情報受信（LINE LIFF対応）
