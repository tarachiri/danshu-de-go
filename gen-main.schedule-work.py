from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import anthropic
import asyncio
import os
import math
import re
import json
import httpx
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from dotenv import load_dotenv
from linebot.v3 import WebhookHandler
from linebot.v3.messaging import (
    Configuration,
    ApiClient,
    MessagingApi,
    ReplyMessageRequest,
    PushMessageRequest,
    TextMessage,
)
from linebot.v3.webhooks import MessageEvent, TextMessageContent
from linebot.v3.exceptions import InvalidSignatureError

load_dotenv()

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

LINE_CHANNEL_SECRET = os.environ.get("LINE_CHANNEL_SECRET", "")
LINE_CHANNEL_ACCESS_TOKEN = os.environ.get("LINE_CHANNEL_ACCESS_TOKEN", "")
LINE_ADMIN_USER_ID = os.environ.get("LINE_ADMIN_USER_ID", "")

line_configuration = Configuration(access_token=LINE_CHANNEL_ACCESS_TOKEN)
line_handler = WebhookHandler(LINE_CHANNEL_SECRET)

SYSTEM_PROMPT = """あなたは「かもちゃん」です。断酒でGO!!のアシスタントです🦆
断酒でGO!!は全国の断酒会例会場を地図で探せるアプリです。

以下のことをお手伝いします：
- アプリの使い方の説明
- 例会場の探し方・例会情報の案内
- 掲載情報の間違いや修正依頼の受付
- 断酒会についての基本的な質問

【会話の姿勢】
- 雑談や弱音には、まず気持ちを受け止めて自然に返す
- 「雑談が得意ではない」「私はAIなので」のように距離を取らない
- すぐ例会案内に寄せすぎず、1〜2文は相手の気持ちに付き合う
- 飲みたい気持ち・孤立・不安が見える時は、仲間、例会、専門家につながる選択肢をやさしく示す

【重要】
- 例会情報は提供されたデータのみ案内する
- データにない情報は「わからない」と答える
- 必ず公式サイトで最新情報を確認するよう伝える
- 医療的なアドバイスはしない
- 薬・治療・離脱症状・自傷他害の相談は専門家や緊急窓口につなぐ
- 返答は短く、やさしく、かもちゃんらしい口調で
- 絵文字は控えめに（1返答に1〜2個まで）"""

ESCALATION_KEYWORDS = [
    "登録", "修正", "変更", "削除", "追加", "更新", "間違い", "誤り", "違う", "正しく",
    "取材", "掲載", "メディア", "記者", "新聞", "テレビ", "ラジオ", "雑誌",
    "苦情", "クレーム", "要望", "改善", "バグ", "不具合", "おかしい",
    "担当者", "責任者", "連絡先", "電話番号", "メールアドレス",
    "中止", "休止", "休会", "中断", "お休み", "やめ", "廃止", "閉鎖",
]

venues_data: list = []
schedule_data: list = []

JST = ZoneInfo("Asia/Tokyo")

WEEKDAY_KEYWORDS = {
    "月曜": 0, "月曜日": 0,
    "火曜": 1, "火曜日": 1,
    "水曜": 2, "水曜日": 2,
    "木曜": 3, "木曜日": 3,
    "金曜": 4, "金曜日": 4,
    "土曜": 5, "土曜日": 5,
    "日曜": 6, "日曜日": 6,
}

DAY_CHAR_MAP = {"月": 0, "火": 1, "水": 2, "木": 3, "金": 4, "土": 5, "日": 6}
DAY_FULL_MAP = {f"{k}曜日": v for k, v in DAY_CHAR_MAP.items()}


def day_to_weekday(day_str: str) -> Optional[int]:
    if day_str in DAY_CHAR_MAP:
        return DAY_CHAR_MAP[day_str]
    if day_str in DAY_FULL_MAP:
        return DAY_FULL_MAP[day_str]
    return None


def haversine(lat1, lng1, lat2, lng2) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def normalize(text: str) -> str:
    return text.lower().replace("　", " ").strip()


