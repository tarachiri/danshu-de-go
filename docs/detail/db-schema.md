# DBスキーマ詳細（danshu.db、tyo）

docs/architecture.md の詳細資料。エラー箇所の特定にはまず概要側を確認すること。

全11テーブル。例会・イベントとも「1次情報保管庫→名寄せ→本体」の3段構成。

## 例会系

### raw_meetings（1次情報保管庫）
id, collected_at, source_type, collector_script, pref, group_name,
meeting_name, facility_name, address_raw, schedule_raw, audience,
official_site, source_url, status（'raw'→'promoted'等）,
venue_id_candidate, meeting_id, needs_human_review, note,
collected_date, updated_at,
theme, day_of_week, week_of_month, start_time, end_time, parse_status
UNIQUE(pref, facility_name, schedule_raw)

### meeting_master（名寄せ中間テーブル、147件）
id, meeting_name, source_name, prefecture, city,
match_facility, match_address, match_summary, match_time,
verified, note, meeting_type, created_at, updated_at

### meetings（例会本体、2017件）
id, region, group_name, name, venue, address, phone,
contact_name, contact_phone, day_of_week, week_of_month,
start_time, end_time, family_meeting, verified, needs_verification,
official_url, status, venue_id（venuesを参照）,
prefecture, city, meeting_type, national_area,
placeholder_lat, placeholder_lng
UNIQUE(group_name, name, venue_id)

### venues（施設マスタ）
id, facility_name, address, phone, source_name, prefecture,
latitude, longitude, first_seen, last_seen, meeting_name, schedule,
contact_phone, contact_name, next_date, start_time, end_time,
recurrence, building_name, meeting_type（既定値:通常）, official_url,
is_online, requires_contact, is_hidden, needs_verification,
notes, needs_human_review
UNIQUE(facility_name, address, meeting_name)

緯度経度はNULL許容。venue昇格判定（promote_raw_meetings.py）は
施設名＋都道府県の文字列マッチのみ（完全一致→前方一致8文字以上）。
緯度経度は昇格判定に一切使用されない。

## イベント系（例会と並行する別系統）

raw_events（3426件）→ events（27件）
events: id, pref, group_name, title, event_date, end_date,
location_name, location_address, url, event_type, source_type,
source_url, is_hidden, needs_verification, created_at, updated_at

## 例外・出典

### schedule_exceptions（12369件、最大規模）
id, venue_id, original_date, exception_date,
exception_type（既定値:date_change）, note, source,
created_at, meeting_id（meetingsを参照）
例会の日程変更・休会情報。

### national_sources（1017件）
id, pref, group_name, meeting_name, facility_name, address, phone,
schedule_text, audience, theme, official_site, source_url,
venue_id（venuesを参照）, meeting_id（meetingsを参照）,
imported_at, geo_failed

### zendanren_organizations（535件）
全日本断酒連盟加盟団体マスタ。
id, block, org_name, is_umbrella, is_suspended, representative,
postal_code, address, address_note, phone, fax, source_year, note

### danshu_sites（28件）
断酒会公式サイト一覧。generate_news.pyから未接続（デッドデータ、要修正）。
last_checked記録は0/28件（生存確認が一度も実施されていない）。
rss_url保有13件のうち実際に収集されているのは大阪系8件のみ。

### meeting_types（5件）
例会種別マスタ。

### org_hierarchy（0件、未使用）
テーブルは存在するが実データなし。

## venue登録の共通化（2026-07-03完了）

新規venue登録が地域スクレイパーごと（11スクリプト）に分散していた問題を解消。
register_venue.py に共通化し、以下5スクリプトが移行済み：
shizuoka_build_venues.py, osaka_shi_scraper.py, hokusetsu_scraper.py,
osaka_rengo_scraper.py, sakaishi_scraper.py

新規venue登録時はGeocoding APIでのジオコーディングを必ず実行するが、
緯度経度を登録の必須条件にはしない。失敗時はNULLのまま
needs_verification=1で要確認扱いにして登録は通す設計。

## 未精査の項目

愛知県venue照合（aichi_match_venues.py）: マスタ会場71件、
raw_meetings distinct施設名176件に対し、マッチ59件・誤爆除外2件・
未マッチ115件（2026-07-03 dry-run確認）。未マッチは主に表記ゆれ
（全角半角混在、部屋名付与、施設名略称違い）。マスタ更新の要否は未着手。
