package com.sekai.game.service;

import com.sekai.game.entity.DuelRecord;
import com.sekai.game.entity.User;
import com.sekai.game.repository.DuelRecordRepository;
import com.sekai.game.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class DuelRecordService {

    @Autowired
    private DuelRecordRepository duelRecordRepository;

    @Autowired
    private UserRepository userRepository;

    public List<DuelRecord> getUserRecords(Long userId) {
        return duelRecordRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Transactional
    public DuelRecord recordDuel(Long userId, String result, String opponentType,
                                  String opponentName, String deckUsedId,
                                  int lpRemaining, int turnsPlayed,
                                  int damageDealt, int damageReceived, int coinsEarned) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("用户不存在"));

        DuelRecord record = new DuelRecord();
        record.setUser(user);
        record.setResult(result);
        record.setOpponentType(opponentType);
        record.setOpponentName(opponentName);
        record.setDeckUsedId(deckUsedId);
        record.setLpRemaining(lpRemaining);
        record.setTurnsPlayed(turnsPlayed);
        record.setDamageDealt(damageDealt);
        record.setDamageReceived(damageReceived);
        record.setCoinsEarned(coinsEarned);

        user.setDuelsPlayed(user.getDuelsPlayed() + 1);
        if ("win".equals(result)) {
            user.setWins(user.getWins() + 1);
        } else if ("loss".equals(result)) {
            user.setLosses(user.getLosses() + 1);
        } else {
            user.setDraws(user.getDraws() + 1);
        }
        user.setDuelCoins(Math.max(0, user.getDuelCoins() + coinsEarned));
        userRepository.save(user);

        return duelRecordRepository.save(record);
    }

    public Map<String, Object> getUserDuelStats(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("用户不存在"));

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalDuels", user.getDuelsPlayed());
        stats.put("wins", user.getWins());
        stats.put("losses", user.getLosses());
        stats.put("draws", user.getDraws());
        stats.put("winRate", user.getDuelsPlayed() > 0
            ? (double) user.getWins() / user.getDuelsPlayed() * 100
            : 0);
        return stats;
    }

    public List<Object[]> getLeaderboard() {
        return duelRecordRepository.findTopWinners(PageRequest.of(0, 10));
    }
}