PLACE_READING_ALIASES = {
    "たちかわ": "立川",
    "ふっさ": "福生",
    "はちおうじ": "八王子",
    "くにたち": "国立",
    "あきしま": "昭島",
    "こだいら": "小平",
    "ひがしむらやま": "東村山",
    "ひがしくるめ": "東久留米",
    "きよせ": "清瀬",
    "むさしの": "武蔵野",
    "みたか": "三鷹",
    "こがねい": "小金井",
    "ふちゅう": "府中",
    "ちょうふ": "調布",
    "まちだ": "町田",
    "さいたま": "さいたま",
}


def expand_query_for_search(query: str) -> str:
    q = normalize(query)
    aliases = [kanji for kana, kanji in PLACE_READING_ALIASES.items() if kana in q]
    if aliases:
        q += " " + " ".join(normalize(a) for a in aliases)
    return q


def _venue_tokens(venue: dict) -> list:
    tokens = []
    if venue.get("facility_name"):
        tokens.append(normalize(venue["facility_name"]))
    if venue.get("prefecture"):
        tokens.append(normalize(venue["prefecture"]))
    addr = re.sub(r"〒\d{3}-\d{4}\s*", "", venue.get("address", ""))
    addr_norm = normalize(addr)
    pref_norm = normalize(venue.get("prefecture", ""))
    if pref_norm and addr_norm.startswith(pref_norm):
        addr_norm = addr_norm[len(pref_norm):]
    m = re.match(r"^([一-鿿぀-ヿ]+?[市区町村郡])", addr_norm)
    if m and len(m.group(1)) >= 2:
        city_full = m.group(1)
        tokens.append(city_full)
        city_short = re.sub(r"[市区町村郡]+$", "", city_full)
        if len(city_short) >= 2 and city_short != city_full:
            tokens.append(city_short)
    else:
        m2 = re.match(r"^[一-鿿぀-ヿ]+", addr_norm)
        if m2 and len(m2.group()) >= 2:
            tokens.append(m2.group())
    return [t for t in tokens if len(t) >= 2]


def _build_entry(venue: dict, meetings: list, lat=None, lng=None) -> dict:
    entry = {
        "name": venue.get("facility_name", ""),
        "address": venue.get("address", ""),
        "official_url": venue.get("official_url", ""),
        "meetings": meetings,
    }
    if lat is not None and lng is not None and venue.get("lat") and venue.get("lng"):
        entry["distance_km"] = round(haversine(lat, lng, venue["lat"], venue["lng"]), 1)
    return entry


def _schedule_tokens(item: dict) -> list:
    tokens = []
    if item.get("prefecture"):
        tokens.append(normalize(item["prefecture"]))
    addr = re.sub(r"〒\d{3}-\d{4}\s*", "", item.get("address", ""))
    addr_norm = normalize(addr)
    pref_norm = normalize(item.get("prefecture", ""))
    if pref_norm and addr_norm.startswith(pref_norm):
        addr_norm = addr_norm[len(pref_norm):]
    m = re.match(r"^([一-鿿぀-ヿ]+?[市区町村郡])", addr_norm)
    if m and len(m.group(1)) >= 2:
        city_full = m.group(1)
        tokens.append(city_full)
        city_short = re.sub(r"[市区町村郡]+$", "", city_full)
        if len(city_short) >= 2 and city_short != city_full:
            tokens.append(city_short)
    else:
        m2 = re.match(r"^[一-鿿぀-ヿ]+", addr_norm)
        if m2 and len(m2.group()) >= 2:
            tokens.append(m2.group())
    return [t for t in tokens if len(t) >= 2]


def _build_schedule_entry(item: dict, lat=None, lng=None) -> dict:
    meeting = {
        "name": item.get("meeting_name", ""),
        "day_of_week": _weekday_char_from_date(item.get("next_date", "")),
        "start_time": item.get("start_time", ""),
        "end_time": item.get("end_time", ""),
        "recurrence": item.get("recurrence", ""),
        "next_date": item.get("next_date", ""),
    }
    entry = {
        "name": item.get("meeting_name", ""),
        "address": item.get("address", ""),
        "official_url": "",
        "meetings": [meeting],
    }
    if lat is not None and lng is not None and item.get("latitude") and item.get("longitude"):
        entry["distance_km"] = round(haversine(lat, lng, item["latitude"], item["longitude"]), 1)
    return entry


def _weekday_char_from_date(date_str: str) -> str:
    try:
        wd = datetime.fromisoformat(date_str).weekday()
    except Exception:
        return ""
    return ["月", "火", "水", "木", "金", "土", "日"][wd]


