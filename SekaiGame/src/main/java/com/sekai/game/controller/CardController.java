package com.sekai.game.controller;

import com.sekai.game.entity.Card;
import com.sekai.game.service.CardService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/cards")
public class CardController {

    @Autowired
    private CardService cardService;

    @GetMapping
    public ResponseEntity<List<Card>> getAllCards() {
        return ResponseEntity.ok(cardService.getAllCards());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getCard(@PathVariable String id) {
        return cardService.getCardById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/type/{type}")
    public ResponseEntity<List<Card>> getCardsByType(@PathVariable String type) {
        return ResponseEntity.ok(cardService.getCardsByType(type));
    }

    @GetMapping("/rarity/{rarity}")
    public ResponseEntity<List<Card>> getCardsByRarity(@PathVariable String rarity) {
        return ResponseEntity.ok(cardService.getCardsByRarity(rarity));
    }

    @GetMapping("/series/{series}")
    public ResponseEntity<List<Card>> getCardsBySeries(@PathVariable String series) {
        return ResponseEntity.ok(cardService.getCardsBySeries(series));
    }

    @GetMapping("/attribute/{attribute}")
    public ResponseEntity<List<Card>> getCardsByAttribute(@PathVariable String attribute) {
        return ResponseEntity.ok(cardService.getCardsByAttribute(attribute));
    }

    @GetMapping("/count")
    public ResponseEntity<Map<String, Long>> getCardCount() {
        return ResponseEntity.ok(Map.of("count", cardService.getCardCount()));
    }

    @PostMapping
    public ResponseEntity<Card> createCard(@RequestBody Card card) {
        return ResponseEntity.ok(cardService.saveCard(card));
    }

    @PostMapping("/batch")
    public ResponseEntity<List<Card>> createCards(@RequestBody List<Card> cards) {
        return ResponseEntity.ok(cardService.saveAllCards(cards));
    }
}
