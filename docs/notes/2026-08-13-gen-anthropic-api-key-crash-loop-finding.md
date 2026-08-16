# gen: ANTHROPIC_API_KEY読み込み失敗によるクラッシュループの形跡（2026-08-12発生・原因未特定）

作成日: 2026-08-13
作成者: ふーちゃん（Claude Code, soi）
経緯: 会員登録機能（簡易版）バックエンドデプロイ後のログ確認中に発見
（[2026-08-13-member-registration-simple-implementation.md](2026-08-13-member-registration-simple-implementation.md)参照）
ステータス: 現在は解消済み・再発なし。原因（誰が何を編集したか）は未特定。

## 見つかったこと

`/Users/mini2014/danshu-chat/uvicorn.error.log`に、`main.py`起動時の
以下のトレースバックが**9回連続**で記録されていた。

```
File "/Users/mini2014/danshu-chat/main.py", line 40, in <module>
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
KeyError: 'ANTHROPIC_API_KEY'
```

`main.py`は`load_dotenv()`（python-dotenv）で`/Users/mini2014/danshu-chat/.env`
から環境変数を読む設計。`launchd`の`com.danshu.uvicorn`は`KeepAlive=true`
のため、起動失敗のたびに即座に再起動を繰り返す。

## 発生タイミングの特定

`.env` / `.env.bak`のタイムスタンプ:

```
.env.bak  mtime=2026-08-12 00:47:49
.env      mtime=2026-08-12 00:48:05
```

16秒差があり、`.env`が書き換えられた形跡と一致する。このクラッシュループは
**2026-08-12未明の`.env`編集作業中**に発生したとみられる（編集の非原子的な
書き込み中、`launchd`の自動再起動がファイルの不完全な状態を掴んで
`ANTHROPIC_API_KEY`欠如で起動失敗、を繰り返した可能性が高い）。

今回（2026-08-13）の会員登録機能デプロイ作業（`identity_router.py`更新・
`launchctl kickstart -k`による再起動）とは**無関係**。このクラッシュ以降
（`.env`編集完了後）は再起動9回連続（うち1回は今回の会員登録デプロイに伴う
もの）すべて正常起動しており、現在`.env`にも`ANTHROPIC_API_KEY`は
正しく存在することを確認済み。

## 未確認・要フォロー

- 2026-08-12未明に誰が`.env`を編集していたか（別セッションのふーちゃん(Codex)
  かまじまじさん本人か）は特定できていない。当時どんな変更を意図していたか
  分かる人が確認・記録すると良い

## 対策実施（2026-08-13、まじまじさん承認済み）

再発防止として以下2点を実施した。

### ① launchd側：ThrottleInterval追加（実施済み）

`~/Library/LaunchAgents/com.danshu.uvicorn.plist`に`ThrottleInterval`（10秒）を
追加。`.env`が一瞬不完全な状態になっても、即座の再起動連打ではなく間隔が空くため
書き込み完了を待てる可能性が上がる。

- バックアップ：`com.danshu.uvicorn.plist.bak-20260813-throttle-interval`
- `PlistBuddy -c "Add :ThrottleInterval integer 10"`で追加、`plutil -lint`で検証OK
- `launchctl unload` → `launchctl load`で反映。新PID(70089)でstartup complete確認、
  エラーログもクリーン

### ② 運用ルール：`.env`編集はmvによるアトミック置き換えに統一（今後のルール）

`.env`を直接編集する代わりに、`.env.tmp`に新しい内容を書いてから
`mv .env.tmp .env`で置き換える。同一ファイルシステム内の`mv`はアトミックなため、
書き換え途中の不完全な状態が原理的に発生しなくなる（根本対策）。

**今後gen上の`/Users/mini2014/danshu-chat/.env`を編集する全エージェント
（ふーちゃん(Claude Code, soi) / ふーちゃん(Codex, gen) / まじまじさん）は
このルールに従うこと。**

アプリ側（`main.py`の`os.environ["ANTHROPIC_API_KEY"]`をKeyError許容のまま
にする判断）はあえて変更しなかった：キー欠如を`.get()`で握りつぶすと
fail-fastできず、気づかないままAPIキー切れで動き続けるリスクの方が大きいため。
