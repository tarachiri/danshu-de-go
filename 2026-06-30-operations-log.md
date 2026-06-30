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

### 次に安全にできる候補

1. `gen` の `fetch_venues()` にキャッシュ避けのクエリを追加する。
2. `gen` の再読み込み時刻を `4:00` から `5:30` へ変更する。
3. `gen` の `/health` に `last_loaded_at`、`last_load_ok`、`source_url`、`last_error` を追加する。
