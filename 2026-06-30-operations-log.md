# 作業ログ

## 2026-06-30

### 構成確認

- `soi`: 開発・編集端末。フロントエンドの静的ファイルを管理。
- `tyo`: DB、cron、データ収集、JSON生成を担当。
- `gen`: AI、Webチャット、LINE Webhook、Anthropic API呼び出しを担当。

### かもちゃんチャット構成

- フロント側:
  - `chat.html`
  - `qa.json`
  - `venues.json`
- `chat.html` は固定FAQ・選択肢フロー・一部の例会検索をブラウザ内で処理する。
- 自由入力や複雑な回答は `https://chat.nukadokonokai.com/chat` に送る。
- チャットAPI本体は `gen:/Users/mini2014/danshu-chat/main.py`。
- `main.py` では `ANTHROPIC_API_KEY` を `.env` から読み、`claude-haiku-4-5-20251001` を呼び出している。

### 見つかった課題

- `tyo` の `venues.json` / `schedule.json` 生成・push は毎朝 `5:00`。
- `gen` の `venues.json` 再読み込みは毎朝 `4:00`。
- このため、かもちゃんが古い `venues.json` を読んで回答する可能性がある。
- `gen` 側の取得URLにキャッシュ避けがないため、Cloudflare/GitHub Pagesの古いJSONを掴む可能性もある。

### 第1フェーズ実施内容

`tyo` のcrontabを安全範囲で修正した。

- `~/danshu-de-go` を `/home/maji/danshu-de-go` に変更。
- `~/logs` を `/home/maji/logs` に変更。
- 毎朝 `5:00` の `generate_map_v6.py` 実行にログ出力を追加。

ログ出力先:

```text
/home/maji/logs/generate_map_cron.log
```

バックアップ:

```text
/home/maji/logs/crontab_backup_20260630_124804.txt
```

確認結果:

- crontab内に `~` が残っていないことを確認済み。
- 変更対象はcronの2行のみ。

### 第2フェーズ実施内容

`gen` のチャットAPIで `venues.json` 取得時にキャッシュ避けを追加した。

対象ファイル:

```text
gen:/Users/mini2014/danshu-chat/main.py
```

変更内容:

- `fetch_venues()` で `venues.json` のURLに `?v=YYYYMMDDHHMMSS` を付けるように変更。
- 回答ロジックや再読み込み時刻は変更していない。

バックアップ:

```text
gen:/Users/mini2014/danshu-chat/main.py.bak-20260630-cachebuster
```

確認結果:

- `python3 -m py_compile main.py` 成功。
- `launchctl stop/start com.danshu.uvicorn` で再起動。
- `http://127.0.0.1:8000/health` が `{"status":"ok","venues_loaded":1394}` を返した。

### 第3フェーズ実施内容

`gen` の `venues.json` 自動再読み込み時刻を `4:00` から `5:30` に変更した。

理由:

- `tyo` の `generate_map_v6.py` による `venues.json` / `schedule.json` 生成・pushは毎朝 `5:00`。
- `gen` が `4:00` に読むと、前日分の `venues.json` を読み続ける可能性があった。

対象ファイル:

```text
gen:/Users/mini2014/danshu-chat/main.py
```

バックアップ:

```text
gen:/Users/mini2014/danshu-chat/main.py.bak-20260630-reload-time
```

確認結果:

- `python3 -m py_compile main.py` 成功。
- `launchctl stop/start com.danshu.uvicorn` で再起動。
- `http://127.0.0.1:8000/health` が `{"status":"ok","venues_loaded":1394}` を返した。
- `uvicorn.log` に次回再読み込み `07/01 05:30` が出力された。

### 第4フェーズ実施内容

断かもが「今日が何曜日かわからない」「三重県の情報だけ」と誤回答したため、`gen` の検索・回答コンテキストを修正した。

原因:

- `search_venues()` が「今日」「明日」など曜日系の質問では地名条件を無視し、`venues.json` の先頭側から候補を返していた。
- Claudeへ現在日付・曜日を明示していなかった。
- その結果、立川の質問でも三重県の候補だけを見て「三重県だけ」と誤解することがあった。

対象ファイル:

```text
gen:/Users/mini2014/danshu-chat/main.py
```

バックアップ:

```text
gen:/Users/mini2014/danshu-chat/main.py.bak-20260630-query-fix
```

変更内容:

- `search_venues()` で、曜日系検索でも地名一致候補を優先するように変更。
- 地名は一致したが指定曜日の例会がない場合、候補会場の全日程をClaudeへ渡し、「該当なし」と説明できるようにした。
- `generate_reply()` のsystem promptへ現在日時と曜日を追加。
- 「全国データから検索しており、特定県だけとは言わない」ルールを追加。

