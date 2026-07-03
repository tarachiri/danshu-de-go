# Leaflet著作権表示（attribution）の位置修正

*作成日: 2026-07-04*

## 課題

マップ画面（`#map`）下部に表示されるLeafletの著作権表示
（`Leaflet | © OpenStreetMap contributors`）が、画面幅いっぱいの
白い帯としてボトムナビゲーション（マップ／日程／新着／かもちゃん）
の直上に表示され、地図の可視領域を圧迫していた。

利用者（特に例会を探している最中の断酒会員）にとって、地図が見づらい
状態は例会情報へのアクセス体験を損なうため、放置できない表示不具合と
して対応。

## 根本原因

`style.css` 内で、Leafletのズームコントロールと著作権表示が共有する
親クラス `.leaflet-bottom` に対して、位置指定ルールが**2箇所で矛盾する
値**で二重定義されていた。

```css
/* 1箇所目 */
.leaflet-bottom { bottom: 65px !important; }

/* 2箇所目（後勝ちでこちらが適用される） */
.leaflet-bottom.leaflet-right { bottom: 62px !important; }
.leaflet-bottom.leaflet-left { bottom: 62px !important; }
```

さらに著作権表示（`.leaflet-control-attribution`）専用のスタイルが
一切存在せず、フォントサイズ・背景・幅の制御がされていなかったため、
横幅いっぱいに広がる帯として表示されていた。

この種の「同一要素に対する重複・矛盾したCSS定義」は、複数セッション
（かもちゃん／ふーちゃん）が同じファイルを別々のタイミングで編集した
際に発生しやすいパターンであり、今後も注意が必要。

## 対応内容

`.leaflet-bottom` の矛盾した二重定義を削除し、
`.leaflet-control-attribution` 専用のスタイルを新設した。

```css
/* Leafletコントロール（ズーム等）をボトムナビの上に */
.leaflet-control-zoom { bottom: 70px !important; }

/* Leaflet帰属（著作権表示）：ボトムナビの上・小さく・控えめに */
.leaflet-control-attribution {
  bottom: 65px !important;
  font-size: 9px !important;
  padding: 1px 4px !important;
  background: rgba(255,255,255,0.75) !important;
  line-height: 1.2 !important;
  max-width: 60vw;
}
```

- ズームコントロールと著作権表示を別クラスで独立管理し、意図しない
  衝突を防止
- 著作権表示は横幅60vwを上限とし、フォントサイズを縮小、背景を半透明に
  することで地図の視認性を優先

対象ファイル: `style.css`（danshu-de-goリポジトリ）
コミット: `d5d2e71` "fix: Leaflet著作権表示(attribution)の位置・サイズを専用クラスで制御"

## 追記（2026-07-04・第2回対応）

上記の対応（フォントサイズ縮小・位置調整）を本番反映後、実機で確認した
ところ「小さくはなったが、まだ地図の内側に文字が入り込んで見える」と
のフィードバックがあった。

### 分かったこと

`.leaflet-control-attribution` はLeafletの仕様上、地図コンテナ
（`.leaflet-container`）の内側に絶対配置される要素であり、CSSの
`bottom` 値をどれだけ調整しても「地図の内側」という制約からは
逃れられない。`#map` 自体の高さ（`calc(100dvh - 60px)`）はボトムナビの
上で正しく終わっているため、著作権表示は「地図の一番下のライン上」に
位置しており、これは今回の圧迫感の根本原因ではなく、Leafletの設計上
そこにしか置けない、という構造的な制約だった。

### 抜本対応

地図内蔵の著作権表示を完全に無効化し（`attribution: false`）、
かわりに地図の外・独立したDOM要素として `#map-attribution` を新設。
ボトムナビ（`#bottom-nav`）の直上に高さ16pxの帯として固定配置し、
`#map` の高さもその16px分を差し引いて再計算するようにした。

```js
// app.js
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: false
}).addTo(map);
```

```html
<!-- index.html：#bottom-navの直前に追加 -->
<div id="map-attribution">© <a href="https://www.openstreetmap.org/copyright"
  target="_blank" rel="noopener">OpenStreetMap</a> contributors</div>
```

```css
/* style.css */
#map { height: calc(100dvh - 76px) !important; } /* 60px+16px */
#map-attribution {
  position: fixed; left: 0; right: 0; bottom: 60px; height: 16px;
  background: #16213e; border-top: 1px solid #0f3460;
  color: rgba(255,255,255,0.4); font-size: 9px; line-height: 16px;
  text-align: center; z-index: 1000; padding: 0 4px;
}
.leaflet-control-zoom { bottom: 86px !important; } /* 地図外バー分を追加考慮 */
```

これにより著作権表示は地図の可視領域を一切侵食しなくなり、独立した
帯として常にボトムナビの直上に表示される。OpenStreetMapの利用規約が
求める帰属表示自体は維持している。

## 確認事項（未実施）

- 実機（iOS Safari／Android Chrome）で地図が著作権表示帯の分だけ
  正しく縮小され、重なりが完全に解消されているか目視確認
- ズームボタン（`.leaflet-control-zoom`）が地図外バーの上に正しく
  表示されるか確認
