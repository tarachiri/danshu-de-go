#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
enrich_venues.py - venues テーブルを meetings でエンリッチして
venues.json に JSON 配列として書き込む。
 - 座標 / 全地域(195ピン) を venues から保持
 - 埼玉(新生会)の例会は meetings テーブルにスケジュールが完備しているため、
   day_of_week + week_of_month + start_time/end_time から
   next_date(次回開催日) / recurrence(周期文字列) / 時刻 を算出して供給する。
   → ポップアップに「次回開催日・時刻・周期」が出るようになる。
 - 同一会場に複数例会がある場合は「最も近い next_date」の例会を採用。
"""
import sqlite3, json, re, shutil
from datetime import date, timedelta

DB = "/home/maji/danshu.db"
JSON_FILE = "/home/maji/danshu-de-go/venues.json"

JP_DOW = {'月': 0, '火': 1, '水': 2, '木': 3, '金': 4, '土': 5, '日': 6}

def norm_venue(s):
    """会場名の表記ゆれ吸収キー: 空白(半角/全角)・長音ーを除去。
    例: 'ふじみ野...プラザ　フクトピア'/'岩槻駅東口 コミュニティーセンター'/
        '下落合コミュニティセンター' をmeetings側の表記と一致させる。"""
    return re.sub(r'[\s　ー]', '', s or '')

def clean_address(address):
    if not address: return ""
    addr = address
    p = re.search(r'〒\d{3}-\d{4}\s*(.+)', addr)
    if p: addr = p.group(1)
    addr = addr.replace("日本、", "").replace("日本,", "")
    addr = re.sub(r'\s*(ビル|アパート|マンション|パルコ|タワー|ウィング)\S*.*$', '', addr)
    return addr.strip().strip(',，')

def parse_weeks(wk):
    """week_of_month を週番号setに。'every'/空 は None(=毎週)。"""
    if not wk or wk == 'every':
        return None
    return {int(x) for x in wk.split(',') if x.strip().isdigit()}

def compute_next_date(dow, wk, today):
    """day_of_week(日本語1文字) + week_of_month から、today以降で最も近い開催日(ISO)。"""
    target = JP_DOW.get((dow or '').strip())
    if target is None:
        return ""
    weeks = parse_weeks(wk)
    for i in range(0, 70):  # 最大10週先まで探索
        d = today + timedelta(days=i)
        if d.weekday() != target:
            continue
        occ = (d.day - 1) // 7 + 1  # その月の第何回目の曜日か
        if weeks is None or occ in weeks:
            return d.isoformat()
    return ""

def recurrence_str(dow, wk):
    """周期の人間可読文字列。例: 第1・第3水曜 / 毎週土曜"""
    dow = (dow or '').strip()
    if not dow:
        return ""
    if not wk or wk == 'every':
        return f"毎週{dow}曜"
    weeks = [x.strip() for x in wk.split(',') if x.strip()]
    return "・".join(f"第{w}" for w in weeks) + f"{dow}曜"

TODAY = date.today()

conn = sqlite3.connect(DB)
c = conn.cursor()

# --- meetings(active) を venue 名でまとめる。next_date を算出し、会場ごとに最早を採用 ---
c.execute("""
    SELECT name, venue, day_of_week, week_of_month, start_time, end_time,
           contact_phone, needs_verification, official_url
    FROM meetings
    WHERE status = 'active' AND venue IS NOT NULL AND venue <> ''
