package com.sekai.game.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "sekai_game_users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false)
    private String password;

    @Column(length = 100)
    private String nickname;

    @Column(length = 255)
    private String avatar;

    private Integer duelCoins = 2000;

    @Column(columnDefinition = "JSON")
    private String shardsJson = "{\"N\":0,\"R\":0,\"SR\":0,\"SSR\":0,\"UR\":0}";

    @Column(columnDefinition = "JSON")
    private String pityCountersJson = "{}";

    private Integer packsOpened = 0;
    private Integer duelsPlayed = 0;
    private Integer wins = 0;
    private Integer losses = 0;
    private Integer draws = 0;
    private Integer collectionVersion = 0;

    @Column(length = 50)
    private String selectedDeckId;

    @Column(columnDefinition = "JSON")
    private String settingsJson;

    private LocalDateTime lastLoginAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }

    public String getAvatar() { return avatar; }
    public void setAvatar(String avatar) { this.avatar = avatar; }

    public Integer getDuelCoins() { return duelCoins; }
    public void setDuelCoins(Integer duelCoins) { this.duelCoins = duelCoins; }

    public String getShardsJson() { return shardsJson; }
    public void setShardsJson(String shardsJson) { this.shardsJson = shardsJson; }
    public String getPityCountersJson() { return pityCountersJson; }
    public void setPityCountersJson(String pityCountersJson) { this.pityCountersJson = pityCountersJson; }

    public Integer getPacksOpened() { return packsOpened; }
    public void setPacksOpened(Integer packsOpened) { this.packsOpened = packsOpened; }

    public Integer getDuelsPlayed() { return duelsPlayed; }
    public void setDuelsPlayed(Integer duelsPlayed) { this.duelsPlayed = duelsPlayed; }

    public Integer getWins() { return wins; }
    public void setWins(Integer wins) { this.wins = wins; }

    public Integer getLosses() { return losses; }
    public void setLosses(Integer losses) { this.losses = losses; }

    public Integer getDraws() { return draws; }
    public void setDraws(Integer draws) { this.draws = draws; }
    public Integer getCollectionVersion() { return collectionVersion; }
    public void setCollectionVersion(Integer collectionVersion) { this.collectionVersion = collectionVersion; }

    public String getSelectedDeckId() { return selectedDeckId; }
    public void setSelectedDeckId(String selectedDeckId) { this.selectedDeckId = selectedDeckId; }

    public String getSettingsJson() { return settingsJson; }
    public void setSettingsJson(String settingsJson) { this.settingsJson = settingsJson; }

    public LocalDateTime getLastLoginAt() { return lastLoginAt; }
    public void setLastLoginAt(LocalDateTime lastLoginAt) { this.lastLoginAt = lastLoginAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
