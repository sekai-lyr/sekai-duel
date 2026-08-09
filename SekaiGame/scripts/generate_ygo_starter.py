import json
from pathlib import Path

import requests


ROOT = Path(__file__).resolve().parents[1]
JSON_OUTPUT = ROOT / "src/main/resources/card-data/ygo-starter.json"
JS_OUTPUT = ROOT / "src/main/resources/static/js/ygo-starter.js"
IMAGE_DIR = ROOT / "src/main/resources/static/assets/cards/ygo-starter"

MONSTERS = [
    (89631139, "青眼白龙"), (46986414, "黑魔导"), (74677422, "真红眼黑龙"),
    (70781052, "恶魔召唤"), (91152256, "精灵剑士"), (15025844, "神圣妖精"),
    (5053103, "牛魔人"), (32452818, "海狸战士"), (13039848, "岩石巨兵"),
    (76812113, "鹰身女郎"), (97590747, "灯之魔精"), (23771716, "七彩鱼"),
    (85639257, "水魔道士"), (48305365, "斧王"), (69140098, "双生精灵"),
    (49881766, "恶魔士兵"), (14898066, "血腥魔兽人"), (11091375, "蓝宝石龙"),
    (16587243, "新虫"), (37265642, "剑角龙"), (7359741, "机械猎手"),
    (69247929, "基因狼人"), (43096270, "紫翠玉龙"), (58831685, "巨型红海蛇"),
    (49003308, "加加基哥"), (42071342, "暗黑海龙兵"), (30532390, "天空侦察者"),
    (66672569, "龙之僵尸"), (20277860, "铠武者僵尸"), (92667214, "小丑僵尸"),
    (41392891, "小恶魔"), (90357090, "银牙狼"), (87796900, "要塞守护翼龙"),
    (28279543, "诅咒之龙"), (6368038, "暗黑骑士盖亚"), (30113682, "审判者"),
]

SPELLS = [
    (53129443, "黑洞", "destroyTarget", 0, "破坏对方场上攻击力最高的1只怪兽。"),
    (83764718, "死者苏生", "recoverMonster", 0, "将自己墓地1只怪兽加入手牌。"),
    (66788016, "地裂", "destroyTarget", 0, "破坏对方场上攻击力最低的1只怪兽。"),
    (19159413, "除魔", "destroySpellTrap", 0, "破坏对方场上1张魔法或陷阱卡。"),
    (51482758, "陷阱拆除", "destroySpellTrap", 0, "破坏对方场上1张盖放卡。"),
    (55144522, "强欲之壶", "drawCards", 1, "抽1张卡。"),
    (79571449, "天使的施舍", "drawCards", 1, "抽1张卡。"),
    (72302403, "光之护封剑", "lockAttack", 1, "对方攻击力最高的怪兽本回合不能攻击。"),
    (4031928, "心变", "debuffEnemyAttack", 500, "对方攻击力最高的怪兽攻击力下降500。"),
    (19523799, "火刑", "directDamage", 500, "给予对方500点伤害。"),
    (84257639, "治愈之神迪安·凯特", "healPlayer", 800, "回复800LP。"),
    (25880422, "守备封禁", "debuffEnemyDefense", 500, "对方守备力最高的怪兽守备力下降500。"),
]

TRAPS = [
    (4206964, "落穴", "destroyAttacker", 0, "对方攻击宣言时：破坏攻击怪兽。"),
    (44095762, "神圣防护罩－反射镜力－", "destroyAttacker", 0, "对方攻击宣言时：破坏攻击怪兽。"),
    (12607053, "和睦的使者", "reduceDamage", 1000, "对方攻击宣言时：本次伤害减少1000。"),
    (17814387, "援军", "buffSelfAttack", 500, "受到攻击时：己方怪兽攻击力上升500。"),
    (44209392, "城壁", "buffSelfDefense", 500, "受到攻击时：己方怪兽守备力上升500。"),
    (83887306, "夹击", "destroyAttacker", 0, "对方攻击宣言时：破坏攻击怪兽。"),
    (80604091, "血之代偿", "healPlayer", 500, "受到攻击时：回复500LP。"),
    (24068492, "停战协定", "directDamage", 400, "对方攻击宣言时：给予对方400点伤害。"),
    (77622396, "反转陷阱", "reduceDamage", 800, "对方攻击宣言时：本次伤害减少800。"),
    (50045299, "龙族封印之壶", "cannotAttack", 1, "对方攻击宣言时：攻击怪兽本回合不能再次攻击。"),
    (96355986, "魔法筒枪", "reflectDamage", 500, "对方攻击宣言时：反射500点伤害。"),
    (77414722, "魔法干扰阵", "reduceDamage", 1200, "对方攻击宣言时：本次伤害减少1200。"),
]