def _target_date_from_query(query: str) -> Optional[str]:
    now = datetime.now(JST)
    if "今から" in query or "これから" in query:
        return now.date().isoformat()
    if "今日" in query or "本日" in query or "今夜" in query or "今晩" in query:
        return now.date().isoformat()
    if "明日" in query or "あした" in query:
        return (now.date() + timedelta(days=1)).isoformat()
    return None


def _search_schedule_entries(query: str, lat=None, lng=None, limit=3) -> tuple:
    if not schedule_data:
        return [], ""

    q = expand_query_for_search(query)
    target_date = _target_date_from_query(query)
    target_weekday = None
    if target_date:
        target_weekday = datetime.fromisoformat(target_date).weekday()
    else:
        for kw, wd in WEEKDAY_KEYWORDS.items():
            if kw in query:
                target_weekday = wd
                break

    pool = schedule_data
    if target_date:
        pool = [item for item in pool if item.get("next_date") == target_date]
    elif target_weekday is not None:
        pool = [item for item in pool if day_to_weekday(_weekday_char_from_date(item.get("next_date", ""))) == target_weekday]

    location_pool = [item for item in pool if any(t in q for t in _schedule_tokens(item))]
    if location_pool:
        entries = [_build_schedule_entry(item, lat, lng) for item in location_pool]
        if lat is not None and lng is not None:
            entries.sort(key=lambda x: x.get("distance_km", float("inf")))
        return _dedupe_entries(entries)[:limit], "schedule.jsonの日付つき開催予定を優先して検索しました。"

    place_hint = _extract_place_hint(query)
    if place_hint:
        future_location_pool = [
            item for item in schedule_data
            if any(t in q for t in _schedule_tokens(item))
        ]
        if future_location_pool:
            future_location_pool.sort(key=lambda item: item.get("next_date", "9999-99-99"))
            entries = [_build_schedule_entry(item, lat, lng) for item in future_location_pool[:limit]]
            return _dedupe_entries(entries), (
                "地名はschedule.jsonに一致しましたが、指定された日付・曜日の開催予定はありませんでした。"
                "該当なしと伝えたうえで、以下の今後の日程候補を紹介してください。"
            )
        return [], (
            f"「{place_hint}」という地名に一致する開催予定がschedule.jsonに見つかりませんでした。"
            "無関係な都道府県の候補は出さず、別の地名や都道府県名を尋ねてください。"
        )

    if lat is not None and lng is not None:
        entries = [
            _build_schedule_entry(item, lat, lng)
            for item in pool if item.get("latitude") and item.get("longitude")
        ]
        entries.sort(key=lambda x: x.get("distance_km", float("inf")))
        return _dedupe_entries(entries)[:limit], "schedule.jsonの日付つき開催予定を優先して検索しました。"

    entries = [_build_schedule_entry(item) for item in pool[:limit]]
    note = (
        "schedule.jsonの日付つき開催予定から候補を抜粋しています。"
        "地名や位置情報が無い場合は、特定地域に決め打ちせず、お住まいの都道府県や市区町村を尋ねてください。"
    )
    return _dedupe_entries(entries), note


def _dedupe_entries(entries: list) -> list:
    """venues.json側に表記ゆれ重複が残っていても、同じ施設を複数回案内しないための防御的重複排除"""
    seen = {}
    order = []
    for e in entries:
        key = (e["name"], e["address"])
        if key not in seen:
            seen[key] = e
            order.append(key)
        else:
            existing_names = {m.get("name") for m in seen[key]["meetings"]}
            for m in e["meetings"]:
                if m.get("name") not in existing_names:
                    seen[key]["meetings"].append(m)
                    existing_names.add(m.get("name"))
    return [seen[k] for k in order]


# 都道府県・市区町村の接尾語で終わる地名らしき文字列を検出する
PLACE_SUFFIX_PATTERN = re.compile(r"([一-鿿぀-ヿ]{1,10}?(?:都|道|府|県|市|区|町|村))")
# 接尾語がなくても「立川で」のように位置を示す助詞が続く場合は地名候補とみなす
PLACE_PARTICLE_PATTERN = re.compile(
    r"([一-鿿぀-ヿA-Za-zＡ-Ｚａ-ｚ0-9]{2,8})(?:で|にある|の近く|近く|周辺|付近)"
)
GENERIC_PLACE_HINTS = {"近く", "近所", "周辺", "付近", "ここ", "現在地"}


