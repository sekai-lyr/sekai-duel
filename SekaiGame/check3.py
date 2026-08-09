import json, base64

with open(r"D:\Sekai_two\memory-11\SekaiGame\src\main\resources\cards-base64.txt", "r", encoding="utf-8") as f:
    content = f.read().strip()
if content.startswith("+"):
    content = content[1:]
data = json.loads(base64.b64decode(content).decode("utf-8"))

names = ["街角的温柔日常", "草野闲奏", "涟声合奏", "星轨重逢·胜利之誓"]
for c in data:
    if c["name"] in names:
        print("[" + c["id"] + "] " + c["name"] + " -> " + c["image"])