RACE_MAP = {
    "Dragon": "dragon", "Spellcaster": "spellcaster", "Warrior": "warrior",
    "Beast-Warrior": "beast_warrior", "Beast": "beast", "Rock": "rock",
    "Winged Beast": "winged_beast", "Fish": "aqua", "Aqua": "aqua",
    "Fiend": "fiend", "Zombie": "zombie", "Machine": "machine",
    "Insect": "insect", "Dinosaur": "beast", "Sea Serpent": "sea_serpent",
}


def effect(trigger, effect_type, value, description, selector=None):
    item = {"trigger": trigger, "type": effect_type, "value": value, "description": description}
    if selector:
        item["target"] = {"owner": "opponent", "zone": "monster", "selector": selector, "count": 1}
    return item


def fetch_cards():
    ids = [card[0] for card in MONSTERS + SPELLS + TRAPS]
    response = requests.get(
        "https://db.ygoprodeck.com/api/v7/cardinfo.php",
        params={"id": ",".join(map(str, ids))},
        headers={"User-Agent": "SekaiGame/1.0"},
        timeout=30,
    )
    response.raise_for_status()
    return {card["id"]: card for card in response.json()["data"]}


def download_image(card_id, source_url):
    target = IMAGE_DIR / f"{card_id}.jpg"
    response = requests.get(source_url, headers={"User-Agent": "SekaiGame/1.0"}, timeout=30)
    response.raise_for_status()
    target.write_bytes(response.content)


def build():
    source = fetch_cards()
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    cards = []

    for card_id, name in MONSTERS:
        raw = source[card_id]
        download_image(card_id, raw["card_images"][0]["image_url_cropped"])
        cards.append({
            "id": f"ygo_n_{card_id}", "name": name, "series": "starter_ygo",
            "type": "monster", "attribute": raw.get("attribute", "DARK").lower(),
            "race": RACE_MAP.get(raw.get("race"), "warrior"), "level": raw.get("level", 4),
            "attack": raw.get("atk", 0), "defense": raw.get("def", 0), "rarity": "N",
            "cost": 0, "description": "",
            "image": f"./assets/cards/ygo-starter/{card_id}.jpg", "enabled": True,
            "effectsJson": "[]",
        })

    for card_id, name, effect_type, value, description in SPELLS:
        raw = source[card_id]
        download_image(card_id, raw["card_images"][0]["image_url_cropped"])
        selector = "lowestAttack" if card_id == 66788016 else "highestAttack"
        effects = [effect("manual", effect_type, value, description, selector if effect_type in {
            "destroyTarget", "debuffEnemyAttack", "debuffEnemyDefense", "lockAttack"
        } else None)]
        cards.append({
            "id": f"ygo_n_{card_id}", "name": name, "series": "starter_ygo",
            "type": "spell", "attribute": "light", "race": None, "level": 0,
            "attack": 0, "defense": 0, "rarity": "N", "cost": 0,
            "description": "", "image": f"./assets/cards/ygo-starter/{card_id}.jpg",
            "enabled": True, "effectsJson": json.dumps(effects, ensure_ascii=False),
        })

    for card_id, name, effect_type, value, description in TRAPS:
        raw = source[card_id]
        download_image(card_id, raw["card_images"][0]["image_url_cropped"])
        effects = [effect("onAttacked", effect_type, value, description)]
        cards.append({
            "id": f"ygo_n_{card_id}", "name": name, "series": "starter_ygo",
            "type": "trap", "attribute": "dark", "race": None, "level": 0,
            "attack": 0, "defense": 0, "rarity": "N", "cost": 0,
            "description": "", "image": f"./assets/cards/ygo-starter/{card_id}.jpg",
            "enabled": True, "effectsJson": json.dumps(effects, ensure_ascii=False),
        })

    JSON_OUTPUT.write_text(json.dumps(cards, ensure_ascii=False, indent=2), encoding="utf-8")
    browser_cards = []
    for card in cards:
        browser = dict(card)
        browser["effects"] = json.loads(browser["effectsJson"])
        browser_cards.append(browser)
    JS_OUTPUT.write_text(
        "export const YGO_STARTER_CARDS = " + json.dumps(browser_cards, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    print(f"generated={len(cards)}, images={len(list(IMAGE_DIR.glob('*.jpg')))}")


if __name__ == "__main__":
    build()