def _extract_place_hint(query: str) -> Optional[str]:
    """地名らしき文字列を抽出する（都道府県・市区町村マスタとの厳密な照合は行わない簡易判定）"""
    m = PLACE_SUFFIX_PATTERN.search(query)
    if m:
        hint = m.group(1)
        return None if hint in GENERIC_PLACE_HINTS else hint
    m = PLACE_PARTICLE_PATTERN.search(query)
    if m:
        hint = m.group(1)
        return None if hint in GENERIC_PLACE_HINTS else hint
    return None


def _nationwide_sample(limit: int) -> list:
    """地名・GPSどちらも無い場合の参考候補（開催日が近い順）"""
    dated = [v for v in venues_data if v.get("next_date")]
    dated.sort(key=lambda v: v["next_date"])
    return [_build_entry(v, v.get("meetings", [])) for v in dated[:limit]]


def _no_location_fallback(lat, lng, limit, place_hint):
    """地名候補が1件もヒットしなかった場合の応答。venues.jsonの並び順に依存する
    全国フォールバックで無関係な県を返さないよう、状況別に応答を分ける。"""
    if place_hint:
        note = (
            f"「{place_hint}」という地名に一致する例会が見つかりませんでした。"
            "見つからなかったことを正直に伝え、無関係な都道府県の候補は出さずに、"
            "別の地名（都道府県名や市区町村名）を尋ねてください。"
        )
        return [], note

    if lat is not None and lng is not None:
        entries = [
            _build_entry(v, v.get("meetings", []), lat, lng)
            for v in venues_data if v.get("lat") and v.get("lng")
        ]
        entries.sort(key=lambda x: x.get("distance_km", float("inf")))
        return _dedupe_entries(entries)[:limit], ""

    note = (
        "ユーザーは地名も位置情報も指定していません。以下は全国データから開催日が近い順に"
        "抜粋した参考候補です。特定の都道府県に決め打ちせず、お住まいの都道府県や"
        "市区町村を尋ねてください。"
    )
    return _nationwide_sample(limit), note


def search_venues(query: str, lat=None, lng=None, limit=3) -> tuple:
    """例会を検索する。戻り値は (候補リスト, Claudeへの補足メモ) のタプル。
    補足メモは検索状況（地名不一致・地名指定なし等）をsystem promptへ伝えるためのもの。"""
    if not venues_data:
        return [], ""

    now = datetime.now(JST)
    current_weekday = now.weekday()
    current_time = now.strftime("%H:%M")
    q = expand_query_for_search(query)

    target_weekday = None
    time_filter = False

    if "今から" in query or "これから" in query:
        target_weekday = current_weekday
        time_filter = True
    elif "今日" in query or "本日" in query or "今夜" in query or "今晩" in query:
        target_weekday = current_weekday
    elif "明日" in query or "あした" in query:
        target_weekday = (current_weekday + 1) % 7

    if target_weekday is None:
        for kw, wd in WEEKDAY_KEYWORDS.items():
            if kw in query:
                target_weekday = wd
                break

    if target_weekday is not None and schedule_data:
        schedule_results, schedule_note = _search_schedule_entries(query, lat, lng, limit)
        if schedule_results or _extract_place_hint(query) or lat is None or lng is None:
            return schedule_results, schedule_note

    location_candidates = []
    for venue in venues_data:
        tokens = _venue_tokens(venue)
        if any(t in q for t in tokens):
            location_candidates.append(venue)

    def _apply_weekday_filter(pool):
        if target_weekday is None:
            return [_build_entry(v, v.get("meetings", []), lat, lng) for v in pool]
        out = []
        for venue in pool:
            matched = []
            for m in venue.get("meetings", []):
                wd = day_to_weekday(m.get("day_of_week", ""))
                if wd != target_weekday:
                    continue
                if time_filter and m.get("start_time") and m["start_time"] <= current_time:
                    continue
                matched.append(m)
            if matched:
                out.append(_build_entry(venue, matched, lat, lng))
        return out

    # ① 地名一致を最優先（曜日条件より先にフィルタする）
    if location_candidates:
        results = _apply_weekday_filter(location_candidates)
        if lat is not None and lng is not None:
            results.sort(key=lambda x: x.get("distance_km", float("inf")))
        if results:
            return _dedupe_entries(results)[:limit], ""
        # target_weekday が None ならここには来ない（必ずresultsが埋まる）。
        # 地名は一致したが指定曜日の例会が無い場合、候補会場の全日程を渡して「該当なし」を説明させる。
        entries = [_build_entry(v, v.get("meetings", []), lat, lng) for v in location_candidates[:limit]]
        note = "地名は一致しましたが、指定された曜日の例会はありませんでした。他の曜日の候補があれば案内してください。"
        return _dedupe_entries(entries), note

    # ② 地名らしき指定があるのに1件もヒットしない場合、全国データへはフォールバック
    # せず正直に「見つからなかった」と伝える（venues.jsonの並び順に偏った特定県への
    # 決め打ちを避ける。症状Aの再発防止）。
    place_hint = _extract_place_hint(query)
    if place_hint:
        return _no_location_fallback(lat, lng, limit, place_hint)

    # ③ 地名指定なし・GPSありの場合は従来通りGPSベースで絞り込む
    if lat is not None and lng is not None:
        results = _apply_weekday_filter([v for v in venues_data if v.get("lat") and v.get("lng")])
        results.sort(key=lambda x: x.get("distance_km", float("inf")))
        return _dedupe_entries(results)[:limit], ""

    # ④ 地名指定なし・GPSなし（LINE Bot等）：特定の1県に決め打ちせず地域を尋ね返す
    return _no_location_fallback(lat, lng, limit, None)


