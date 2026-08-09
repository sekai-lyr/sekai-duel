/**
 * constants.js
 * 游戏全局常量 —— 次元决斗：元素召唤
 */

export const GAME_CONFIG = {
    START_LP: 8000,
    MAX_LP: 8000,
    START_HAND_SIZE: 5,
    END_HAND_LIMIT: 6,
    MAX_HAND_SIZE: 99,
    MAX_MONSTER_ZONE: 5,
    MAX_SPELL_TRAP_ZONE: 5,
    MIN_DECK_SIZE: 40,
    MAX_DECK_SIZE: 60,
    MAX_EXTRA_DECK_SIZE: 15,
    MAX_SIDE_DECK_SIZE: 15,
    FIRST_TURN_NO_BATTLE: true,
};

export const PHASE = {
    WAITING: "waiting",
    DRAW: "draw",
    STANDBY: "standby",
    MAIN_1: "main_1",
    BATTLE: "battle",
    MAIN_2: "main_2",
    END: "end",
    TARGET_SELECT: "target_select",
    GRAVEYARD_SELECT: "graveyard_select",
    TRIBUTE_SELECT: "tribute_select",
};

export const CARD_TYPE = { MONSTER: "monster", SPELL: "spell", TRAP: "trap" };
export const MONSTER_POSITION = { ATTACK: "attack", DEFENSE: "defense" };

export const SPELL_SUBTYPE = {
    NORMAL: "normal", QUICK_PLAY: "quick_play", CONTINUOUS: "continuous",
    EQUIP: "equip", FIELD: "field",
};

export const TRAP_SUBTYPE = {
    NORMAL: "normal", CONTINUOUS: "continuous", COUNTER: "counter",
};

export const SUMMON_TYPE = { NORMAL: "normal", SET: "set", SPECIAL: "special" };

export const TARGET_TYPE = {
    ENEMY_MONSTER: "enemy_monster",
    ENEMY_MONSTER_OR_PLAYER: "enemy_monster_or_player",
    ANY_MONSTER: "any_monster",
    SELF_MONSTER: "self_monster",
    SELF_PLAYER: "self_player",
    ENEMY_PLAYER: "enemy_player",
    BOTH_PLAYERS: "both_players",
    FROM_GRAVEYARD: "graveyard",
    NONE: "none",
};

// ---- 新增：通用目标选择器结构 ----
export const TARGET_OWNER = { SELF: "self", OPPONENT: "opponent", BOTH: "both" };
export const TARGET_ZONE = { HAND: "hand", MONSTER: "monster", SPELL_TRAP: "spellTrap", GRAVEYARD: "graveyard", DECK: "deck", FIELD: "field" };
export const TARGET_SELECTOR = { SELF: "self", CHOOSE: "choose", RANDOM: "random", ALL: "all", HIGHEST_ATK: "highestAttack", LOWEST_ATK: "lowestAttack" };

// ---- 新增：效果触发时机（扩展） ----
export const EFFECT_TRIGGER = {
    ON_SUMMON: "onSummon",
    ON_SPECIAL_SUMMON: "onSpecialSummon",
    ON_FLIP: "onFlip",
    ON_ATTACK_DECLARE: "onAttackDeclare",
    ON_ATTACKED: "onAttacked",
    BEFORE_DAMAGE: "beforeDamage",
    AFTER_DAMAGE: "afterDamage",
    ON_BATTLE_DAMAGE: "onBattleDamage",
    ON_DESTROYED: "onDestroyed",
    ON_DESTROY_BY_BATTLE: "onDestroyByBattle",
    ON_SENT_TO_GRAVEYARD: "onSentToGraveyard",
    ON_BANISHED: "onBanished",
    ON_TURN_START: "onTurnStart",
    ON_TURN_END: "onTurnEnd",
    ON_PHASE_START: "onPhaseStart",
    ON_PHASE_END: "onPhaseEnd",
    ON_DRAW: "onDraw",
    ON_SET: "onSet",
    ON_LIFE_CHANGED: "onLifeChanged",
    ON_OPPONENT_EFFECT: "onOpponentEffect",
    MANUAL: "manual",
};

