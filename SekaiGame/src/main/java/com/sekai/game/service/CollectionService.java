package com.sekai.game.service;

import com.sekai.game.entity.Card;
import com.sekai.game.entity.UserCard;
import com.sekai.game.repository.CardRepository;
import com.sekai.game.repository.UserCardRepository;
import com.sekai.game.repository.UserRepository;
import com.sekai.game.entity.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class CollectionService {

    @Autowired
    private UserCardRepository userCardRepository;

    @Autowired
    private CardRepository cardRepository;

    @Autowired
    private UserRepository userRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional
    public Map<String, Object> saveCollection(Long userId, Map<String, Object> body) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        if ("sekai".equalsIgnoreCase(user.getUsername())) {
            userCardRepository.deleteByUserId(userId);
            userCardRepository.flush();
            List<UserCard> ownerCards = cardRepository.findAll().stream()
                .filter(card -> Boolean.TRUE.equals(card.getEnabled()))
                .map(card -> {
                    UserCard owned = new UserCard();
                    owned.setUser(user);
                    owned.setCard(card);
                    owned.setCount(3);
                    return owned;
                })
                .toList();
            userCardRepository.saveAll(ownerCards);
            return Map.of("success", true, "cards", ownerCards.size());
        }

        Object cardsValue = body.get("cards");
        if (!(cardsValue instanceof Map<?, ?> cards)) {
            throw new IllegalArgumentException("收藏数据格式错误");
        }

        userCardRepository.deleteByUserId(userId);
        userCardRepository.flush();
        List<UserCard> savedCards = new ArrayList<>();
        for (Map.Entry<?, ?> entry : cards.entrySet()) {
            String cardId = String.valueOf(entry.getKey());
            int count = entry.getValue() instanceof Number number ? number.intValue() : 0;
            if (count <= 0) continue;
            Card card = cardRepository.findById(cardId).orElse(null);
            if (card == null || !Boolean.TRUE.equals(card.getEnabled())) continue;
            UserCard owned = new UserCard();
            owned.setUser(user);
            owned.setCard(card);
            owned.setCount(Math.min(count, 3));
            savedCards.add(owned);
        }
        userCardRepository.saveAll(savedCards);

        if (body.get("duelCoins") instanceof Number coins) user.setDuelCoins(Math.max(0, coins.intValue()));
        if (body.get("packsOpened") instanceof Number packs) user.setPacksOpened(Math.max(0, packs.intValue()));
        try {
            if (body.containsKey("shards")) user.setShardsJson(objectMapper.writeValueAsString(body.get("shards")));
            if (body.containsKey("pityCounters")) user.setPityCountersJson(objectMapper.writeValueAsString(body.get("pityCounters")));
        } catch (Exception e) {
            throw new IllegalArgumentException("经济数据格式错误");
        }
        userRepository.save(user);
        return Map.of("success", true, "cards", savedCards.size());
    }

    public List<Map<String, Object>> getUserCollection(Long userId) {
        List<UserCard> userCards = userCardRepository.findByUserId(userId);
        return userCards.stream().map(uc -> {
            Map<String, Object> map = new HashMap<>();
            map.put("cardId", uc.getCard().getId());
            map.put("count", uc.getCount());
            map.put("name", uc.getCard().getName());
            map.put("rarity", uc.getCard().getRarity());
            map.put("type", uc.getCard().getType());
            return map;
        }).collect(Collectors.toList());
    }

    @Transactional
    public Map<String, Object> openPack(Long userId, String packType, int count) {
        List<Card> pool = cardRepository.findAll().stream()
            .filter(card -> Boolean.TRUE.equals(card.getEnabled()))
            .filter(card -> !StarterDeckService.STARTER_SERIES.equals(card.getSeries()))
            .toList();
        if (pool.isEmpty()) {
            return Map.of("success", false, "reason", "卡池为空");
        }

        Map<String, Double> rates = Map.of(
            "N", 0.62, "R", 0.25, "SR", 0.09, "SSR", 0.035, "UR", 0.005
        );

        List<Card> pulledCards = new ArrayList<>();
        Random random = new Random();

        for (int i = 0; i < count; i++) {
            double roll = random.nextDouble();
            String rarity;
            if (roll < rates.get("UR")) rarity = "UR";
            else if (roll < rates.get("UR") + rates.get("SSR")) rarity = "SSR";
            else if (roll < rates.get("UR") + rates.get("SSR") + rates.get("SR")) rarity = "SR";
            else if (roll < rates.get("UR") + rates.get("SSR") + rates.get("SR") + rates.get("R")) rarity = "R";
            else rarity = "N";

            List<Card> rarityPool = pool.stream()
                .filter(c -> c.getRarity().equals(rarity))
                .toList();
            if (rarityPool.isEmpty()) rarityPool = pool;

            pulledCards.add(rarityPool.get(random.nextInt(rarityPool.size())));
        }

        List<Map<String, Object>> results = new ArrayList<>();
        for (Card card : pulledCards) {
            addCardToUser(userId, card.getId(), 1);
            Map<String, Object> map = new HashMap<>();
            map.put("id", card.getId());
            map.put("name", card.getName());
            map.put("rarity", card.getRarity());
            map.put("type", card.getType());
            results.add(map);
        }

        return Map.of("success", true, "cards", results);
    }

    @Transactional
    public UserCard addCardToUser(Long userId, String cardId, int count) {
        Optional<UserCard> existing = userCardRepository.findByUserIdAndCardId(userId, cardId);
        if (existing.isPresent()) {
            UserCard uc = existing.get();
            uc.setCount(Math.min(uc.getCount() + count, 3));
            return userCardRepository.save(uc);
        } else {
            UserCard uc = new UserCard();
            com.sekai.game.entity.User user = new com.sekai.game.entity.User();
            user.setId(userId);
            uc.setUser(user);
            uc.setCard(new Card(cardId));
            uc.setCount(Math.min(count, 3));
            return userCardRepository.save(uc);
        }
    }

    public Map<String, Object> getCollectionStats(Long userId) {
        List<UserCard> userCards = userCardRepository.findByUserId(userId);
        long totalCards = userCards.stream().mapToLong(UserCard::getCount).sum();
        long uniqueCards = userCards.size();
        Map<String, Long> rarityCount = userCards.stream()
            .collect(Collectors.groupingBy(
                uc -> uc.getCard().getRarity(),
                Collectors.summingLong(UserCard::getCount)
            ));
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalCards", totalCards);
        stats.put("uniqueCards", uniqueCards);
        stats.put("rarityDistribution", rarityCount);
        return stats;
    }
}
