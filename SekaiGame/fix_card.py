import json, base64

src = r"D:\Sekai_two\memory-11\SekaiGame\src\main\resources\cards-base64.txt"
target = r"D:\Sekai_two\memory-11\SekaiGame\target\classes\cards-base64.txt"

for path in [src, target]:
    with open(path, "r", encoding="utf-8") as f:
        content = f.read().strip()
    if content.startswith("+"):
        content = content[1:]
    data = json.loads(base64.b64decode(content).decode("utf-8"))
    for card in data:
        if card["id"] == "nc_sp_ur_001":
            old_img = card["image"]
            card["image"] = "pricture/\u9b54\u6cd5\u5361/UR/8\u5343\u5e74\u7684\u601d\u5ff5.jpg"
            print("nc_sp_ur_001: " + old_img + " -> " + card["image"])
    new_json = json.dumps(data, ensure_ascii=False)
    new_b64 = base64.b64encode(new_json.encode("utf-8")).decode("ascii")
    with open(path, "w", encoding="utf-8") as f:
        f.write(new_b64)
    print("Saved: " + path)