// ---- 新增：效果类型（扩展） ----
export const EFFECT_TYPE = {
    // 数值变化
    MODIFY_STAT: "modifyStat",
    SET_STAT: "setStat",
    SWAP_ATK_DEF: "swapAttackDefense",
    DOUBLE_ATTACK: "doubleAttack",
    HALVE_ATTACK: "halveAttack",
    GAIN_ATK_BY_COUNT: "gainAttackByCount",
    // 伤害和恢复
    DAMAGE_PLAYER: "damagePlayer",
    DAMAGE_MONSTER: "damageMonster",
    DAMAGE_ALL_MONSTERS: "damageAllMonsters",
    HEAL_PLAYER: "healPlayer",
    DRAIN_LIFE: "drainLife",
    PAY_LIFE: "payLife",
    // 抽卡和手牌
    DRAW_CARDS: "drawCards",
    DISCARD_CARDS: "discardCards",
    RETURN_TO_HAND: "returnToHand",
    SHUFFLE_INTO_DECK: "shuffleIntoDeck",
    SEARCH_DECK: "searchDeck",
    // 破坏和移除
    DESTROY_CARD: "destroyCard",
    DESTROY_MONSTER: "destroyMonster",
    DESTROY_SPELL_TRAP: "destroySpellTrap",
    DESTROY_ALL: "destroyAll",
    BANISH_CARD: "banishCard",
    SEND_TO_GRAVEYARD: "sendToGraveyard",
    // 召唤相关
    SPECIAL_SUMMON_FROM_HAND: "specialSummonFromHand",
    SPECIAL_SUMMON_FROM_GRAVEYARD: "specialSummonFromGraveyard",
    SPECIAL_SUMMON_FROM_DECK: "specialSummonFromDeck",
    REVIVE_MONSTER: "reviveMonster",
    TOKEN_SUMMON: "tokenSummon",
    ADDITIONAL_NORMAL_SUMMON: "additionalNormalSummon",
    // 战斗相关
    NEGATE_ATTACK: "negateAttack",
    REDIRECT_ATTACK: "redirectAttack",
    FORCE_ATTACK: "forceAttack",
    DIRECT_ATTACK: "directAttack",
    PIERCING_DAMAGE: "piercingDamage",
    ATTACK_TWICE: "attackTwice",
    CANNOT_ATTACK: "cannotAttack",
    CANNOT_BE_ATTACKED: "cannotBeAttacked",
    CHANGE_POSITION: "changePosition",
    FLIP_FACE_UP: "flipFaceUp",
    FLIP_FACE_DOWN: "flipFaceDown",
    // 抗性和保护
    CANNOT_BE_DESTROYED_BY_BATTLE: "cannotBeDestroyedByBattle",
    CANNOT_BE_DESTROYED_BY_EFFECT: "cannotBeDestroyedByEffect",
    CANNOT_BE_TARGETED: "cannotBeTargeted",
    PREVENT_DAMAGE: "preventDamage",
    PROTECT_OTHER_CARD: "protectOtherCard",
    // 效果控制
    NEGATE_EFFECT: "negateEffect",
    COPY_EFFECT: "copyEffect",
    DISABLE_CARD: "disableCard",
    // 魔法陷阱
    SET_TRAP_FROM_DECK: "setTrapFromDeck",
    RECOVER_SPELL_TRAP: "recoverSpellTrap",
    DESTROY_SET_CARD: "destroySetCard",
    // 兼容旧效果
    DAMAGE_ALL_ENEMY_MONSTERS: "damageAllEnemyMonsters",
    DESTROY_ALL_ENEMY_MONSTERS: "destroyAllEnemyMonsters",
    BUFF_SELF_ATTACK: "buffSelfAttack",
    BUFF_SELF_DEFENSE: "buffSelfDefense",
    DEBUFF_ENEMY_ATTACK: "debuffEnemyAttack",
    DEBUFF_ALL_ENEMY_ATTACK: "debuffAllEnemyAttack",
    BUFF_ALL_ALLIES_ATTACK: "buffAllAlliesAttack",
    DIRECT_DAMAGE: "directDamage",
    DESTROY_TARGET: "destroyTarget",
    DAMAGE_BOTH_PLAYERS: "damageBothPlayers",
    DAMAGE_AND_HEAL: "damageAndHeal",
    REVIVE_TO_HAND: "reviveToHand",
    REFLECT_DAMAGE: "reflectDamage",
    COUNTER_AND_DAMAGE: "counterAndDamage",
    REDUCE_DAMAGE: "reduceDamage",
    DESTROY_ATTACKER: "destroyAttacker",
    LIFESTEAL: "lifesteal",
    HEAL_ALL_ALLIES: "healAllAllies",
    HEAL_PLAYER_LEGACY: "healPlayer",
    DRAW_CARDS_LEGACY: "drawCards",
    BUFF_SELF_ATTACK_LEGACY: "buffSelfAttack",
    BUFF_SELF_DEFENSE_LEGACY: "buffSelfDefense",
    DEBUFF_ENEMY_ATTACK_LEGACY: "debuffEnemyAttack",
    DEBUFF_ALL_ENEMY_ATTACK_LEGACY: "debuffAllEnemyAttack",
    BUFF_ALL_ALLIES_ATTACK_LEGACY: "buffAllAlliesAttack",
    DIRECT_DAMAGE_LEGACY: "directDamage",
    DESTROY_TARGET_LEGACY: "destroyTarget",
    DAMAGE_BOTH_PLAYERS_LEGACY: "damageBothPlayers",
    DAMAGE_AND_HEAL_LEGACY: "damageAndHeal",
    REVIVE_TO_HAND_LEGACY: "reviveToHand",
};

