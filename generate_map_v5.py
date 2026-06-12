#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_map_v5.py - venues を meetings でエンリッチして venues.json を生成
 - 座標 / 全地域(195ピン) を venues から保持
 - 埼玉(新生会)の例会は meetings テーブルにスケジュールが完備しているため、
   day_of_week + week_of_month + start_time/end_time から
   next_date(次回開催日) / recurrence(周期文字列) / 時刻 を算出して供給する。
 - 同一会場に複数例会がある場合は「最も近い next_date」の例会を採用。
"""
import sqlite3, json, re
from datetime import date, timedelta

DB_PATH = "/home/maji/danshu.db"
OUTPUT_PATH = "/home/maji/danshu-de-go/venues.json"

JP_DOW = {'月': 0, '火': 1, '水': 2, '木': 3, '金': 4, '土': 5, '日': 6}

def norm_venue(s):
    """会場名の表記ゆれ吸収キー"""
    return re.sub(r'[\s　ー]', '', s or '')

def clean_address(address):
    if not address: return ""
    addr = address
    p = re.search(r'〒\d{3}-\d{4}\s*(.+)', addr)
    if p: addr = p.group(1)
    addr = addr.replace("日本、","").replace("日本,","")
    addr = re.sub(r'\s*(ビル|アパート|マンション|パルコ|タワー|ウィング)\S*.*$','',addr)
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
    for i in range(0, 70):
        d = today + timedelta(days=i)
        if d.weekday() != target:
            continue
        occ = (d.day - 1) // 7 + 1
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

def main():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    TODAY = date.today()
    
    # --- meetings(active) をエンリッチデータとして準備 ---
    c.execute("""
        SELECT name, venue, day_of_week, week_of_month, start_time, end_time,
               contact_phone, needs_verification, official_url
        FROM meetings
        WHERE status = 'active' AND venue IS NOT NULL AND venue <> ''
    """)
    mt_by_venue = {}
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
        def keyfn(x):
            return x["next_date"] or "9999-12-31"
        if cur is None or keyfn(cand) < keyfn(cur):
            if cur is not None:
                cand["needs_verification"] = max(cand["needs_verification"], cur["needs_verification"])
                cand["official_url"] = cand["official_url"] or cur["official_url"]
            mt_by_venue[venue] = cand
        else:
            cur["needs_verification"] = max(cur["needs_verification"], cand["needs_verification"])
            cur["official_url"] = cur["official_url"] or cand["official_url"]
    
    mt_by_norm = {norm_venue(venue): venue for venue in mt_by_venue}
    used_venues = set()
    
    # --- venues(座標あり全件) をベースに、meetings でエンリッチ ---
    c.execute("""
        SELECT id, facility_name, address, latitude, longitude,
               meeting_name, schedule, contact_phone, prefecture,
               next_date, start_time, end_time, recurrence,
               building_name, meeting_type, official_url, is_hidden
        FROM venues
        WHERE latitude IS NOT NULL AND (is_hidden IS NULL OR is_hidden = 0)
        ORDER BY next_date ASC, prefecture, facility_name
    """)
    venues = []
    matched = 0
    for row in c.fetchall():
        (id_, facility, address, lat, lng,
         meeting, schedule, phone, pref,
         next_date, start_time, end_time, recurrence,
         building_name, meeting_type, official_url, is_hidden) = row
        
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
            "meeting_name": (meeting or "") or (m["meeting_name"] if m else ""),
            "schedule": schedule or "",
            "contact_phone": (phone or "") or (m["contact_phone"] if m else ""),
            "prefecture": pref or "",
            "next_date": (next_date or "") or (m["next_date"] if m else ""),
            "start_time": (start_time or "") or (m["start_time"] if m else ""),
            "end_time": (end_time or "") or (m["end_time"] if m else ""),
            "recurrence": (recurrence or "") or (m["recurrence"] if m else ""),
            "building_name": building_name or "",
            "meeting_type": meeting_type or "通常",
            "official_url": official_url or (m["official_url"] if m else ""),
            "needs_verification": m["needs_verification"] if m else 0,
        })
    
    conn.close()
    
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(venues, f, ensure_ascii=False, indent=0)
    
    nd_total = sum(1 for v in venues if v["next_date"])
    print(f"✅ {len(venues)}件 venues.json 生成完了！ (meetingsエンリッチ: {matched}件 / next_date有: {nd_total}件)")
    
    today_events = [v for v in venues if v["next_date"] == TODAY.isoformat()]
    if today_events:
        print(f"🔴 今日開催: {len(today_events)}件")
        for e in today_events:
            print(f"  {e['start_time']} {e['meeting_name']}")

if __name__ == "__main__":
    main()
