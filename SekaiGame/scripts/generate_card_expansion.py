import json
import pathlib
import shutil


WORKSPACE = pathlib.Path(__file__).resolve().parents[2]
PROJECT = pathlib.Path(__file__).resolve().parents[1]
STATIC = PROJECT / "src/main/resources/static"
RESOURCE_DATA = PROJECT / "src/main/resources/card-data"
PICTURE = WORKSPACE / "pricture"
CC0 = WORKSPACE / ".tmp-superpowers-sparse"

JOJO_NAMES = [
    "不灭钻石的意志", "黄金之风的觉悟", "乔斯达血脉", "幻影之血", "群星的传承",
    "乔乔福音·定助与透龙", "石之海的羁绊", "飙马野郎", "战斗潮流", "星尘远征",
    "空条承太郎·白金之星", "吉良吉影·杀手皇后", "迪亚哥·THE WORLD", "盖多·米斯达·性感手枪",
    "露西·钢铁蔷薇", "赫特·潘兹·奶油启动器", "迪亚哥·骇人恶兽", "法尼·瓦伦泰·爱之列车",
]

DEMON_NAMES = [
    "灶门炭治郎·火之神神乐", "伊黑小芭内·蛇之呼吸", "我妻善逸·霹雳一闪",
    "甘露寺蜜璃·恋之呼吸", "悲鸣屿行冥·岩之呼吸", "蝴蝶忍·蝶之舞",
    "富冈义勇·水之呼吸", "不死川实弥·旋风斩", "灶门祢豆子·爆血", "时透无一郎·霞之呼吸",
    "嘴平伊之助·兽之呼吸", "炼狱杏寿郎·炎之呼吸", "不死川实弥·风之呼吸", "宇髓天元·音之呼吸",
    "富冈义勇·水柱", "伊黑小芭内·蛇柱", "炼狱杏寿郎·炎柱", "时透无一郎·月下霞",
    "蝴蝶忍·紫藤毒", "甘露寺蜜璃·恋柱", "宇髓天元·谱面完成", "不死川实弥·稀血",
    "悲鸣屿行冥·南无阿弥陀佛", "猗窝座·破坏杀", "富冈义勇·水面斩", "继国缘一·日之呼吸",
    "甘露寺蜜璃·猫足恋风", "蝴蝶忍·蜈蚣之舞", "宇髓天元·双刀爆裂", "我妻善逸·火雷神",
    "时透无一郎·胧", "炼狱杏寿郎·奥义玖之型", "嘴平伊之助·空间感知", "悲鸣屿行冥·岩躯",
    "伊黑小芭内·月夜蛇行", "炼狱杏寿郎·炎心", "童磨·寒夜莲华", "猗窝座·罗针",
    "蝴蝶忍·蝶影毒刃", "不死川实弥·黑风烟岚", "嘴平伊之助·兽牙乱舞", "灶门炭治郎·水火轮转",
    "悲鸣屿行冥·石肤", "富冈义勇·生生流转", "炼狱杏寿郎·炼狱", "甘露寺蜜璃·摇曳恋情",
    "鬼舞辻无惨·赤月", "时透无一郎·水月霞", "宇髓天元·爆音斩", "黑死牟·月虹",
    "伊黑小芭内·蜿蜒蛇行", "我妻善逸·雷霆万钧",
]

STARTER_MONSTERS = [
    "泥丘史莱姆", "苔背蜗牛", "木桩卫兵", "灰羽蝙蝠", "短尾野猪",
    "矿洞小鼠", "蘑菇学徒", "溪谷青蛙", "碎石甲虫", "风帽盗贼",
    "见习剑士", "木盾侍从", "草原猎犬", "灯笼幽灵", "齿轮小兵",
    "河岸鳄鱼", "荒地秃鹫", "铜盔哥布林", "学徒法师", "巡林弓手",
    "铁锅炼金师", "长矛民兵", "山洞巨蛛", "沼泽蜥蜴", "石像守门人",
    "独眼蛮兵", "森林树精", "墓园骷髅", "赤角山羊", "雪原狼",
    "熔岩甲虫", "风车骑士", "蓝帽巫师", "铁皮傀儡", "深井水怪",
    "双斧兽人", "古堡石像鬼", "荒原巨魔", "迷雾狮鹫", "沉睡小龙",
]