確認結果:

- `python3 -m py_compile main.py` 成功。
- `launchctl stop/start com.danshu.uvicorn` で再起動。
- `http://127.0.0.1:8000/health` が `{"status":"ok","venues_loaded":1394}` を返した。
- `立川で今日行ける例会ある？` に対して、今日が火曜日であること、立川の今日開催はないこと、水曜・木曜・日曜の候補があることを返答した。

### 第5フェーズ実施内容

断かもの雑談応答を柔らかくするため、`gen` の `SYSTEM_PROMPT` に会話方針を追加した。

対象ファイル:

```text
gen:/Users/mini2014/danshu-chat/main.py
```

バックアップ:

```text
gen:/Users/mini2014/danshu-chat/main.py.bak-20260630-soft-chat-prompt
```

変更内容:

- 雑談や弱音には、まず気持ちを受け止める。
- 「雑談が得意ではない」「私はAIなので」のように距離を取らない。
- すぐ例会案内に寄せすぎず、1〜2文は自然に会話する。
- 飲みたい気持ち・孤立・不安が見える時は、仲間、例会、専門家につながる選択肢を示す。
- 薬・治療・離脱症状・自傷他害の相談は専門家や緊急窓口につなぐ。

確認結果:

- `python3 -m py_compile main.py` 成功。
- `launchctl stop/start com.danshu.uvicorn` で再起動。
- `http://127.0.0.1:8000/health` が `{"status":"ok","venues_loaded":1394}` を返した。
- `かもちゃん、今日はちょっと疲れたよ。雑談して。` に対して、距離を取らずに気持ちを受け止める返答になった。
- 薬の相談では、医師・薬剤師への相談を促し、自己判断で量を変えないよう案内できた。

### 第6フェーズ実施内容

断かも回答から地図ピンへ誘導できるよう、フロント側にURLパラメータによるピンジャンプ導線を追加した。

対象ファイル:

```text
/Users/pro2015/danshu-de-go/app.js
```

変更内容:

- `venues.json` 読み込み後に `jumpToVenueFromUrl()` を実行するようにした。
- `?venue=241`、`?pin=241`、`?id=241` のいずれでも会場IDを受け取れるようにした。
- 該当する `venues.json` の会場を見つけたら、既存の `jumpToMarker()` で地図タブへ切り替え、ピンへ移動し、ポップアップを開く。
- ジャンプ後のピン位置を画面下部に寄せすぎず、かつポップアップ上部も見切れにくいよう、`jumpToMarker()` の目標Y位置を画面高の `75%` から `65%` に調整した。

想定URL:

```text
https://dansyu-go.nukadokonokai.com/?venue=241
```

確認結果:

- bundled Node.js で `app.js` の構文チェック成功。
- 立川の会場ID `241` / `247` が `venues.json` に存在し、緯度経度を持つことを確認。
- Playwright Chromiumはインストール後に再確認したが、ヘッドレスブラウザ起動時に `SIGTRAP` で終了したため、実ブラウザでのポップアップ確認は未完了。

### 第7フェーズ実施内容

日程タブ・新着タブのカードタッチから地図ポップアップへ移動しやすいよう修正した。

対象ファイル:

```text
/Users/pro2015/danshu-de-go/app.js
/Users/pro2015/danshu-de-go/js/news-tab.js
```

変更内容:

- `jumpToMarker()` が存在しない `area-filter` / `date-filter` に触って止まらないよう、要素がある場合だけ値を変更するようにした。
- `window.VENUES` に `venues.json` 読み込み結果を同期し、分割JSから会場検索できるようにした。
- 新着タブのカードは、タイトル・会場名・団体名から `venues.json` の会場を安全に推定できる場合だけ `jumpToMarker()` を付与するようにした。
- 推定一致は5文字以上の一致に絞り、曖昧なカードは無理にジャンプしない。
- `オンライン` 会場への地図ジャンプは除外した。
- カード内の外部リンクは `event.stopPropagation()` で、リンク押下時に地図ジャンプしないようにした。

確認結果:

- bundled Node.js で `app.js` / `js/news-tab.js` の構文チェック成功。
- `news.json` のうち、イベント13件、新着3件が安全一致候補として検出された。PDFは会場一致なし。

### 次に安全にできる候補

1. `gen` の `/health` に `last_loaded_at`、`last_load_ok`、`source_url`、`last_error` を追加する。
