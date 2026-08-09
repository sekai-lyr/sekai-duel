/**
 * catalog.js - 游戏使用的完整卡牌目录与插画映射
 */
import { cardDatabase as ELEMENT_CARDS } from "./cards.js";
import { ANIME_CARDS } from "./nightcord-cards.js";
import { IMAGE_CARDS } from "./image-cards.js";
import { GENERATED_CARDS } from "./generated-cards.js?v=1.0.1";
import { PICTURE_EXTENSION_CARDS } from "./picture-extension.js?v=1.0.3";
import { PICTURE_SSR7_CARDS } from "./picture-ssr7.js?v=1.0.5";
import { YGO_STARTER_CARDS } from "./ygo-starter.js";
import { NIGHTCORD_ART, getArtById, getDefaultArt } from "./nightcord-art.js";
import { normalizeCardPool } from "./card-rules.js?v=1.8.4";

const MEMBER_FALLBACK = {
    group: "nc_sp_ur_001",
};

export const ALL_CARDS = normalizeCardPool([...YGO_STARTER_CARDS, ...PICTURE_SSR7_CARDS, ...PICTURE_EXTENSION_CARDS, ...ELEMENT_CARDS, ...ANIME_CARDS, ...IMAGE_CARDS, ...GENERATED_CARDS]);
export const NIGHTCORD_ONLY = ALL_CARDS.filter(card => card.series === "nightcord");

export function getCardById(cardId) {
    return ALL_CARDS.find(card => card.id === cardId) || null;
}

export function getCardArts(cardId) {
    return NIGHTCORD_ART[cardId] ? [...NIGHTCORD_ART[cardId]] : [];
}

function getFallbackArt(card) {
    const fallbackId = MEMBER_FALLBACK[card.member] || MEMBER_FALLBACK.group;
    return getDefaultArt(fallbackId);
}

export function hydrateCardArt(card, selectedArtByCard = {}) {
    if (!card) return null;
    if (card.series !== "nightcord" || card.id?.startsWith("gallery_")) return { ...card };

    const selectedId = selectedArtByCard?.[card.id];
    const selected = selectedId ? getArtById(selectedId) : null;
    const art = selected || getDefaultArt(card.id) || getFallbackArt(card);

    if (!art) return { ...card };
    return {
        ...card,
        image: art.image,
        thumbnail: art.thumbnail || art.image,
        selectedArtId: art.artId,
        objectPosition: art.objectPosition || "center",
        artRarity: art.artRarity || "default",
        foil: !!art.foil,
        limitedArt: !!art.limited,
    };
}

export function hydrateCards(cards, selectedArtByCard = {}) {
    return cards.map(card => hydrateCardArt(card, selectedArtByCard));
}

export function buildCardMap(selectedArtByCard = {}) {
    return new Map(ALL_CARDS.map(card => [card.id, hydrateCardArt(card, selectedArtByCard)]));
}