STARTER_SPELLS = [
    "小瓶补给", "磨旧的地图", "微弱火花", "清水术", "顺风练习",
    "碎石咒", "月光照明", "临时磨刀", "简易护符", "战术笔记",
]

STARTER_TRAPS = [
    "松动的绳索", "浅坑陷阱", "生锈捕兽夹", "警铃绊线", "烟尘伏击",
    "滚木机关", "反光碎片", "湿滑地面", "虚张声势", "仓促撤退",
]

ATTRIBUTES = ["fire", "water", "wind", "earth", "light", "dark"]
RACES = ["warrior", "spellcaster", "beast", "fiend", "fairy", "machine"]


def effect(trigger, effect_type, value, text, target=None):
    result = {"trigger": trigger, "type": effect_type, "value": value, "description": text}
    if target:
        result["target"] = target
    return result


def frontend_module(export_name, cards):
    payload = json.dumps(cards, ensure_ascii=False, indent=2)
    return f"export const {export_name} = {payload};\n"


def database_cards(cards):
    result = []
    for card in cards:
        item = dict(card)
        item["effectsJson"] = json.dumps(item.pop("effects", []), ensure_ascii=False)
        item.pop("tags", None)
        item.pop("aiHints", None)
        result.append(item)
    return result


def make_picture_cards():
    inventory = json.loads((WORKSPACE / "picture-inventory.json").read_text(encoding="utf-8"))
    missing = [item for item in inventory if not item["exactAssetMatches"]]
    names = JOJO_NAMES + DEMON_NAMES
    if len(missing) != 70 or len(names) != 70:
        raise RuntimeError("缺失图片或名称数量异常")

    target_dir = STATIC / "assets/cards/picture-extension"
    target_dir.mkdir(parents=True, exist_ok=True)
    cards = []
    for index, (item, name) in enumerate(zip(missing, names), 1):
        extension = pathlib.Path(item["source"]).suffix.lower()
        filename = f"picture_{index:03d}{extension}"
        shutil.copy2(PICTURE / item["source"], target_dir / filename)
        rarity = item["rarity"]
        card_type = item["type"]
        level = item.get("level") or 0
        attribute = ATTRIBUTES[(index - 1) % len(ATTRIBUTES)]
        if any(word in name for word in ("炼狱", "火之神", "水火轮转", "爆血", "继国缘一")):
            attribute = "fire"
        elif any(word in name for word in ("富冈", "水之呼吸", "水面斩", "生生流转")):
            attribute = "water"
        elif any(word in name for word in ("善逸", "悲鸣屿")):
            attribute = "light" if "善逸" in name else "earth"
        elif any(word in name for word in ("无惨", "黑死牟", "猗窝座", "童磨")):
            attribute = "dark"
        elif any(word in name for word in ("蝴蝶忍", "不死川", "时透")):
            attribute = "wind"
        power = {"SR": 1, "SSR": 2, "UR": 3}.get(rarity, 1)
        effects = []
        if card_type == "spell":
            modes = [
                ("drawCards", 1, "从卡组抽1张卡。"),
                ("healPlayer", 700 + index * 20, f"回复{700 + index * 20}LP。"),
                ("debuffEnemyAttack", 300 + index * 10, f"选择对方1只怪兽，其攻击力下降{300 + index * 10}。"),
                ("returnToHand", 1, "选择场上1只表侧怪兽返回持有者手牌。"),
                ("buffAllAlliesAttack", 250 + index * 10, f"己方全部表侧怪兽攻击力上升{250 + index * 10}。"),
            ]
            effect_type, value, text = modes[(index - 1) % len(modes)]
            effects.append(effect("manual", effect_type, value, f"【{name}】{text}"))
            if effect_type in {"drawCards", "returnToHand"}:
                effects.append(effect("manual", "healPlayer", 100 + index * 10, f"随后回复{100 + index * 10}LP。"))
            if power >= 2:
                effects.append(effect("manual", "healPlayer", 300 + index * 10, f"之后再回复{300 + index * 10}LP。"))
        else:
            base_attack = 900 + level * 190 + power * 90 + (index % 5) * 40
            base_defense = 850 + level * 180 + power * 100 + ((index + 2) % 5) * 35
            effect_modes = [
                ("buffSelfAttack", 180 + index * 5, f"召唤成功时，自身攻击力上升{180 + index * 5}。"),
                ("buffSelfDefense", 190 + index * 5, f"召唤成功时，自身守备力上升{190 + index * 5}。"),
                ("healPlayer", 250 + index * 10, f"召唤成功时，回复{250 + index * 10}LP。"),
                ("debuffEnemyAttack", 160 + index * 5, f"召唤成功时，对方攻击力最高的怪兽下降{160 + index * 5}。"),
                ("targetProtect", 0, "召唤成功的回合，这张卡不成为对方效果的对象。"),
                ("drawCards", 1, "召唤成功时，抽1张卡，然后本回合不能再次抽卡。"),
            ]
            if any(word in name for word in ("炼狱", "火之神", "善逸", "猗窝座")):
                effect_type, value = "buffSelfAttack", 180 + index * 5
                text = f"召唤成功时，自身攻击力上升{value}。"
            elif any(word in name for word in ("富冈", "悲鸣屿", "伊黑")):
                effect_type, value = "buffSelfDefense", 190 + index * 5
                text = f"召唤成功时，自身守备力上升{value}。"
            elif any(word in name for word in ("无惨", "黑死牟", "妓夫太郎", "蝴蝶忍")):
                effect_type, value = "debuffEnemyAttack", 160 + index * 5
                text = f"召唤成功时，对方攻击力最高的怪兽下降{value}。"
            elif "甘露寺" in name:
                effect_type, value = "healPlayer", 250 + index * 10
                text = f"召唤成功时，回复{value}LP。"
            else:
                effect_type, value, text = effect_modes[(index - 1) % len(effect_modes)]
            effects.append(effect("onSummon", effect_type, index if effect_type == "targetProtect" else value, f"【{name}】{text}"))
            if power >= 2:
                effects.append(effect("onDestroyed", "healPlayer", 300 + index * 8, f"被破坏时，回复{300 + index * 8}LP。"))
        description = " ".join(entry["description"] for entry in effects)
        card = {
            "id": f"picture_ex_{index:03d}", "name": name, "series": "picture",
            "type": card_type, "attribute": attribute, "race": RACES[(index - 1) % len(RACES)],
            "level": level, "attack": base_attack if card_type == "monster" else 0,
            "defense": base_defense if card_type == "monster" else 0, "rarity": rarity,
            "cost": power + max(0, level - 4), "description": description,
            "effects": effects, "image": f"./assets/cards/picture-extension/{filename}",
            "tags": ["picture", name.split("·")[0]], "aiHints": {"role": "balanced", "priority": 45 + power * 12},
            "enabled": True,
        }
        cards.append(card)
    return cards


