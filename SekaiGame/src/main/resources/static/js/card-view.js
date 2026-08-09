/** UI安全渲染辅助。 */
export function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

export const MEMBER_NAMES = {
    ena: "东云绘名",
    kanade: "宵崎奏",
    mafuyu: "朝比奈真冬",
    mizuki: "晓山瑞希",
    group: "Nightcord",
};

export const TYPE_NAMES = { monster: "角色", spell: "魔法", trap: "陷阱" };

const EFFECT_TRIGGER_NAMES = {
    onSummon: "召唤成功时",
    onDestroyed: "被破坏时",
    onAttacked: "被攻击时",
    onAttack: "攻击时",
    onFlip: "翻开时",
    manual: "主要阶段主动发动",
    passive: "持续生效",
};

function cleanEffectDescription(effect) {
    return String(effect?.description || "")
        .replace(/^【(?:登场技|连携技|终结技)·[^】]+】/u, "")
        .replace(/^(?:召唤成功时|被破坏时|被攻击时|攻击时|翻开时|主要阶段主动发动|发动时|持续生效)[：:]/u, "")
        .trim();
}

export function cardEffectFieldsHtml(card) {
    const effects = Array.isArray(card?.effects) ? card.effects.filter(Boolean) : [];
    if (!effects.length) {
        const fallback = card?.description || (card?.type === "monster" ? "通常怪兽：没有额外卡牌效果。" : "暂无效果说明。");
        return `<div class="detail-effect-empty">${escapeHtml(fallback)}</div>`;
    }
    const stageLabels = ["登场技", "连携技", "终结技"];
    return `<div class="detail-effect-fields">${effects.map((effect, index) => {
        const isStagedMonster = card?.type === "monster" && effects.length === 3;
        const label = effect.skillLabel || (isStagedMonster ? stageLabels[index] : `效果 ${index + 1}`);
        const skillName = effect.skillName || "卡牌效果";
        const trigger = EFFECT_TRIGGER_NAMES[effect.trigger] || "效果结算时";
        const description = cleanEffectDescription(effect) || "执行该技能效果。";
        const limit = effect.oncePerTurn ? `<span class="detail-effect-limit">每回合1次</span>` : "";
        return `<section class="detail-effect-field" data-skill-stage="${escapeHtml(effect.skillStage || "effect")}">
            <div class="detail-effect-heading"><span class="detail-effect-label">${escapeHtml(label)}</span><strong>${escapeHtml(skillName)}</strong>${limit}</div>
            <div class="detail-effect-trigger">触发：${escapeHtml(trigger)}</div>
            <div class="detail-effect-text">${escapeHtml(description)}</div>
        </section>`;
    }).join("")}</div>`;
}

export function cardArtHtml(card, className = "", preferFull = false) {
    const src = preferFull ? (card?.image || card?.thumbnail || "") : (card?.thumbnail || card?.image || "");
    const pos = escapeHtml(card?.objectPosition || "center");
    if (!src) {
        return `<div class="art-placeholder ${className}"><span>${escapeHtml(card?.name?.slice(0, 1) || "?")}</span></div>`;
    }
    return `<div class="art-media ${className}">
        <img src="${escapeHtml(src)}" alt="${escapeHtml(card.name)}" loading="lazy" decoding="async" style="object-position:${pos}">
        <div class="art-placeholder art-fallback"><span>${escapeHtml(card?.name?.slice(0, 1) || "?")}</span></div>
    </div>`;
}

export function catalogCardHtml(card, owned = 0, options = {}) {
    const compact = options.compact ? " compact" : "";
    const locked = owned <= 0 ? " locked" : "";
    const starter = card.series === "starter_ygo" ? " starter-ygo-card" : "";
    return `<article class="catalog-card rarity-${escapeHtml(card.rarity)}${starter}${compact}${locked}" data-card-id="${escapeHtml(card.id)}">
        ${cardArtHtml(card, "catalog-art")}
        <div class="catalog-gradient"></div>
        <div class="catalog-meta">
            <div class="catalog-kicker"><span>${escapeHtml(TYPE_NAMES[card.type] || card.type)}</span><span>${escapeHtml(card.rarity)}</span></div>
            <strong>${escapeHtml(card.name)}</strong>
            <div class="catalog-stats">${card.type === "monster" ? `ATK ${Number(card.attack || 0)} · DEF ${Number(card.defense || 0)}` : escapeHtml(card.description)}</div>
        </div>
        <span class="owned-count">×${owned}</span>
    </article>`;
}

export function rarityRank(rarity) {
    return { N: 0, R: 1, SR: 2, UR: 3, SSR: 3 }[rarity] ?? 0;
}
