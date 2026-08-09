package com.sekai.game.service;

import com.sekai.game.entity.Card;
import com.sekai.game.entity.Deck;
import com.sekai.game.entity.DeckCard;
import com.sekai.game.entity.User;
import com.sekai.game.entity.UserCard;
import com.sekai.game.repository.DeckCardRepository;
import com.sekai.game.repository.DeckRepository;
import com.sekai.game.repository.UserCardRepository;
import com.sekai.game.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
public class StarterDeckService {

    public static final int COLLECTION_VERSION = 7;
    public static final String STARTER_SERIES = "starter_ygo";

    private final UserCardRepository userCardRepository;
    private final DeckRepository deckRepository;
    private final DeckCardRepository deckCardRepository;
    private final UserRepository userRepository;

    public StarterDeckService(
        UserCardRepository userCardRepository,
        DeckRepository deckRepository,
        DeckCardRepository deckCardRepository,
        UserRepository userRepository
    ) {
        this.userCardRepository = userCardRepository;
        this.deckRepository = deckRepository;
        this.deckCardRepository = deckCardRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public void resetToStarterCollection(User user, List<Card> starterCards) {
        List<UserCard> preserved = userCardRepository.findByUserId(user.getId()).stream()
            .filter(owned -> !owned.getCard().getId().startsWith("starter_n_"))
            .filter(owned -> !owned.getCard().getId().startsWith("ygo_n_"))
            .toList();
        userCardRepository.deleteByUserId(user.getId());
        userCardRepository.flush();

        List<UserCard> inventory = new ArrayList<>(preserved.stream().map(previous -> {
            UserCard owned = new UserCard();
            owned.setUser(user);
            owned.setCard(previous.getCard());
            owned.setCount(previous.getCount());
            return owned;
        }).toList());
        inventory.addAll(starterCards.stream().map(card -> {
            UserCard owned = new UserCard();
            owned.setUser(user);
            owned.setCard(card);
            owned.setCount(3);
            return owned;
        }).toList());
        userCardRepository.saveAll(inventory);

        for (Deck deck : deckRepository.findByUserIdAndIsPreset(user.getId(), true)) {
            deckCardRepository.deleteByDeckId(deck.getId());
            deckRepository.delete(deck);
        }

        Deck deck = new Deck();
        deck.setId("starter_" + user.getId());
        deck.setUser(user);
        deck.setName("游戏王N卡新手卡组");
        deck.setCoverCardId(starterCards.getFirst().getId());
        deck.setDescription("系统赠送的40张游戏王N卡新手卡组");
        deck.setDifficulty("beginner");
        deck.setStrategy("balanced");
        deck.setIsPreset(true);
        deckRepository.save(deck);

        List<Card> selectedCards = selectMainDeck(starterCards);
        List<DeckCard> deckCards = new ArrayList<>();
        for (int index = 0; index < selectedCards.size(); index++) {
            DeckCard deckCard = new DeckCard();
            deckCard.setDeck(deck);
            deckCard.setCardId(selectedCards.get(index).getId());
            deckCard.setSlotType("main");
            deckCard.setPosition(index);
            deckCards.add(deckCard);
        }
        deckCardRepository.saveAll(deckCards);

        user.setSelectedDeckId(deck.getId());
        user.setCollectionVersion(COLLECTION_VERSION);
        userRepository.save(user);
    }

    private List<Card> selectMainDeck(List<Card> starterCards) {
        List<Card> mainDeck = new ArrayList<>();
        addCardsByType(mainDeck, starterCards, "monster", 24);
        addCardsByType(mainDeck, starterCards, "spell", 8);
        addCardsByType(mainDeck, starterCards, "trap", 8);
        return mainDeck;
    }

    private void addCardsByType(List<Card> target, List<Card> cards, String type, int count) {
        cards.stream()
            .filter(card -> type.equals(card.getType()))
            .limit(count)
            .forEach(target::add);
    }
}
