import json
import time
import urllib.request

with open('sample1.html', 'r', encoding='utf-8') as f:
    sample1 = f.read()

with open('sample2.html', 'r', encoding='utf-8') as f:
    sample2 = f.read()

today_topic = """
東北（宮城・岩手・福島）の断酒会例会データを本番反映する作業中に、
8件だけ施設がどこか特定できずに止まっていた。
1件は個人宅なので保留。残り7件を調べたところ、2つの原因があった。

1. 施設そのものが名前を変えていた（例：涌津公民館→涌津市民センター、
   石巻医師会館→石巻市保健相談センター）。市町村合併や施設再編でこういうことが起きる。
2. 住所が空欄のまま届いていて、名前だけでは自動マッチングに確信が持てなかった
   （郡山市中央公民館堤下分室、二本松市安達公民館、矢吹町複合施設KOKOTTO）。

自治体の公式サイトを1件ずつ調べて、6件は正式名称と住所を特定できた。
残り1件（支倉集会所、仙台市青葉区）は情報が見つからず、保留のまま。
断酒会の例会は、初めて行く人にとって「本当にここで合っているか」が
大事な不安になるので、分からないものは無理に埋めず、分からないままにしておいた。
"""

prompt = """あなたは「かもちゃん」というAIで、「断酒でGO!!」という
全国の断酒会例会マップサービスの開発ノートを書いています。
これは実在する断酒会（アルコール依存症からの回復を支援する自助グループ）を
扱う真面目なプロジェクトなので、ふざけた内容やデリケートな配慮を欠く表現は避けてください。

以下は過去にかもちゃんが書いた開発ノートの例です。

---お手本1---
""" + sample1 + """

---お手本2---
""" + sample2 + """

---

このお手本を参考に、以下の今日の出来事をもとに、
かもちゃんの一人称で、開発ノートの新しい記事をHTML形式で書いてください。
タイトル、日付（2026-07-17）、本文を含む完結したHTMLにしてください。
文章のトーンや構成（数字を見せる、教訓を書く、最後に短い一言で締める）は
お手本を参考にしつつ、内容は以下の今日の出来事に基づいてください。

---今日の出来事---
""" + today_topic

data = json.dumps({
    "model": "gemma3:12b",
    "prompt": prompt,
    "stream": False
}).encode('utf-8')

req = urllib.request.Request(
    "http://localhost:11434/api/generate",
    data=data,
    headers={"Content-Type": "application/json"}
)

print("Sending request to gemma3:12b (timeout=1200s)...")
start = time.time()
with urllib.request.urlopen(req, timeout=1200) as response:
    result = json.loads(response.read().decode('utf-8'))
elapsed = time.time() - start

with open('generated_output.html', 'w', encoding='utf-8') as f:
    f.write(result['response'])

print("Done in", round(elapsed, 1), "seconds")
print("Output saved to generated_output.html")
print("Response length:", len(result['response']), "chars")
