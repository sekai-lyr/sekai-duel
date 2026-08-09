import hashlib
import json
import pathlib
import shutil


WORKSPACE = pathlib.Path(__file__).resolve().parents[2]
PROJECT = pathlib.Path(__file__).resolve().parents[1]
PICTURE = WORKSPACE / "pricture"
STATIC = PROJECT / "src/main/resources/static"
DATA = PROJECT / "src/main/resources/card-data"
CC0 = WORKSPACE / ".tmp-superpowers-sparse"

ATTRIBUTES = ["light", "wind", "water", "dark", "fire", "earth"]
RACES = ["spellcaster", "warrior", "fairy", "fiend", "machine", "beast"]

MISSING_NAMES = [
    "青春教室的约定", "古见同学的勇气", "从零开始的羁绊", "雪乃与八幡的并肩",
    "邪王真眼的宣言", "喜多川海梦的笑容", "山田杏奈的放学后", "加藤惠的温柔时光",
    "友利奈绪的悸动", "高木同学的恶作剧", "世界线的粉色奇迹", "从零开始的异世界祝福",
    "黑化阿尔托莉雅·暗夜血刃", "黑化阿尔托莉雅·绯狱复仇", "阿尔托莉雅·黄昏断罪", "初音未来·苍穹音浪",
    "花里实乃理·橙梦舞台", "草薙宁宁·海月幻梦", "日野森雫·青瓷流云", "朝比奈真冬·静默旋律",
    "宵崎奏·雪原白夜", "东云绘名·迷途画境", "日野森雫·蓝蔷薇", "晓山瑞希·粉黛之心",
    "津岛善子·堕天使夜羽", "椎名真昼·水墨午后", "喜多郁代·金叶跃动", "后藤一里·绯线独奏",
    "喜多郁代·碧空旋律", "喜多川海梦·海风浅笑", "有马加奈·坠空追风", "椎名真昼·素描沉思",
    "高松灯·深海蓝影", "奥泽美咲·暖窗时光", "晓山瑞希·缤纷节拍", "初音未来·深海回响",
    "暗影·原子裁决", "暗影·终焉权能", "菜月昴·死亡回归", "白眼·回天",
    "我爱罗·砂瀑守护", "佩恩·神罗天征", "二代火影·水遁", "宇智波佐助·须佐能乎",
    "旗木卡卡西·雷切", "千手纲手·怪力", "朝比奈真冬·雨夜狙击", "鸣人·九喇嘛连结",
    "矿洞小鼠",
]
MISSING_STEMS = [
    "17661F596E71EC7999B0A9C19A4EEED1", "1DF907FA3CCAEC0DC465BEC54F83AFFB",
    "38A2D45D310175F3A01C176C10A8799E", "3B6E31C54720DDBDFDABD81B600382C4",
    "42B7D328252554E5597FE064E0B7E8CF", "50D0608632AA52CA234A2C612538B18F",
    "62F4F15EDBDC0272778783E9EAECEFC6", "A728E03996B48EA07A52DC084970057B",
    "C142F49432B5FDE8F1E17E99947CE37C", "CF9EDB9AFDB2097938CC88A9B58E7376",
    "519BA55B96DA875FF7BADB3F5F7627DD", "F5D84FE7F651CA7C088A3D24788D9D15",
    "2AB5BD5F617F9BD37C92206333769858", "8E1E12B610B38540C6B0C28B177105D5",
    "A27BD3E7810ACA980216BF69EF511A9F", "F788609DEC53A803DBEC4ADA6A98B009",
    "25A50DC32DFD158461FD51D6814C9ECC", "A0B8A832F1523807FEF302F0B3B1F0F3",
    "E12D437E35D7B8FEFC6169DEBA71D041", "55CAB429B7342B2302DC78B3E08D3836",
    "5808AA9BF16C6F9A0CEDE4B3D2FC626C", "9140D98F0405663D394D1254135822C3",
    "B94DADD4754542F559D86AC20FB01CB1", "E7BAB8CFAFCC57B230AC7B0072FD288D",
    "1992848078FE31F6F99669A4480F047F", "2008B3A64C0B52CFCCFE6F4C7F47D284",
    "216B4AF655C4AEBC3CA96D630CC96606", "4AF1B23900A979E5F568B5EB5DF1A8F0",
    "767E1DCCBAC1FB529965FCA3537A42C4", "7950A8A43DD3C216A452D8B80856E42F",
    "944A2A3F44818B2F1E216AF95B199AB5", "9FFF0CDD66770889F77E4B4E49607C94",
    "DE5848BBCCD017B9A16FF0CC4066FA1B", "DF3D95E5ABE80E8885F74F4D07349450",
    "FAC9ED9222ABC8B9EF20EFCE1243F674", "1703FE40A33459D7C4F8DC8708B80D4E",
    "0FC30CD0C890F2D922DF616565103A73", "178881733E049ACC5E39C4B5EE3676E3",
    "44A165FDA7C82AB1E3D5750BAD877F73", "91E6DF7B244632DE1A43A50E93FB3DB9",
    "AF801B52040A028D48D7D0EA83B1B3E1", "BF93C144E9BE410AF72DF43ED96C309A",
    "C5E86C0D48C7811B7C53858FE645E3C7", "E6D09432F9A31A2CC08C7948BB6CF781",
    "ED789AD971A406368227F8E48EBDCE68", "FE98E99A08C74C47E1FCD6082B7F312D",
    "20754F977EBA83EFC7DDEC1B2AE732A2", "4066092CAD0EB56F34EA4A9E649FD3EA",
    "矿洞小鼠",
]

