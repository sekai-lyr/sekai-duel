package com.sekai.game.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "sekai_game_duel_records")
public class DuelRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 20)
    private String result; // win, loss, draw

    @Column(length = 20)
    private String opponentType; // ai, player

    @Column(length = 50)
    private String opponentName;

    @Column(length = 50)
    private String deckUsedId;

    private Integer lpRemaining;

    private Integer turnsPlayed;

    private Integer damageDealt;

    private Integer damageReceived;

    private Integer coinsEarned;

    private Integer durationSeconds;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getResult() { return result; }
    public void setResult(String result) { this.result = result; }

    public String getOpponentType() { return opponentType; }
    public void setOpponentType(String opponentType) { this.opponentType = opponentType; }

    public String getOpponentName() { return opponentName; }
    public void setOpponentName(String opponentName) { this.opponentName = opponentName; }

    public String getDeckUsedId() { return deckUsedId; }
    public void setDeckUsedId(String deckUsedId) { this.deckUsedId = deckUsedId; }

    public Integer getLpRemaining() { return lpRemaining; }
    public void setLpRemaining(Integer lpRemaining) { this.lpRemaining = lpRemaining; }

    public Integer getTurnsPlayed() { return turnsPlayed; }
    public void setTurnsPlayed(Integer turnsPlayed) { this.turnsPlayed = turnsPlayed; }

    public Integer getDamageDealt() { return damageDealt; }
    public void setDamageDealt(Integer damageDealt) { this.damageDealt = damageDealt; }

    public Integer getDamageReceived() { return damageReceived; }
    public void setDamageReceived(Integer damageReceived) { this.damageReceived = damageReceived; }

    public Integer getCoinsEarned() { return coinsEarned; }
    public void setCoinsEarned(Integer coinsEarned) { this.coinsEarned = coinsEarned; }

    public Integer getDurationSeconds() { return durationSeconds; }
    public void setDurationSeconds(Integer durationSeconds) { this.durationSeconds = durationSeconds; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
