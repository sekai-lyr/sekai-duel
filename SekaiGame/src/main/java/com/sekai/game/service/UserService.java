package com.sekai.game.service;

import com.sekai.game.entity.Card;
import com.sekai.game.entity.User;
import com.sekai.game.entity.UserCard;
import com.sekai.game.repository.CardRepository;
import com.sekai.game.repository.UserCardRepository;
import com.sekai.game.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserCardRepository userCardRepository;

    @Autowired
    private CardRepository cardRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private StarterDeckService starterDeckService;

    @Transactional
    public User register(String username, String password, String nickname) {
        if (userRepository.existsByUsername(username)) {
            throw new RuntimeException("用户名已存在");
        }
        User user = new User();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(password));
        user.setNickname(nickname != null ? nickname : username);
        User savedUser = userRepository.save(user);

        List<Card> starterCards = cardRepository.findBySeriesAndEnabledTrue(StarterDeckService.STARTER_SERIES);
        starterDeckService.resetToStarterCollection(savedUser, starterCards);
        return savedUser;
    }

    public Optional<User> login(String username, String password) {
        Optional<User> userOpt = userRepository.findByUsername(username);
        if (userOpt.isPresent() && passwordEncoder.matches(password, userOpt.get().getPassword())) {
            User user = userOpt.get();
            user.setLastLoginAt(java.time.LocalDateTime.now());
            userRepository.save(user);
            return Optional.of(user);
        }
        return Optional.empty();
    }

    public Optional<User> getUserById(Long id) {
        return userRepository.findById(id);
    }

    public Optional<User> getUserByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    @Transactional
    public User updateUser(Long userId, Map<String, Object> updates) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("用户不存在"));

        if (updates.containsKey("nickname")) {
            user.setNickname((String) updates.get("nickname"));
        }
        if (updates.containsKey("avatar")) {
            user.setAvatar((String) updates.get("avatar"));
        }
        if (updates.containsKey("duelCoins")) {
            user.setDuelCoins((Integer) updates.get("duelCoins"));
        }
        if (updates.containsKey("selectedDeckId")) {
            user.setSelectedDeckId((String) updates.get("selectedDeckId"));
        }
        if (updates.containsKey("settingsJson")) {
            user.setSettingsJson((String) updates.get("settingsJson"));
        }

        return userRepository.save(user);
    }

    @Transactional
    public User updateDuelCoins(Long userId, int delta) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("用户不存在"));
        user.setDuelCoins(user.getDuelCoins() + delta);
        return userRepository.save(user);
    }

    public List<UserCard> getUserCards(Long userId) {
        return userCardRepository.findByUserId(userId);
    }

    @Transactional
    public UserCard addCardToUser(Long userId, String cardId, int count) {
        Optional<UserCard> existing = userCardRepository.findByUserIdAndCardId(userId, cardId);
        if (existing.isPresent()) {
            UserCard uc = existing.get();
            uc.setCount(Math.min(uc.getCount() + count, 3));
            return userCardRepository.save(uc);
        } else {
            User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("用户不存在"));
            UserCard uc = new UserCard();
            uc.setUser(user);
            uc.setCard(new Card(cardId));
            uc.setCount(Math.min(count, 3));
            return userCardRepository.save(uc);
        }
    }

    public Map<String, Object> getUserStats(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("用户不存在"));
        Map<String, Object> stats = new HashMap<>();
        stats.put("duelCoins", user.getDuelCoins());
        stats.put("packsOpened", user.getPacksOpened());
        stats.put("duelsPlayed", user.getDuelsPlayed());
        stats.put("wins", user.getWins());
        stats.put("losses", user.getLosses());
        stats.put("draws", user.getDraws());
        return stats;
    }

    public List<User> getLeaderboard() {
        return userRepository.findAll();
    }
}