STARTER_MONSTERS = [
    "泥丘史莱姆", "苔背蜗牛", "木桩卫兵", "灰翼蝙蝠", "短尾野猪",
    "矿洞小鼠", "蘑菇学徒", "溪谷青蛙", "碎石甲虫", "风帽盗贼",
    "见习剑士", "木盾侍从", "草原猎犬", "灯笼幽灵", "齿轮小兵",
    "河岸鳄鱼", "荒地秃鹫", "铜盔哥布林", "学徒法师", "巡林弓手",
    "铁锤炼金师", "长矛民兵", "山洞巨蟒", "沼泽蜘蛛", "石像守门人",
    "独眼蛮兵", "森林树精", "墓园骷髅", "赤角山羊", "雪原狼",
    "熔岩甲虫", "风车骑士", "蓝帽巫师", "铁皮傀儡", "深井水怪",
    "双斧兽人",
]
STARTER_SPELLS = [
    "小瓶补给", "磨旧的地图", "微弱火花", "清水术", "顺风练习", "碎石咒",
    "月光照明", "临时磨刀", "简易护符", "战术笔记", "野营炊火", "回程路标",
]
STARTER_TRAPS = [
    "松动的绳索", "浅坑陷阱", "生锈捕兽夹", "警铃绊线", "烟尘伏击", "滚木机关",
    "反光碎片", "湿滑地面", "虚张声势", "仓促撤退", "落石预警", "空箱诱饵",
]


def effect(trigger, effect_type, value, description, target=None):
    result = {
        "trigger": trigger,
        "type": effect_type,
        "value": value,
        "description": description,
    }
    if target:
        result["target"] = target
    return result


def file_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source_metadata(path):
    parts = path.relative_to(PICTURE).parts
    card_type = "monster" if parts[0] == "怪兽卡" else "spell" if parts[0] == "魔法卡" else "trap"
    rarity = next((part for part in parts if part in {"N", "R", "SR", "SSR", "UR"}), "N")
    level_part = next((part for part in parts if part.endswith("星")), "0星")
    level = int(level_part[:-1]) if card_type == "monster" else 0
    return card_type, rarity, level


def missing_picture_sources():
    asset_hashes = set()
    for path in (STATIC / "assets/cards").rglob("*"):
        if not path.is_file():
            continue
        if path.parent.name == "picture-extension" and path.stem.startswith("picture_"):
            try:
                if int(path.stem.rsplit("_", 1)[-1]) >= 71:
                    continue
            except ValueError:
                pass
        asset_hashes.add(file_hash(path))
    sources = [
        path for path in PICTURE.rglob("*")
        if path.is_file()
        and path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
        and file_hash(path) not in asset_hashes
    ]
    sources.sort(key=lambda path: str(path.relative_to(PICTURE)))
    if len(sources) != len(MISSING_NAMES):
        raise RuntimeError(f"预期49张未收录图片，实际为{len(sources)}张")
    return sources


