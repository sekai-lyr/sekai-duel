import assert from "node:assert/strict";
import test from "node:test";

import { ALL_CARDS } from "../../main/resources/static/js/catalog.js";

const EXPECTED_NAMES = {
    picture_ssr7_003: "浊心斯卡蒂·深海夜宴",
    picture_ssr7_005: "初音未来·星海镜音",
    picture_ssr7_006: "浊心斯卡蒂·霜海凛冬",
    picture_ssr7_007: "史尔特尔·熔核烈歌",
    picture_ssr7_012: "斯卡蒂·黑潮双刃",
    picture_ssr7_013: "能天使·红莲铳火",
    picture_ssr7_014: "阿米娅·星屑天幕",
    picture_ssr7_015: "煌·炎锯镇岳",
    picture_ssr7_016: "W·赤痕爆破",
    picture_ssr7_025: "煌·炎翼焚天",
    picture_ssr7_031: "长崎爽世·迷途之声",
    picture_ssr7_034: "灶门炭治郎·水之呼吸",
    picture_ssr7_035: "若叶睦与丰川祥子·牵绊丝线",
    picture_ssr7_042: "长崎爽世·迷茫独白",
    picture_ssr7_044: "井芹仁菜·无刺之歌",
    picture_ssr7_046: "山田凉·雨中独奏",
    picture_ssr7_047: "阿米娅·赤轮剑影",
    picture_ssr7_052: "雪之下雪乃·春雪",
    picture_ssr7_053: "阿米娅·红线残响",
    picture_ssr7_059: "阿米娅·苍银天穹",
    picture_ssr7_051: "八幡海铃·疾风鼓点",
    picture_ex_072: "菜月昴·死亡回归",
    picture_ex_080: "朝比奈真冬·雨夜狙击",
    picture_ex_082: "辉夜·橙梦舞台",
    picture_ex_083: "月见八千代·海月幻梦",
    picture_ex_084: "酒寄彩叶·青瓷流云",
    picture_ex_088: "丰川祥子·蓝蔷薇",
    picture_ex_091: "若叶睦·水墨午后",
    picture_ex_092: "露帕·金叶跃动",
    picture_ex_093: "海老塚智·绯线独奏",
    picture_ex_094: "井芹仁菜·碧空旋律",
    picture_ex_095: "河原木桃香·海风浅笑",
    picture_ex_096: "RUPA·坠空追风",
    picture_ex_097: "若叶睦·素描沉思",
    picture_ex_098: "安和昴·深海蓝影",
    picture_ex_055: "童磨·寒夜莲华",
    picture_ex_065: "灶门炭十郎·赤月神乐",
    picture_ex_074: "宇智波鼬·须佐鸦影",
    picture_ex_081: "波风水门·九喇嘛连结",
    picture_ex_104: "黑化阿尔托莉雅·暗夜血刃",
    picture_ex_105: "黑化阿尔托莉雅·绯狱复仇",
    picture_ex_106: "阿尔托莉雅·黄昏断罪",
    picture_ex_114: "山田杏奈的放学后",
    source_monster_004: "蕾塞·雨夜引魂",
};

test("人工逐图核对后的角色名不会退回旧的错误命名", () => {
    const cards = new Map(ALL_CARDS.map(card => [card.id, card]));
    for (const [id, expectedName] of Object.entries(EXPECTED_NAMES)) {
        assert.equal(cards.get(id)?.name, expectedName, `${id}的图片与角色名必须一致`);
    }
});
