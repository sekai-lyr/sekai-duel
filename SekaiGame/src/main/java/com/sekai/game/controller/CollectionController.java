package com.sekai.game.controller;

import com.sekai.game.service.CollectionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/collection")
public class CollectionController {

    @Autowired
    private CollectionService collectionService;

    @GetMapping("/{userId}")
    public ResponseEntity<List<Map<String, Object>>> getUserCollection(@PathVariable Long userId) {
        return ResponseEntity.ok(collectionService.getUserCollection(userId));
    }

    @GetMapping("/{userId}/stats")
    public ResponseEntity<Map<String, Object>> getCollectionStats(@PathVariable Long userId) {
        return ResponseEntity.ok(collectionService.getCollectionStats(userId));
    }

    @PutMapping("/{userId}")
    public ResponseEntity<?> saveCollection(@PathVariable Long userId, @RequestBody Map<String, Object> body) {
        try {
            return ResponseEntity.ok(collectionService.saveCollection(userId, body));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "reason", e.getMessage()));
        }
    }

    @PostMapping("/{userId}/pack")
    public ResponseEntity<?> openPack(@PathVariable Long userId, @RequestBody Map<String, Object> body) {
        String packType = (String) body.getOrDefault("packType", "nightcord");
        int count = (int) body.getOrDefault("count", 8);
        return ResponseEntity.ok(collectionService.openPack(userId, packType, count));
    }
}
