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

## 確認事項（未実施）

- 実機（iOS Safari／Android Chrome）でボトムナビとの重なりが解消されて
  いるか目視確認
- 地図のズーム操作時にattributionが正しく追従するか確認
