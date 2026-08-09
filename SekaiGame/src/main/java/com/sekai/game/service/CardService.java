package com.sekai.game.service;

import com.sekai.game.entity.Card;
import com.sekai.game.repository.CardRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class CardService {

    @Autowired
    private CardRepository cardRepository;

    public List<Card> getAllCards() {
        return cardRepository.findByEnabledTrue();
    }

    public Optional<Card> getCardById(String id) {
        return cardRepository.findById(id);
    }

    public List<Card> getCardsByType(String type) {
        return cardRepository.findByType(type);
    }

    public List<Card> getCardsByRarity(String rarity) {
        return cardRepository.findByRarity(rarity);
    }

    public List<Card> getCardsBySeries(String series) {
        return cardRepository.findBySeriesAndEnabledTrue(series);
    }

    public List<Card> getCardsByAttribute(String attribute) {
        return cardRepository.findByAttribute(attribute);
    }

    public Card saveCard(Card card) {
        return cardRepository.save(card);
    }

    public List<Card> saveAllCards(List<Card> cards) {
        return cardRepository.saveAll(cards);
    }

    public long getCardCount() {
        return cardRepository.count();
    }

    public void deleteCard(String id) {
        cardRepository.deleteById(id);
    }
}
