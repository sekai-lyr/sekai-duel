package com.sekai.game.controller;

import com.sekai.game.entity.Deck;
import com.sekai.game.service.DeckService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/decks")
public class DeckController {

    @Autowired
    private DeckService deckService;

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<Deck>> getUserDecks(@PathVariable Long userId) {
        return ResponseEntity.ok(deckService.getUserDecks(userId));
    }

    @GetMapping("/{deckId}")
    public ResponseEntity<?> getDeck(@PathVariable String deckId) {
        return deckService.getDeckById(deckId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/user/{userId}")
    public ResponseEntity<?> createDeck(@PathVariable Long userId, @RequestBody Map<String, Object> body) {
        try {
            String name = (String) body.get("name");
            String coverCardId = (String) body.get("coverCardId");
            @SuppressWarnings("unchecked")
            List<String> mainCardIds = (List<String>) body.get("main");
            Deck deck = deckService.createDeck(userId, name, coverCardId, mainCardIds);
            return ResponseEntity.ok(deck);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("reason", e.getMessage()));
        }
    }

    @PutMapping("/{deckId}")
    public ResponseEntity<?> updateDeck(@PathVariable String deckId, @RequestBody Map<String, Object> body) {
        try {
            String name = (String) body.get("name");
            String coverCardId = (String) body.get("coverCardId");
            @SuppressWarnings("unchecked")
            List<String> mainCardIds = (List<String>) body.get("main");
            @SuppressWarnings("unchecked")
            List<String> extraCardIds = (List<String>) body.get("extra");
            @SuppressWarnings("unchecked")
            List<String> sideCardIds = (List<String>) body.get("side");
            Deck deck = deckService.updateDeck(deckId, name, coverCardId, mainCardIds, extraCardIds, sideCardIds);
            return ResponseEntity.ok(deck);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("reason", e.getMessage()));
        }
    }

    @DeleteMapping("/{deckId}")
    public ResponseEntity<?> deleteDeck(@PathVariable String deckId) {
        try {
            deckService.deleteDeck(deckId);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("reason", e.getMessage()));
        }
    }
}
