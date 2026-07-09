# 2026-07-05 Web版かもちゃん問い合わせのLINE通知化

## 背景

Web版かもちゃんチャットには、`qa.json` のツリーメニュー上に
「情報の修正・追加」問い合わせ導線がある。
しかし実装上は `report_chat` も通常会話と同じ `/chat` に送られており、
問い合わせ内容の保存や、まじまじさんへのLINE Push通知は行われていなかった。

## 実装内容

### gen: `/Users/mini2014/danshu-chat/main.py`

- `POST /inquiry` を新設
- Web問い合わせを `/Users/mini2014/danshu-chat/inquiries.jsonl` に1行JSONで保存
- 既存の `line_push_admin()` を再利用し、まじまじさん個人LINEへPush通知
- 通知文には時刻・経路・URL・位置情報（ある場合）・問い合わせ本文を含める
- 反映前バックアップ: `main.py.bak-20260705-web-inquiry`

### soi: `danshu-de-go`

- `qa.json` の `report_chat` に `endpoint: "inquiry"` を追加
- `chat.html` に `callInquiry()` を追加
- 通常会話は従来通り `/chat`、問い合わせ導線だけ `/inquiry` に送る

## 検証

- `qa.json` を `python3 -m json.tool` で検証
- `chat.html` の埋め込みJSを `node --check` で検証
- gen側 `main.py.web-inquiry-new` を `/usr/local/bin/python3 -m py_compile` で検証
- `launchctl stop/start com.danshu.uvicorn` で再起動
- `curl http://127.0.0.1:8000/health` が `{"status":"ok","venues_loaded":1215}` を返すことを確認
- `POST /inquiry` テストで `notified:true` を確認
- `inquiries.jsonl` にテスト問い合わせが保存されたことを確認
- `uvicorn.log` に `[LINE] 管理者へ問い合わせ通知を送信しました` と `POST /inquiry 200 OK` が残ることを確認

## 注意点

公開サイトでこの導線を有効にするには、`chat.html` と `qa.json` の変更を
GitHub Pages側へ反映する必要がある。gen側の `/inquiry` は本番反映済み。

