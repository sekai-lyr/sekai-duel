import json, base64, os

# get all actual files in pricture
actual = {}
for root, dirs, files in os.walk(r"D:\Sekai_two\memory-11\pricture"):
    for fname in files:
        full = os.path.join(root, fname)
        rel = os.path.relpath(full, r"D:\Sekai_two\memory-11").replace(os.sep, "/")
        actual[rel] = full

# get all cards
with open(r"D:\Sekai_two\memory-11\SekaiGame\src\main\resources\cards-base64.txt", "r", encoding="utf-8") as f:
    content = f.read().strip()
if content.startswith("+"):
    content = content[1:]
data = json.loads(base64.b64decode(content).decode("utf-8"))

# check: only keep cards whose image exists in pricture
cards_to_remove = []
for c in data:
    img = c.get("image", "")
    if not img or img not in actual:
        cards_to_remove.append(c)
        print("NO IMAGE: [" + c["id"] + "] " + c["name"] + " -> " + (img or "(empty)"))

print()
print("Total cards: " + str(len(data)))
print("Cards without valid image: " + str(len(cards_to_remove)))
print("Cards with valid image: " + str(len(data) - len(cards_to_remove)))
