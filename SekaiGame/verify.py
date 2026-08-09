import json, base64, os

src = r"D:\Sekai_two\memory-11\SekaiGame\src\main\resources\cards-base64.txt"
with open(src, "r", encoding="utf-8") as f:
    content = f.read().strip()
if content.startswith("+"):
    content = content[1:]
data = json.loads(base64.b64decode(content).decode("utf-8"))

actual = set()
for root, dirs, files in os.walk(r"D:\Sekai_two\memory-11\pricture"):
    for fname in files:
        full = os.path.join(root, fname)
        rel = os.path.relpath(full, r"D:\Sekai_two\memory-11").replace(os.sep, "/")
        actual.add(rel)

print("=== After fix: mismatched images ===")
mismatches = 0
for c in data:
    img = c.get("image", "")
    if img and img not in actual:
        mismatches += 1
        print("  [" + c["id"] + "] " + c["name"] + " -> " + img)

if mismatches == 0:
    print("  All card images match existing files!")

print()
print("=== Unused image files ===")
used = set(c.get("image","") for c in data)
for f in sorted(actual):
    if f not in used:
        print("  " + f)
