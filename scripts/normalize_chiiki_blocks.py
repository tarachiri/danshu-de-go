#!/usr/bin/env python3
"""地域ページの表示を、合意済みの9ブロック構成へそろえる。

公開URLは維持する。沖縄県の団体ページは既存の
``/chiiki/okinawa/okinawa/`` を使い続け、九州・沖縄ブロックの入口から案内する。
"""
from __future__ import annotations

import argparse
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CHIIKI = ROOT / "chiiki"

OKINAWA_REDIRECT = """<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0; url=/chiiki/kyushu/">
<link rel="canonical" href="https://dansyu-go.nukadokonokai.com/chiiki/kyushu/">
<title>九州・沖縄ブロックへ移動します｜断酒でGO!!</title>
</head>
<body>
<p><a href="/chiiki/kyushu/">九州・沖縄ブロックの断酒会一覧へ移動します</a></p>
</body>
</html>
"""


def update(path: Path, source: str, *, apply: bool) -> bool:
    if source == path.read_text(encoding="utf-8"):
        return False
    if apply:
        path.write_text(source, encoding="utf-8")
    return True


def normalize(*, apply: bool) -> list[Path]:
    changed: list[Path] = []

    top = CHIIKI / "index.html"
    source = top.read_text(encoding="utf-8")
    source = source.replace("九州ブロック</span>\n        <span class=\"item-sub\">75団体", "九州・沖縄ブロック</span>\n        <span class=\"item-sub\">92団体")
    old_okinawa_card = '''    <li>
      <a href="./okinawa/">
        <span class="item-name">沖縄ブロック</span>
        <span class="item-sub">17団体</span>
      </a>
    </li>
'''
    source = source.replace(old_okinawa_card, "")
    if update(top, source, apply=apply):
        changed.append(top)

    map_top = ROOT / "index.html"
    source = map_top.read_text(encoding="utf-8")
    source = source.replace(
        '<li><a href="/chiiki/kyushu/"><strong>九州</strong>の断酒会を探す</a></li>\n'
        '    <li><a href="/chiiki/okinawa/"><strong>沖縄</strong>の断酒会を探す</a></li>',
        '<li><a href="/chiiki/kyushu/"><strong>九州・沖縄</strong>の断酒会を探す</a></li>',
    )
    if update(map_top, source, apply=apply):
        changed.append(map_top)

    kyushu = CHIIKI / "kyushu" / "index.html"
    source = kyushu.read_text(encoding="utf-8").replace("九州ブロック", "九州・沖縄ブロック")
    source = source.replace("断酒会75団体", "断酒会92団体").replace("<strong>75団体</strong>", "<strong>92団体</strong>")
    okinawa_card = '''    <li>
      <a href="/chiiki/okinawa/okinawa/">
        <span class="item-name">沖縄県</span>
        <span class="item-sub">17団体</span>
      </a>
    </li>
'''
    if 'href="/chiiki/okinawa/okinawa/"' not in source:
        marker = '''  </ul>
</div>

<div class="card">
  <h2>断酒会・アルコール依存症について</h2>'''
        if marker not in source:
            raise RuntimeError(f"想定した地域ページ構造が見つかりません: {kyushu}")
        source = source.replace(marker, okinawa_card + marker, 1)
    source = source.replace('<div class=\\"card\\">', '<div class="card">')
    if update(kyushu, source, apply=apply):
        changed.append(kyushu)

    for path in sorted((CHIIKI / "kyushu").rglob("*.html")):
        if path == kyushu:
            continue
        source = path.read_text(encoding="utf-8").replace("九州ブロック", "九州・沖縄ブロック")
        if update(path, source, apply=apply):
            changed.append(path)

    for path in sorted((CHIIKI / "okinawa").rglob("*.html")):
        if path == CHIIKI / "okinawa" / "index.html":
            if update(path, OKINAWA_REDIRECT, apply=apply):
                changed.append(path)
            continue
        source = path.read_text(encoding="utf-8")
        source = source.replace("九州・九州・沖縄ブロック", "九州・沖縄ブロック")
        source = source.replace('href="/chiiki/okinawa/">沖縄ブロック</a>', 'href="/chiiki/kyushu/">九州・沖縄ブロック</a>')
        source = source.replace('href="/chiiki/okinawa/">← 沖縄ブロックに戻る</a>', 'href="/chiiki/kyushu/">← 九州・沖縄ブロックに戻る</a>')
        source = source.replace('href="/chiiki/okinawa/">九州・沖縄ブロック</a>', 'href="/chiiki/kyushu/">九州・沖縄ブロック</a>')
        source = source.replace('href="/chiiki/okinawa/">← 九州・沖縄ブロックに戻る</a>', 'href="/chiiki/kyushu/">← 九州・沖縄ブロックに戻る</a>')
        source = source.replace(">沖縄ブロック<", ">九州・沖縄ブロック<")
        source = source.replace(">← 沖縄ブロックに戻る<", ">← 九州・沖縄ブロックに戻る<")
        if update(path, source, apply=apply):
            changed.append(path)

    return changed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="ファイルへ反映する")
    args = parser.parse_args()
    changed = normalize(apply=args.apply)
    print(f"{'更新' if args.apply else '更新予定'}: {len(changed)}ファイル")
    for path in changed:
        print(path.relative_to(ROOT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