// ---- 新增：效果成本类型 ----
export const COST_TYPE = {
    PAY_LIFE: "payLife",
    DISCARD: "discard",
    TRIBUTE: "tribute",
    SEND_SELF_TO_GRAVEYARD: "sendSelfToGraveyard",
    BANISH_FROM_GRAVEYARD: "banishFromGraveyard",
    RELEASE_MONSTER: "releaseMonster",
    SKIP_BATTLE_PHASE: "skipBattlePhase",
    CANNOT_ATTACK_THIS_TURN: "cannotAttackThisTurn",
};

// ---- 新增：持续时间 ----
export const DURATION = {
    PERMANENT: "permanent",
    UNTIL_END_TURN: "untilEndTurn",
    UNTIL_NEXT_TURN: "untilNextTurn",
    DURING_DAMAGE_CALC: "duringDamageCalculation",
    WHILE_FACE_UP: "whileFaceUp",
};

// ---- 新增：限制类型 ----
export const LIMIT_TYPE = {
    ONCE_PER_TURN: "oncePerTurn",
    ONCE_PER_DUEL: "oncePerDuel",
    HARD_ONCE_PER_TURN: "hardOncePerTurn",
    ONLY_OWN_TURN: "onlyDuringOwnTurn",
};

export const RACE = {
    DRAGON: "dragon", WARRIOR: "warrior", SPELLCASTER: "spellcaster",
    BEAST: "beast", MACHINE: "machine", FIEND: "fiend", FAIRY: "fairy",
    ROCK: "rock", AQUA: "aqua", WINGED_BEAST: "winged_beast",
    INSECT: "insect", ZOMBIE: "zombie", DRAGON_KNIGHT: "dragon_knight",
    PLANT: "plant", PSYCHIC: "psychic", SEA_SERPENT: "sea_serpent",
    THUNDER: "thunder", REPTILE: "reptile", BEAST_WARRIOR: "beast_warrior",
    CYBERSE: "cyberse", DIVINE_BEAST: "divine_beast",
};

export const AI_DIFFICULTY = { EASY: "easy", NORMAL: "normal", HARD: "hard" };

// ---- 新增：AI 角色定位 ----
export const AI_ROLE = {
    ATTACKER: "attacker", DEFENDER: "defender", REMOVAL: "removal",
    DRAW: "draw", RECOVERY: "recovery", FINISHER: "finisher",
    COMBO_STARTER: "comboStarter", COMBO_EXTENDER: "comboExtender",
    PROTECTION: "protection", COUNTER: "counter",
};