def needs_escalation(text: str) -> bool:
    return any(kw in text for kw in ESCALATION_KEYWORDS)


def generate_reply(message: str, history: list = [], lat=None, lng=None) -> str:
    search_results, search_note = search_venues(message, lat, lng)

    weekday_names = ["月", "火", "水", "木", "金", "土", "日"]
    now = datetime.now(JST)
    system = SYSTEM_PROMPT
    system += f"\n\n【現在日時】{now.strftime('%Y-%m-%d %H:%M')}（{weekday_names[now.weekday()]}曜日・日本時間）"
    system += "\n【回答ルール】関連する例会情報に指定日の開催がない場合は、該当なしと伝えたうえで候補日程を紹介する。全国データから検索しており、特定県だけとは言わない。"
    if search_results:
        venue_context = "\n\n【関連する例会情報】\n"
        for v in search_results:
            venue_context += f"・{v['name']}（{v['address']}）\n"
            for m in v["meetings"]:
                parts = [m.get("day_of_week", ""), m.get("start_time", ""), m.get("name", "")]
                line_text = "  " + " ".join(p for p in parts if p)
                if v.get("official_url"):
                    line_text += f" {v['official_url']}"
                venue_context += line_text + "\n"
        system += venue_context
    if search_note:
        system += f"\n\n【検索状況に関する注意】{search_note}"

    recent_history = history[-10:]
    messages = [{"role": m["role"], "content": m["content"]} for m in recent_history]
    messages.append({"role": "user", "content": message})

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=500,
        system=system,
        messages=messages,
    )
    return response.content[0].text


async def line_reply(reply_token: str, text: str):
    with ApiClient(line_configuration) as api_client:
        api = MessagingApi(api_client)
        api.reply_message(
            ReplyMessageRequest(
                reply_token=reply_token,
                messages=[TextMessage(text=text)]
            )
        )


async def line_push_admin(text: str):
    if not LINE_ADMIN_USER_ID:
        print("[LINE] LINE_ADMIN_USER_ID未設定のためスキップ")
        return
    with ApiClient(line_configuration) as api_client:
        api = MessagingApi(api_client)
        api.push_message(
            PushMessageRequest(
                to=LINE_ADMIN_USER_ID,
                messages=[TextMessage(text=text)]
            )
        )


async def fetch_venues() -> list:
    cache_buster = datetime.now(JST).strftime("%Y%m%d%H%M%S")
    url = f"https://dansyu-go.nukadokonokai.com/venues.json?v={cache_buster}"
    async with httpx.AsyncClient(timeout=30) as hclient:
        resp = await hclient.get(url)
        resp.raise_for_status()
        return resp.json()


