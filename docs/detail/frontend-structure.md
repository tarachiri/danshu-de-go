# フロントエンド構成詳細（danshu-de-go、soi）

docs/architecture.md の詳細資料。

## 主要JSファイル

- app.js: メインロジック・地図タブ（venues.jsonを読み込み）
- schedule.js: 日程タブ（都道府県＋隣接絞り込み実装済み、venues.jsonのmeetings[]を一覧形式へ変換）
- js/analytics.js
- js/menu.js
- js/news-tab.js: 新着タブ（news.jsonを読み込み、詳細はnews_tab_audit参照）
- sw.js: Service Worker（PWA用、ただし高齢利用者には不向きと判断済み）

## 主要CSS

- style.css
- chiiki/chiiki.css: 地域ページ用（.btn-line等）

## データファイル（cronが自動生成・push）

- venues.json: 地図タブ用。会場ごとにmeetings[]をネストした構造
- meetings/data-quality.json: 日程を公式日付・定期計算・個別登録日に分けた都道府県別集計
- news.json: 新着タブ用
- qa.json: 断かもチャット用のツリー構造（Webは実装済み、LINE未対応）
- meetings_live.json
- venues_base.json, venues_kanto.json 等（地方ブロック別、一部は空ファイル）

## 日程JSONの正本（2026-09-25統一完了）

日程データの正本は`venues.json`のみ。`schedule.json`は、`meetings[]`をフラット展開しただけの重複データだったため正式廃止した。

- generate_map_v6.py（danshu-tools）: venues.jsonだけを生成
- app.js（danshu-de-go）: venues.jsonを地図表示に使用
- schedule.js（danshu-de-go）: 同じvenues.jsonを読み、ブラウザ内で日程一覧へ変換
- 公開パイプライン: venues.jsonだけを検証・commit

これにより、地図と日程タブで日付・中止・変更情報の正本が分かれることを防ぐ。

## chiiki/配下（地域ページ、505団体）

地方ブロック別ディレクトリにorg-XXX/index.htmlで団体ごとのページを配置：
chubu, chugoku, hokkaido, hokuriku, kanto, kinki, kyushu, okinawa, shikoku, tohoku

各ページにLINEボタン設置済み（流入元＝団体名自動送信、.btn-line）。

## docs/（danshu-de-go側、利用者向け）

danshu-toolsのdocs/（開発者向け監査.md）とは別物。利用者向けhtmlマニュアル：
- docs/faq.html: よくある質問
- docs/manual.html: 使い方ガイド
- docs/manual-kanjisan.html
- docs/manual-rengokai.html
- docs/notes/handover_2026-07-03.md: 開発引き継ぎメモ（これは開発者向け）

## 未整理ファイル（棚卸し未着手、2026-07-03時点）

soiのdanshu-de-go直下に存在。git未追跡で実害はないが要判断：
- .bakファイル群: app.js.bak系4種、index.html.bak系3種
- Claude.ai由来と見られる混入ファイル: memories.json, users.json, uuidファイル2件
- 空ファイル「1」（誤操作の可能性）
- danshu-de-go.zip（2.9MB）
- gen-main.schedule-work.py.before（genのバックアップ、soi上に混入）

いずれも削除・.gitignore追加の判断は未確定。手を入れる前に確認が必要。