def eligible_assets(folder):
    files = []
    for path in folder.rglob("*.png"):
        lowered = path.name.lower()
        if lowered.startswith("0-") or lowered in {"all.png", "elements.png", "food.png", "potion.png"}:
            continue
        files.append(path)
    return sorted(files)


def make_starter_cards():
    monster_sources = eligible_assets(CC0 / "medieval-fantasy/characters")
    monster_sources += eligible_assets(CC0 / "medieval-fantasy/animals")
    monster_sources += eligible_assets(CC0 / "rpg-battle-system/monster")
    monster_sources += eligible_assets(CC0 / "medieval-fantasy/monsters")
    monster_sources += eligible_assets(CC0 / "rpg-battle-system/characters")
    spell_sources = eligible_assets(CC0 / "medieval-fantasy/fx") + eligible_assets(CC0 / "rpg-battle-system/fx")
    trap_sources = eligible_assets(CC0 / "medieval-fantasy/items") + eligible_assets(CC0 / "rpg-battle-system/item")
    if len(monster_sources) < 40 or len(spell_sources) < 10 or len(trap_sources) < 10:
        raise RuntimeError("CC0素材数量不足")

    target_dir = STATIC / "assets/cards/starter-n"
    target_dir.mkdir(parents=True, exist_ok=True)
    cards = []
    groups = [
        ("monster", STARTER_MONSTERS, monster_sources[:40]),
        ("spell", STARTER_SPELLS, spell_sources[:10]),
        ("trap", STARTER_TRAPS, trap_sources[:10]),
    ]
    card_index = 0
    for card_type, names, sources in groups:
        for local_index, (name, source) in enumerate(zip(names, sources), 1):
            card_index += 1
            filename = f"starter_n_{card_index:03d}.png"
            shutil.copy2(source, target_dir / filename)
            attribute = ATTRIBUTES[(card_index - 1) % len(ATTRIBUTES)]
            if card_type == "monster":
                level = (local_index - 1) // 4 + 1
                attack = 350 + level * 170 + (local_index % 4) * 70
                defense = 450 + level * 165 + ((local_index + 1) % 4) * 65
                mode = local_index % 4
                if mode == 0:
                    effects = [effect("onSummon", "buffSelfDefense", 100 + level * 20, f"召唤成功时，自身守备力上升{100 + level * 20}。")]
                elif mode == 1:
                    effects = [effect("onDestroyed", "healPlayer", 120 + level * 30, f"被破坏时，回复{120 + level * 30}LP。")]
                elif mode == 2:
                    effects = [effect("onSummon", "buffSelfAttack", 90 + level * 20, f"召唤成功时，自身攻击力上升{90 + level * 20}。")]
                else:
                    effects = [effect("onSummon", "debuffEnemyAttack", 80 + level * 20, f"召唤成功时，对方攻击力最高的怪兽下降{80 + level * 20}。")]
            elif card_type == "spell":
                level = attack = defense = 0
                modes = [
                    ("drawCards", 1, "抽1张卡。"),
                    ("healPlayer", 400, "回复400LP。"),
                    ("buffAllAlliesAttack", 200, "己方全部表侧怪兽攻击力上升200。"),
                    ("healPlayer", 300, "回复300LP。"),
                    ("debuffAllEnemyAttack", 150, "对方全部表侧怪兽攻击力下降150。"),
                ]
                effect_type, value, text = modes[(local_index - 1) % len(modes)]
                effects = [effect("manual", effect_type, value + (local_index // 6) * 50, text)]
            else:
                level = attack = defense = 0
                modes = [
                    ("reduceDamage", 500, "受到战斗伤害时发动：该伤害减少500。"),
                    ("cannotAttack", 0, "对方攻击宣言时发动：那次攻击无效。"),
                    ("reflectDamage", 250, "受到战斗伤害时发动：对方也受到250点伤害。"),
                    ("buffSelfDefense", 350, "己方怪兽成为攻击对象时发动：其守备力上升350。"),
                    ("returnToHand", 1, "对方怪兽攻击时发动：攻击怪兽返回持有者手牌。"),
                ]
                effect_type, value, text = modes[(local_index - 1) % len(modes)]
                effects = [effect("onAttacked", effect_type, value + (local_index // 6) * 50, text)]
            cards.append({
                "id": f"starter_n_{card_index:03d}", "name": name, "series": "starter_n",
                "type": card_type, "attribute": attribute, "race": RACES[(card_index - 1) % len(RACES)],
                "level": level, "attack": attack, "defense": defense, "rarity": "N", "cost": max(1, level // 2),
                "description": f"【{name}】" + " ".join(entry["description"] for entry in effects), "effects": effects,
                "image": f"./assets/cards/starter-n/{filename}", "tags": ["starter", "owned"],
                "aiHints": {"role": "balanced", "priority": 20 + level}, "enabled": True,
            })
    return cards


def write_catalog(filename, export_name, cards):
    RESOURCE_DATA.mkdir(parents=True, exist_ok=True)
    (RESOURCE_DATA / filename).write_text(
        json.dumps(database_cards(cards), ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (STATIC / "js" / filename.replace(".json", ".js")).write_text(
        frontend_module(export_name, cards), encoding="utf-8"
    )


def main():
    picture_cards = make_picture_cards()
    write_catalog("picture-extension.json", "PICTURE_EXTENSION_CARDS", picture_cards)
    print(f"generated picture={len(picture_cards)}")


if __name__ == "__main__":
    main()