""")
mt_by_venue = {}   # venue -> 採用する1例会のenrich辞書
for (name, venue, dow, wk, st, et, phone, nv, url) in c.fetchall():
    nd = compute_next_date(dow, wk, TODAY)
    cand = {
        "meeting_name": name or "",
        "next_date": nd,
        "recurrence": recurrence_str(dow, wk),
        "start_time": st or "",
        "end_time": et or "",
        "contact_phone": phone or "",
        "needs_verification": int(nv) if nv is not None else 0,
        "official_url": url or "",
    }
    cur = mt_by_venue.get(venue)
    # 最も近いnext_dateを優先。next_dateが無いものより有るものを優先。
    def keyfn(x):
        return x["next_date"] or "9999-12-31"
    if cur is None or keyfn(cand) < keyfn(cur):
        # needs_verification/official_url は会場内のいずれかが立っていれば残す
        if cur is not None:
            cand["needs_verification"] = max(cand["needs_verification"], cur["needs_verification"])
            cand["official_url"] = cand["official_url"] or cur["official_url"]
        mt_by_venue[venue] = cand
    else:
        cur["needs_verification"] = max(cur["needs_verification"], cand["needs_verification"])
        cur["official_url"] = cur["official_url"] or cand["official_url"]

# 表記ゆれ吸収用の正規化キー索引（完全一致で取れなかった会場のフォールバック）
mt_by_norm = {norm_venue(venue): venue for venue in mt_by_venue}
used_venues = set()  # エンリッチに使われた meetings.venue 名

# --- venues(座標あり全件) をベースに、meetings でエンリッチ ---
c.execute("""
    SELECT id, facility_name, address, latitude, longitude, meeting_name,
           schedule, contact_phone, prefecture, next_date,
           start_time, end_time, recurrence, building_name, meeting_type,
           official_url
    FROM venues
    WHERE latitude IS NOT NULL AND COALESCE(is_hidden, 0) = 0
    ORDER BY next_date ASC, prefecture, facility_name
""")

venues = []
matched = 0
for row in c.fetchall():
    (id_, facility, address, lat, lng, meeting, schedule, phone,
     pref, next_date, start_time, end_time, recurrence, building, mtype, official_url) = row
    # 完全一致→正規化一致 の順で同名会場の例会データを引く
    src_venue = facility if facility in mt_by_venue else mt_by_norm.get(norm_venue(facility))
    m = mt_by_venue.get(src_venue) if src_venue else None
    if m:
        matched += 1
        used_venues.add(src_venue)
    venues.append({
        "id": id_,
        "facility_name": facility or "",
        "address": clean_address(address or facility or ""),
        "lat": lat, "lng": lng,
        # 例会名: venues優先→meetings→空
        "meeting_name": (meeting or "") or (m["meeting_name"] if m else ""),
        "schedule": schedule or "",
        "contact_phone": (phone or "") or (m["contact_phone"] if m else ""),
        "prefecture": pref or "",
        # next_date/時刻/周期: venues優先→meetings算出値で補完
        "next_date": (next_date or "") or (m["next_date"] if m else ""),
        "start_time": (start_time or "") or (m["start_time"] if m else ""),
        "end_time": (end_time or "") or (m["end_time"] if m else ""),
        "recurrence": (recurrence or "") or (m["recurrence"] if m else ""),
        "building_name": building or "",
        "meeting_type": mtype or "",
        "needs_verification": m["needs_verification"] if m else 0,
        "official_url": official_url or (m["official_url"] if m else ""),
    })

# 参考: JOINできなかった active な meetings.venue（座標供給元が無い）
unmatched = [(m["meeting_name"], venue) for venue, m in mt_by_venue.items()
             if venue not in used_venues]

conn.close()

# --- venues.json に JSON 配列として書き込む ---
shutil.copyfile(JSON_FILE, JSON_FILE + ".bak-" + TODAY.isoformat().replace("-", ""))
with open(JSON_FILE, "w", encoding="utf-8") as f:
    json.dump(venues, f, ensure_ascii=False, indent=0)

nd_total = sum(1 for v in venues if v["next_date"])
print(f"✅ venues.json 書き込み完了: {len(venues)}ピン (meetingsエンリッチ: {matched}件 / next_date有: {nd_total}件)")
nv_pins = [v for v in venues if v["needs_verification"] == 1]
print(f"⚠️ needs_verification=1 のピン: {len(nv_pins)}件")
for v in nv_pins:
    print(f"   - {v['meeting_name'] or v['facility_name']} @ {v['facility_name']} | url={'有' if v['official_url'] else '無'}")
print(f"🔌 座標が無くJOINできなかった active meetings: {len(unmatched)}件")
for name, venue in unmatched:
    print(f"   - {name} @ {venue}")
