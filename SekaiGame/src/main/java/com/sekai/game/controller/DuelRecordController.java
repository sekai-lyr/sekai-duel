package com.sekai.game.controller;

import com.sekai.game.service.DuelRecordService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/duels")
public class DuelRecordController {

    @Autowired
    private DuelRecordService duelRecordService;

    @GetMapping("/user/{userId}")
    public ResponseEntity<?> getUserRecords(@PathVariable Long userId) {
        return ResponseEntity.ok(duelRecordService.getUserRecords(userId));
    }

    @PostMapping("/user/{userId}")
    public ResponseEntity<?> recordDuel(@PathVariable Long userId, @RequestBody Map<String, Object> body) {
        try {
            String result = (String) body.get("result");
            String opponentType = (String) body.getOrDefault("opponentType", "ai");
            String opponentName = (String) body.getOrDefault("opponentName", "AI");
            String deckUsedId = (String) body.get("deckUsedId");
            int lpRemaining = (int) body.getOrDefault("lpRemaining", 0);
            int turnsPlayed = (int) body.getOrDefault("turnsPlayed", 0);
            int damageDealt = (int) body.getOrDefault("damageDealt", 0);
            int damageReceived = (int) body.getOrDefault("damageReceived", 0);
            int requestedCoins = ((Number) body.getOrDefault("coinsEarned", 0)).intValue();
            int coinsEarned;
            if ("pvp".equals(opponentType)) {
                coinsEarned = "win".equals(result) ? 1000 : ("loss".equals(result) ? -333 : 0);
            } else if ("training".equals(opponentType)) {
                coinsEarned = 0;
            } else {
                coinsEarned = "win".equals(result) ? Math.max(0, Math.min(requestedCoins, 1000)) : 0;
            }

            return ResponseEntity.ok(duelRecordService.recordDuel(
                userId, result, opponentType, opponentName, deckUsedId,
                lpRemaining, turnsPlayed, damageDealt, damageReceived, coinsEarned
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("reason", e.getMessage()));
        }
    }

    @GetMapping("/user/{userId}/stats")
    public ResponseEntity<?> getUserDuelStats(@PathVariable Long userId) {
        try {
            return ResponseEntity.ok(duelRecordService.getUserDuelStats(userId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("reason", e.getMessage()));
        }
    }

    @GetMapping("/leaderboard")
    public ResponseEntity<?> getLeaderboard() {
        return ResponseEntity.ok(duelRecordService.getLeaderboard());
    }
}
