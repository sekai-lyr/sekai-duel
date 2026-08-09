const NAMES = [
    "白庭双生·终幕", "粉樱星轨·弥音", "浊心斯卡蒂·深海夜宴", "曦火圣女·晨祷", "初音未来·星海镜音",
    "浊心斯卡蒂·霜海凛冬", "史尔特尔·熔核烈歌", "焰星旅者·可莉", "青月人偶师·幽兰", "御坂美琴·超电磁炮",
    "冰冠龙姬·苍鳞", "斯卡蒂·黑潮双刃", "能天使·红莲铳火", "阿米娅·星屑天幕", "煌·炎锯镇岳",
    "W·赤痕爆破", "鸦羽祭司·夜祷", "天狼机巧·苍牙", "圣辉裁决·金律", "六花联奏·虹誓",
    "金羽龙骑·破晓", "白狐剑巫·千刃", "蓝发静默者·阶梯", "金庭歌者·夜曲", "煌·炎翼焚天",
    "千早爱音·粉色和弦", "绯月傀儡师·血契", "红棘圣女·荆冠", "红棘圣女·终花", "初音未来·晴空舞台",
    "长崎爽世·迷途之声", "若叶睦·沉默枷锁", "若叶睦·Mortis镜像", "灶门炭治郎·水之呼吸", "若叶睦与丰川祥子·牵绊丝线",
    "要乐奈·自由即兴", "蝴蝶忍·蝶舞清影", "若叶睦·Mortis礼装", "椎名立希·疾走节拍", "长崎爽世·温柔低音",
    "椎名立希·不器用的真心", "长崎爽世·迷茫独白", "丰川祥子·雪夜独奏", "井芹仁菜·无刺之歌", "若叶睦·月下礼装",
    "山田凉·雨中独奏", "阿米娅·赤轮剑影", "丰川祥子·烛火键盘", "八幡海铃·暗潮低音", "若叶睦·微笑假面",
    "八幡海铃·疾风鼓点", "雪之下雪乃·春雪", "阿米娅·红线残响", "初音未来·水镜", "初音未来·花海共鸣",
    "初音未来·南瓜夜曲", "初音未来·春日花冠", "初音未来·星月花嫁", "阿米娅·苍银天穹"
];

const EXTENSIONS = { 23: "png", 47: "jpeg", 52: "jpeg", 53: "png", 54: "png", 55: "png", 56: "png", 57: "png", 58: "png", 59: "png" };
const ATTRIBUTES = ["light", "wind", "dark", "fire", "water", "dark", "fire", "fire", "water", "light", "water", "dark", "fire", "light", "earth"];
const PRIMARY = ["buffSelfAttack", "buffSelfDefense", "directDamage", "healPlayer", "debuffEnemyAttack", "drawCards"];
const SECONDARY = ["debuffAllEnemyAttack", "buffAllAlliesAttack", "damageAllEnemyMonsters", "conditionalBuff"];

function makeEffects(index) {
    const firstType = PRIMARY[index % PRIMARY.length];
    const secondType = SECONDARY[index % SECONDARY.length];
    const firstValue = firstType === "drawCards" ? 1 : 720 + index * 17;
    const secondValue = 260 + index * 11;
    return [
        { trigger: "onSummon", type: firstType, value: firstValue },
        { trigger: "onSummon", type: secondType, value: secondValue },
    ];
}

export const PICTURE_SSR7_CARDS = NAMES.map((name, index) => {
    const number = index + 1;
    const extension = EXTENSIONS[number] || "jpg";
    const effects = makeEffects(index);
    const attack = 2250 + ((index * 73) % 620);
    const defense = 1900 + ((index * 61) % 650);
    return {
        id: `picture_ssr7_${String(number).padStart(3, "0")}`,
        name,
        series: "picture_ssr7",
        type: "monster",
        attribute: ATTRIBUTES[index % ATTRIBUTES.length],
        race: "spellcaster",
        level: 7,
        attack,
        defense,
        rarity: "SSR",
        image: `./assets/cards/picture-ssr7/picture_ssr7_${String(number).padStart(3, "0")}.${extension}`,
        effects,
        description: `登场：发动「${name}」的专属效果。攻击力${attack} / 守备力${defense}。`,
        enabled: true,
    };
});
