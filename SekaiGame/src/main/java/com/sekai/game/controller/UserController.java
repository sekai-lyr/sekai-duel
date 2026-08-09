package com.sekai.game.controller;

import com.sekai.game.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserService userService;

    @GetMapping("/{userId}")
    public ResponseEntity<?> getUser(@PathVariable Long userId) {
        return userService.getUserById(userId)
            .map(user -> {
                Map<String, Object> result = new java.util.LinkedHashMap<>();
                result.put("userId", user.getId());
                result.put("username", user.getUsername());
                result.put("nickname", user.getNickname());
                result.put("duelCoins", user.getDuelCoins());
                result.put("shardsJson", user.getShardsJson() == null ? "{}" : user.getShardsJson());
                result.put("pityCountersJson", user.getPityCountersJson() == null ? "{}" : user.getPityCountersJson());
                result.put("packsOpened", user.getPacksOpened());
                result.put("duelsPlayed", user.getDuelsPlayed());
                result.put("wins", user.getWins());
                result.put("losses", user.getLosses());
                result.put("draws", user.getDraws());
                return ResponseEntity.ok((Object) result);
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{userId}")
    public ResponseEntity<?> updateUser(@PathVariable Long userId, @RequestBody Map<String, Object> body) {
        try {
            return ResponseEntity.ok(userService.updateUser(userId, body));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("reason", e.getMessage()));
        }
    }

    @GetMapping("/{userId}/stats")
    public ResponseEntity<?> getUserStats(@PathVariable Long userId) {
        try {
            return ResponseEntity.ok(userService.getUserStats(userId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("reason", e.getMessage()));
        }
    }

    @GetMapping("/{userId}/cards")
    public ResponseEntity<?> getUserCards(@PathVariable Long userId) {
        return ResponseEntity.ok(userService.getUserCards(userId));
    }

    @PostMapping("/{userId}/coins")
    public ResponseEntity<?> updateCoins(@PathVariable Long userId, @RequestBody Map<String, Integer> body) {
        try {
            int delta = body.getOrDefault("delta", 0);
            return ResponseEntity.ok(userService.updateDuelCoins(userId, delta));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("reason", e.getMessage()));
        }
    }
}