def make_picture_effects(index, name, card_type, rarity):
    tier = {"N": 0, "R": 1, "SR": 2, "SSR": 3, "UR": 4}[rarity]
    if card_type == "spell":
        patterns = [
            [("drawCards", 1 + tier // 4), ("healPlayer", 320 + index * 25)],
            [("healPlayer", 650 + tier * 220 + index * 15), ("buffAllAlliesAttack", 180 + index * 12)],
            [("debuffAllEnemyAttack", 260 + index * 15), ("drawCards", 1)],
            [("returnToHand", 0), ("healPlayer", 280 + index * 20)],
            [("directDamage", 420 + tier * 160 + index * 12), ("debuffAllEnemyAttack", 180 + index * 11)],
            [("buffAllAlliesAttack", 310 + index * 14), ("drawCards", 1)],
        ]
        descriptions = {
            "drawCards": lambda value: f"抽{value}张卡。",
            "healPlayer": lambda value: f"回复{value}LP。",
            "buffAllAlliesAttack": lambda value: f"己方全部表侧怪兽攻击力上升{value}。",
            "debuffAllEnemyAttack": lambda value: f"对方全部表侧怪兽攻击力下降{value}。",
            "returnToHand": lambda value: "选择对方1只怪兽返回持有者手牌。",
            "directDamage": lambda value: f"给予对方{value}点伤害。",
        }
        return [
            effect("manual", kind, value, descriptions[kind](value))
            for kind, value in patterns[(index - 1) % len(patterns)]
        ]

    summon_patterns = [
        ("buffSelfAttack", 180 + tier * 130 + index * 7),
        ("buffSelfDefense", 210 + tier * 130 + index * 7),
        ("healPlayer", 260 + tier * 180 + index * 11),
        ("debuffEnemyAttack", 170 + tier * 120 + index * 8),
        ("drawCards", 1),
        ("targetProtect", 1),
    ]
    kind, value = summon_patterns[(index - 1) % len(summon_patterns)]
    descriptions = {
        "buffSelfAttack": f"召唤成功时：自身攻击力上升{value}。",
        "buffSelfDefense": f"召唤成功时：自身守备力上升{value}。",
        "healPlayer": f"召唤成功时：回复{value}LP。",
        "debuffEnemyAttack": f"召唤成功时：对方攻击力最高的怪兽攻击力下降{value}。",
        "drawCards": "召唤成功时：抽1张卡。",
        "targetProtect": "召唤成功的回合：此卡不会成为对方效果的对象。",
    }
    effects = [effect("onSummon", kind, value, descriptions[kind])]
    if tier >= 3:
        bonus_kind = "healPlayer" if index % 2 else "drawCards"
        bonus_value = 360 + index * 9 if bonus_kind == "healPlayer" else 1
        bonus_text = f"被破坏时：回复{bonus_value}LP。" if bonus_kind == "healPlayer" else "被破坏时：抽1张卡。"
        effects.append(effect("onDestroyed", bonus_kind, bonus_value, bonus_text))
    if tier >= 4:
        effects.append(effect("onSummon", "buffSelfAttack", 240 + index * 6, f"若以解放召唤此卡，再上升{240 + index * 6}攻击力。"))
    return effects


def make_picture_additions():
    target = STATIC / "assets/cards/picture-extension"
    target.mkdir(parents=True, exist_ok=True)
    cards = []
    name_by_stem = dict(zip(MISSING_STEMS, MISSING_NAMES))
    for offset, source in enumerate(missing_picture_sources(), 71):
        name = name_by_stem[source.stem]
        card_type, rarity, level = source_metadata(source)
        filename = f"picture_{offset:03d}{source.suffix.lower()}"
        shutil.copy2(source, target / filename)
        tier = {"N": 0, "R": 1, "SR": 2, "SSR": 3, "UR": 4}[rarity]
        effects = make_picture_effects(offset, name, card_type, rarity)
        for item in effects:
            item["description"] = f"【{name}】{item['description']}"
        attack = 0 if card_type != "monster" else 420 + level * 205 + tier * 125 + (offset % 5) * 45
        defense = 0 if card_type != "monster" else 500 + level * 190 + tier * 120 + ((offset + 2) % 5) * 40
        cards.append({
            "id": f"picture_ex_{offset:03d}",
            "name": name,
            "series": "picture",
            "member": None,
            "race": RACES[(offset - 1) % len(RACES)],
            "type": card_type,
            "attribute": ATTRIBUTES[(offset - 1) % len(ATTRIBUTES)],
            "level": level,
            "attack": attack,
            "defense": defense,
            "rarity": rarity,
            "cost": max(1, tier + level // 3),
            "description": " ".join(item["description"] for item in effects),
            "effects": effects,
            "image": f"./assets/cards/picture-extension/{filename}",
            "tags": ["picture", "advanced", rarity.lower()],
            "aiHints": {"role": "balanced", "priority": 32 + tier * 12 + level},
            "enabled": True,
        })
    return cards


def eligible_assets(folder):
    result = []
    for path in folder.rglob("*.png"):
        lowered = path.name.lower()
        if lowered.startswith("0-") or lowered in {"all.png", "elements.png", "food.png", "potion.png"}:
            continue
        result.append(path)
    return sorted(result)


def make_starter_effect(card_type, index, level=0):
    if card_type == "monster":
        patterns = [
            ("buffSelfAttack", 70 + level * 19 + index),
            ("buffSelfDefense", 80 + level * 18 + index * 2),
            ("healPlayer", 100 + level * 27 + index * 3),
            ("debuffEnemyAttack", 60 + level * 17 + index * 2),
            ("drawCards", 1),
            ("targetProtect", 1),
        ]
        kind, value = patterns[(index - 1) % len(patterns)]
        text = {
            "buffSelfAttack": f"召唤成功时：自身攻击力上升{value}。",
            "buffSelfDefense": f"召唤成功时：自身守备力上升{value}。",
            "healPlayer": f"召唤成功时：回复{value}LP。",
            "debuffEnemyAttack": f"召唤成功时：对方攻击力最高的怪兽攻击力下降{value}。",
            "drawCards": "召唤成功时：抽1张卡；本回合不能再抽卡。",
            "targetProtect": "召唤成功的回合：此卡不会成为对方效果的对象。",
        }[kind]
        return [effect("onSummon", kind, value, text)]
    if card_type == "spell":
        patterns = [
            ("drawCards", 1), ("healPlayer", 330 + index * 17),
            ("buffAllAlliesAttack", 120 + index * 11), ("debuffAllEnemyAttack", 110 + index * 9),
            ("directDamage", 240 + index * 13), ("returnToHand", 0),
        ]
        kind, value = patterns[(index - 1) % len(patterns)]
        text = {
            "drawCards": "抽1张卡。",
            "healPlayer": f"回复{value}LP。",
            "buffAllAlliesAttack": f"己方全部怪兽攻击力上升{value}。",
            "debuffAllEnemyAttack": f"对方全部怪兽攻击力下降{value}。",
            "directDamage": f"给予对方{value}点伤害。",
            "returnToHand": "选择对方攻击力最低的1只怪兽返回手牌。",
        }[kind]
        return [effect("manual", kind, value, text)]
    patterns = [
        ("reduceDamage", 360 + index * 21),
        ("cannotAttack", 0),
        ("reflectDamage", 0),
        ("buffSelfDefense", 180 + index * 13),
        ("returnToHand", 0),
        ("destroyAttacker", 0),
    ]
    kind, value = patterns[(index - 1) % len(patterns)]
    text = {
        "reduceDamage": f"对方攻击宣言时发动：本次战斗伤害减少{value}。",
        "cannotAttack": "对方攻击宣言时发动：那次攻击无效。",
        "reflectDamage": "对方攻击宣言时发动：那次攻击无效，并反射其攻击力一半的伤害。",
        "buffSelfDefense": f"己方怪兽成为攻击对象时发动：其守备力上升{value}。",
        "returnToHand": "对方攻击宣言时发动：攻击怪兽返回持有者手牌。",
        "destroyAttacker": "对方攻击宣言时发动：破坏攻击怪兽；自己失去500LP。",
    }[kind]
    return [effect("onAttacked", kind, value, text)]


def make_starter_cards():
    monster_sources = (
        eligible_assets(CC0 / "medieval-fantasy/characters")
        + eligible_assets(CC0 / "medieval-fantasy/animals")
        + eligible_assets(CC0 / "rpg-battle-system/monster")
        + eligible_assets(CC0 / "medieval-fantasy/monsters")
    )
    spell_sources = eligible_assets(CC0 / "medieval-fantasy/fx") + eligible_assets(CC0 / "rpg-battle-system/fx")
    trap_sources = eligible_assets(CC0 / "medieval-fantasy/items") + eligible_assets(CC0 / "rpg-battle-system/item")
    if len(monster_sources) < 36 or len(spell_sources) < 12 or len(trap_sources) < 12:
        raise RuntimeError("CC0基础卡素材不足")

    target = STATIC / "assets/cards/starter-n"
    target.mkdir(parents=True, exist_ok=True)
    cards = []
    groups = [
        ("monster", STARTER_MONSTERS, monster_sources[:36]),
        ("spell", STARTER_SPELLS, spell_sources[:12]),
        ("trap", STARTER_TRAPS, trap_sources[:12]),
    ]
    serial = 0
    for card_type, names, sources in groups:
        for local_index, (name, source) in enumerate(zip(names, sources), 1):
            serial += 1
            filename = f"starter_n_{serial:03d}.png"
            shutil.copy2(source, target / filename)
            level = (local_index - 1) % 10 + 1 if card_type == "monster" else 0
            effects = make_starter_effect(card_type, local_index, level)
            for item in effects:
                item["description"] = f"【{name}】{item['description']}"
            cards.append({
                "id": f"starter_n_{serial:03d}",
                "name": name,
                "series": "starter_ygo",
                "member": None,
                "race": RACES[(serial - 1) % len(RACES)],
                "type": card_type,
                "attribute": ATTRIBUTES[(serial - 1) % len(ATTRIBUTES)],
                "level": level,
                "attack": 300 + level * 155 + (local_index % 4) * 55 if card_type == "monster" else 0,
                "defense": 390 + level * 150 + ((local_index + 1) % 4) * 50 if card_type == "monster" else 0,
                "rarity": "N",
                "cost": max(1, level // 3),
                "description": " ".join(item["description"] for item in effects),
                "effects": effects,
                "image": f"./assets/cards/starter-n/{filename}",
                "tags": ["starter", "basic"],
                "aiHints": {"role": "balanced", "priority": 15 + level},
                "enabled": True,
            })
    return cards


def database_cards(cards):
    result = []
    for card in cards:
        item = dict(card)
        effects = item.pop("effects", None)
        if effects is not None:
            item["effectsJson"] = json.dumps(effects, ensure_ascii=False)
        item.pop("tags", None)
        item.pop("aiHints", None)
        result.append(item)
    return result


def write_outputs():
    picture_json = DATA / "picture-extension.json"
    existing = json.loads(picture_json.read_text(encoding="utf-8"))
    existing = [card for card in existing if int(card["id"].rsplit("_", 1)[-1]) <= 70]
    for card in existing:
        card["effects"] = json.loads(card.pop("effectsJson", "[]") or "[]")
    picture_cards = existing + make_picture_additions()
    starter_cards = make_starter_cards()

    picture_json.write_text(json.dumps(database_cards(picture_cards), ensure_ascii=False, indent=2), encoding="utf-8")
    (DATA / "starter-n.json").write_text(json.dumps(database_cards(starter_cards), ensure_ascii=False, indent=2), encoding="utf-8")
    (STATIC / "js/picture-extension.js").write_text(
        "export const PICTURE_EXTENSION_CARDS = " + json.dumps(picture_cards, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    (STATIC / "js/starter-n.js").write_text(
        "export const STARTER_N_CARDS = " + json.dumps(starter_cards, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    (STATIC / "assets/cards/starter-n/LICENSE.txt").write_text(
        (CC0 / "LICENSE.txt").read_text(encoding="utf-8"), encoding="utf-8"
    )
    (STATIC / "assets/cards/starter-n/SOURCE.txt").write_text(
        "Source: https://github.com/sparklinlabs/superpowers-asset-packs\n"
        "Commit: e8674a03ab4456802f71f848c4df79eccca23f7a\n"
        "License: CC0 1.0 Universal\n",
        encoding="utf-8",
    )
    print(f"picture={len(picture_cards)}, starter={len(starter_cards)}")


if __name__ == "__main__":
    write_outputs()
