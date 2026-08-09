package com.sekai.game.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sekai.game.entity.Card;
import com.sekai.game.entity.User;
import com.sekai.game.entity.UserCard;
import com.sekai.game.repository.CardRepository;
import com.sekai.game.repository.DeckCardRepository;
import com.sekai.game.repository.UserCardRepository;
import com.sekai.game.repository.UserRepository;
import com.sekai.game.service.StarterDeckService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);
    private final CardRepository cardRepository;
    private final UserRepository userRepository;
    private final UserCardRepository userCardRepository;
    private final DeckCardRepository deckCardRepository;
    private final PasswordEncoder passwordEncoder;
    private final StarterDeckService starterDeckService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public DataInitializer(
        CardRepository cardRepository,
        UserRepository userRepository,
        UserCardRepository userCardRepository,
        DeckCardRepository deckCardRepository,
        PasswordEncoder passwordEncoder,
        StarterDeckService starterDeckService
    ) {
        this.cardRepository = cardRepository;
        this.userRepository = userRepository;
        this.userCardRepository = userCardRepository;
        this.deckCardRepository = deckCardRepository;
        this.passwordEncoder = passwordEncoder;
        this.starterDeckService = starterDeckService;
    }

    @Override
    public void run(String... args) {
        List<Card> cards = new ArrayList<>(loadCardsFromBase64());
        cards.addAll(loadCardsFromJson("card-data/picture-extension.json"));
        cards.addAll(loadCardsFromJson("card-data/picture-ssr7.json"));
        cards.addAll(loadCardsFromJson("card-data/ygo-starter.json"));
        if (cards.isEmpty()) {
            log.error("卡牌数据为空，初始化终止");
            return;
        }

        cardRepository.saveAll(cards);
        seedDefaultUser();
        migrateCollections(cards);
        removeObsoleteCards(cards);
        log.info("卡牌初始化完成：{} 张卡牌，{} 位用户", cards.size(), userRepository.count());
    }

    private void removeObsoleteCards(List<Card> cards) {
        Set<String> currentIds = new HashSet<>();
        cards.forEach(card -> currentIds.add(card.getId()));
        for (Card stored : cardRepository.findAll()) {
            if (!currentIds.contains(stored.getId())) {
                deckCardRepository.findAll().stream()
                    .filter(deckCard -> stored.getId().equals(deckCard.getCardId()))
                    .forEach(deckCardRepository::delete);
                userCardRepository.deleteByCardId(stored.getId());
                cardRepository.delete(stored);
            }
        }
    }

    private void migrateCollections(List<Card> cards) {
        List<Card> starterCards = cards.stream()
            .filter(card -> StarterDeckService.STARTER_SERIES.equals(card.getSeries()))
            .toList();
        for (User user : userRepository.findAll()) {
            boolean owner = "sekai".equalsIgnoreCase(user.getUsername());
            int version = user.getCollectionVersion() == null ? 0 : user.getCollectionVersion();
            if (!owner && version >= StarterDeckService.COLLECTION_VERSION) {
                continue;
            }

            if (!owner) {
                starterDeckService.resetToStarterCollection(user, starterCards);
                log.info("已迁移用户 {} 的N卡新手收藏：{} 张不同卡牌", user.getUsername(), starterCards.size());
                continue;
            }

            userCardRepository.deleteByUserId(user.getId());
            List<UserCard> inventory = cards.stream()
                .filter(card -> owner)
                .map(card -> ownedCard(user, card, owner ? 3 : 1))
                .toList();
            userCardRepository.saveAll(inventory);
            user.setCollectionVersion(StarterDeckService.COLLECTION_VERSION);
            userRepository.save(user);
            log.info("已迁移用户 {} 的收藏：{} 张不同卡牌", user.getUsername(), inventory.size());
        }
    }

    private UserCard ownedCard(User user, Card card, int count) {
        UserCard owned = new UserCard();
        owned.setUser(user);
        owned.setCard(card);
        owned.setCount(count);
        return owned;
    }

    private void seedDefaultUser() {
        if (userRepository.findByUsername("sekai").isPresent()) {
            return;
        }
        User sekai = new User();
        sekai.setUsername("sekai");
        sekai.setPassword(passwordEncoder.encode("123456520baba"));
        sekai.setNickname("sekai");
        sekai.setDuelCoins(99999);
        userRepository.save(sekai);
    }

    private List<Card> loadCardsFromBase64() {
        List<Card> cards = new ArrayList<>();
        try {
            ClassPathResource resource = new ClassPathResource("cards-base64.txt");
            String encoded = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8)
                .trim()
                .replaceFirst("^\\+", "");
            JsonNode root = objectMapper.readTree(Base64.getDecoder().decode(encoded));
            root.forEach(node -> addParsedCard(cards, node));
            log.info("从 cards-base64.txt 读取 {} 张卡牌", cards.size());
        } catch (Exception exception) {
            log.error("读取 cards-base64.txt 失败", exception);
        }
        return cards;
    }

    private List<Card> loadCardsFromJson(String resourcePath) {
        List<Card> cards = new ArrayList<>();
        try {
            JsonNode root = objectMapper.readTree(new ClassPathResource(resourcePath).getInputStream());
            root.forEach(node -> addParsedCard(cards, node));
            log.info("从 {} 读取 {} 张卡牌", resourcePath, cards.size());
        } catch (Exception exception) {
            log.error("读取 {} 失败", resourcePath, exception);
        }
        return cards;
    }

    private void addParsedCard(List<Card> cards, JsonNode node) {
        Card card = parseCardNode(node);
        if (card != null) {
            cards.add(card);
        }
    }

    private Card parseCardNode(JsonNode node) {
        try {
            Card card = new Card();
            card.setId(text(node, "id", null));
            card.setName(text(node, "name", card.getId()));
            card.setSeries(text(node, "series", null));
            card.setMember(text(node, "member", null));
            card.setRace(text(node, "race", null));
            card.setType(text(node, "type", "monster"));
            card.setAttribute(text(node, "attribute", "dark"));
            card.setLevel(number(node, "level", 0));
            card.setAttack(number(node, "attack", 0));
            card.setDefense(number(node, "defense", 0));
            card.setRarity(text(node, "rarity", "N"));
            card.setCost(number(node, "cost", 0));
            card.setImage(text(node, "image", null));
            card.setDescription(text(node, "description", ""));
            card.setEffectsJson(text(node, "effectsJson", null));
            card.setEnabled(!node.has("enabled") || node.get("enabled").asBoolean());
            return card;
        } catch (Exception exception) {
            log.warn("跳过无法解析的卡牌节点：{}", exception.getMessage());
            return null;
        }
    }

    private String text(JsonNode node, String field, String fallback) {
        return node.has(field) && !node.get(field).isNull() ? node.get(field).asText() : fallback;
    }

    private int number(JsonNode node, String field, int fallback) {
        return node.has(field) ? node.get(field).asInt(fallback) : fallback;
    }
}
