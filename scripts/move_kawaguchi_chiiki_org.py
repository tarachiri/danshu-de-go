#!/usr/bin/env python3
"""Move the confirmed Kawaguchi Danshukai listing from Tokyo to Saitama.

This is an explicit correction for legacy zendanren organization ID 466.  The
legacy generator classifies it from a Tokyo contact postal code, while the
normalized organization record and the confirmed operational scope are Saitama.
Keep the old public URL as a static guide page so external links do not break.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TOKYO = ROOT / "chiiki/kanto/tokyo"
SAITAMA = ROOT / "chiiki/kanto/saitama"
ORG_SLUG = "org-466"
OLD_URL = "https://dansyu-go.nukadokonokai.com/chiiki/kanto/tokyo/org-466/"
NEW_URL = "https://dansyu-go.nukadokonokai.com/chiiki/kanto/saitama/org-466/"


def write_if_changed(path: Path, content: str, *, apply: bool) -> bool:
    original = path.read_text(encoding="utf-8") if path.exists() else ""
    if original == content:
        return False
    if apply:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
    return True


def organization_page() -> str:
    """Return a self-contained corrected page; do not depend on the redirect page."""
    return f'''<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>川口断酒会｜埼玉県の断酒会｜断酒でGO!!</title>
<meta name="description" content="埼玉県で活動する全日本断酒連盟加盟「川口断酒会」の情報です。アルコール依存症でお困りの方、断酒・回復を目指す方はご連絡ください。">
<link rel="canonical" href="{NEW_URL}">
<link rel="stylesheet" href="/chiiki/chiiki.css">
<meta property="og:title" content="川口断酒会｜埼玉県の断酒会｜断酒でGO!!">
<meta property="og:description" content="埼玉県で活動する全日本断酒連盟加盟「川口断酒会」の情報です。">
<meta property="og:type" content="website">
</head>
<body>
<header class="site-header"><a href="/" class="logo">断酒でGO!!</a><nav><a href="/chiiki/">地域から探す</a><a href="/">マップを見る</a></nav></header>
<main>
<nav class="breadcrumb"><span><a href="/chiiki/">地域トップ</a></span><span><a href="/chiiki/kanto/">関東ブロック</a></span><span><a href="/chiiki/kanto/saitama/">埼玉県</a></span><span>川口断酒会</span></nav>
<div class="page-hero"><div class="org-badge">全日本断酒連盟 加盟</div><h1>川口断酒会</h1><p class="org-pref">📍 埼玉県で活動中</p></div>
<div class="card"><p>川口断酒会は、埼玉県で活動する断酒を応援する会です。アルコール依存症でお困りの方やご家族が、同じ悩みを持つ仲間と一緒に歩める場所です。</p></div>
<div class="card"><h2>連絡先・基本情報</h2><table class="info-table"><tr><th>電話</th><td><a href="tel:090-2302-8510">090-2302-8510</a></td></tr><tr><th>代表者</th><td>高橋 一光</td></tr><tr><th>活動エリア</th><td>埼玉県</td></tr></table><a href="tel:090-2302-8510" class="btn-phone">📞 090-2302-8510 に電話する</a></div>
<div class="card"><h2>参加・お問い合わせ</h2><p>例会への参加・見学はお気軽にご連絡ください。</p><a href="https://line.me/R/ti/p/@867qlgsx?text=川口断酒会のページから問い合わせ" class="btn-line">🟢 LINEで問い合わせる</a></div>
<div class="card"><h2>埼玉県の相談窓口</h2><table class="info-table"><tr><th>機関名</th><td>埼玉県立精神保健福祉センター</td></tr><tr><th>電話</th><td><a href="tel:048-723-1111">048-723-1111</a></td></tr><tr><th>詳細</th><td><a href="https://www.pref.saitama.lg.jp/b0609/" target="_blank" rel="noopener">公式サイトはこちら</a></td></tr></table></div>
<!-- CHIIKI_MEETINGS_LINK_START -->
<div class="card chiiki-meetings-link"><h2>今後の例会を探す</h2><a class="btn-meetings" href="/meetings/saitama/">この都道府県の今後の例会予定を見る</a></div>
<!-- CHIIKI_MEETINGS_LINK_END -->
<div class="back-links"><a href="../">← 埼玉県の一覧に戻る</a><a href="/chiiki/kanto/">← 関東ブロックに戻る</a><a href="/chiiki/">← 地域トップに戻る</a></div>
</main>
<footer class="site-footer"><p>断酒でGO!! は全日本断酒連盟加盟断酒会の情報を提供しています。</p><p><a href="/">マップトップ</a> ｜ <a href="/chiiki/">地域から探す</a></p></footer>
</body>
</html>
'''


def redirect_page() -> str:
    return f'''<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="refresh" content="0; url=/chiiki/kanto/saitama/{ORG_SLUG}/">
<link rel="canonical" href="{NEW_URL}">
<title>川口断酒会｜埼玉県の断酒会｜断酒でGO!!</title>
</head>
<body>
<p><a href="/chiiki/kanto/saitama/{ORG_SLUG}/">川口断酒会（埼玉県）のページへ進む</a></p>
</body>
</html>
'''


def list_item() -> str:
    return '''    <li>
      <a href="./org-466/">
        <span class="item-name">川口断酒会</span>
        <span class="item-sub">📍 埼玉県</span>
      </a>
    </li>'''


def update_index(path: Path, *, add: bool) -> str:
    source = path.read_text(encoding="utf-8")
    source = re.sub(
        r'\s*<li>\s*<a href="\./org-466/">.*?</a>\s*</li>',
        "",
        source,
        flags=re.DOTALL,
    )
    if add:
        marker = r'(<li>\s*<a href="\./org-465/">.*?</a>\s*</li>)'
        source, count = re.subn(marker, r"\1\n" + list_item(), source, count=1, flags=re.DOTALL)
        if count != 1:
            raise ValueError(f"{path} に埼玉南部断酒新生会の挿入位置がありません")

    match = re.search(r'(<script type="application/ld\+json">\s*)(\{.*?\})(\s*</script>)', source, flags=re.DOTALL)
    if match is None:
        raise ValueError(f"{path} のItemListが見つかりません")
    data = json.loads(match.group(2))
    items = [item for item in data["itemListElement"] if not item["url"].endswith(f"/{ORG_SLUG}/")]
    if add:
        items.append({"@type": "ListItem", "name": "川口断酒会", "url": NEW_URL})
    for position, item in enumerate(items, start=1):
        item["position"] = position
    data["numberOfItems"] = len(items)
    data["itemListElement"] = items
    source = source[:match.start(2)] + json.dumps(data, ensure_ascii=False, indent=2) + source[match.end(2):]

    prefecture = "埼玉県" if add else "東京都"
    umbrella_count = sum("連合会" in item["name"] for item in items)
    group_count = len(items) - umbrella_count
    description = f"{prefecture}の全日本断酒連盟加盟の{group_count}断酒会・{umbrella_count}連合会（計{len(items)}団体ページ）の一覧です。"
    source = re.sub(
        rf'({prefecture}の全日本断酒連盟加盟の)\d+断酒会・\d+連合会（計\d+団体ページ）の一覧です。',
        description,
        source,
    )
    source = re.sub(
        r'全日本断酒連盟加盟 <strong>\d+断酒会・\d+連合会</strong>（計\d+団体ページ）',
        f"全日本断酒連盟加盟 <strong>{group_count}断酒会・{umbrella_count}連合会</strong>（計{len(items)}団体ページ）",
        source,
    )
    return source


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    old_page = TOKYO / ORG_SLUG / "index.html"
    changes = {
        SAITAMA / ORG_SLUG / "index.html": organization_page(),
        old_page: redirect_page(),
        TOKYO / "index.html": update_index(TOKYO / "index.html", add=False),
        SAITAMA / "index.html": update_index(SAITAMA / "index.html", add=True),
    }
    changed = [path for path, content in changes.items() if write_if_changed(path, content, apply=args.apply)]
    print(f"更新予定: {len(changed)}ファイル")
    for path in changed:
        print(path.relative_to(ROOT))


if __name__ == "__main__":
    main()