async def fetch_schedule() -> list:
    cache_buster = datetime.now(JST).strftime("%Y%m%d%H%M%S")
    url = f"https://dansyu-go.nukadokonokai.com/schedule.json?v={cache_buster}"
    async with httpx.AsyncClient(timeout=30) as hclient:
        resp = await hclient.get(url)
        resp.raise_for_status()
        return resp.json()


async def reload_venues_daily():
    global venues_data, schedule_data
    while True:
        now = datetime.now(JST)
        next_reload = now.replace(hour=5, minute=30, second=0, microsecond=0)
        if now >= next_reload:
            next_reload += timedelta(days=1)
        wait_sec = (next_reload - now).total_seconds()
        print(f"[{datetime.now(JST).strftime('%H:%M')}] 次回venues.json再読み込み: {next_reload.strftime('%m/%d %H:%M')}（{int(wait_sec/3600)}時間後）")
        await asyncio.sleep(wait_sec)
        try:
            venues_data = await fetch_venues()
            print(f"[{datetime.now(JST).strftime('%H:%M')}] venues.json 再読み込み完了: {len(venues_data)} 件")
        except Exception as e:
            print(f"[{datetime.now(JST).strftime('%H:%M')}] venues.json 再読み込み失敗: {e}")
        try:
            schedule_data = await fetch_schedule()
            print(f"[{datetime.now(JST).strftime('%H:%M')}] schedule.json 再読み込み完了: {len(schedule_data)} 件")
        except Exception as e:
            print(f"[{datetime.now(JST).strftime('%H:%M')}] schedule.json 再読み込み失敗: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global venues_data, schedule_data
    try:
        venues_data = await fetch_venues()
        print(f"venues.json 読み込み完了: {len(venues_data)} 件")
    except Exception as e:
        print(f"venues.json 読み込み失敗: {e}")
        venues_data = []
    try:
        schedule_data = await fetch_schedule()
        print(f"schedule.json 読み込み完了: {len(schedule_data)} 件")
    except Exception as e:
        print(f"schedule.json 読み込み失敗: {e}")
        schedule_data = []
    task = asyncio.create_task(reload_venues_daily())
    yield
    task.cancel()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://dansyu-go.nukadokonokai.com",
        "http://localhost",
    ],
    allow_origin_regex=r"http://localhost(:\d+)?",
    allow_methods=["*"],
    allow_headers=["*"],
)


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[Message] = []
    lat: Optional[float] = None
    lng: Optional[float] = None


@app.post("/chat")
def chat(req: ChatRequest):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="message は空にできません")
    try:
        history = [{"role": m.role, "content": m.content} for m in req.history]
        reply = generate_reply(req.message, history, req.lat, req.lng)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Anthropic APIエラー: {e}")
    return {"reply": reply}


@app.post("/webhook/line")
async def webhook_line(request: Request):
    signature = request.headers.get("X-Line-Signature", "")
    body = await request.body()
    body_str = body.decode("utf-8")

    try:
        line_handler.handle(body_str, signature)
    except InvalidSignatureError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    data = json.loads(body_str)

    for event in data.get("events", []):
        if event.get("type") != "message":
            continue
        if event.get("message", {}).get("type") != "text":
            continue

        reply_token = event.get("replyToken", "")
        user_id = event.get("source", {}).get("userId", "")
        user_text = event["message"]["text"].strip()

        if not user_text:
            continue

        if needs_escalation(user_text):
            await line_reply(
                reply_token,
                "お問い合わせありがとうございます🦆\n"
                "担当者に内容をお伝えします。\n"
                "少々お待ちください。"
            )
            await line_push_admin(
                f"📩 LINE問い合わせが届きました\n"
                f"UserID: {user_id}\n"
                f"内容: {user_text}"
            )
            continue

        try:
            reply_text = generate_reply(user_text)
        except Exception as e:
            print(f"[LINE] generate_reply エラー: {e}")
            reply_text = "ごめんなさい、うまく答えられませんでした🦆\nもう一度試してみてください。"

        await line_reply(reply_token, reply_text)

    return {"status": "ok"}


@app.get("/health")
def health():
    return {"status": "ok", "venues_loaded": len(venues_data)}
