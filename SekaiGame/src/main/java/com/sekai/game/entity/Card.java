package com.sekai.game.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "sekai_game_cards")
public class Card {

    public Card() {}

    public Card(String id) {
        this.id = id;
    }

    @Id
    @Column(length = 50)
    private String id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 50)
    private String series;

    @Column(length = 50)
    private String member;

    @Column(length = 30)
    private String race;

    @Column(nullable = false, length = 20)
    private String type; // monster, spell, trap

    @Column(nullable = false, length = 20)
    private String attribute; // dark, light, fire, water, earth, wind

    private Integer level;

    private Integer attack;

    private Integer defense;

    @Column(nullable = false, length = 10)
    private String rarity; // N, R, SR, SSR, UR

    private Integer cost;

    @Column(columnDefinition = "TEXT")
    private String effectsJson;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 255)
    private String image;

    @Column(nullable = false)
    private Boolean enabled = true;

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
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getSeries() { return series; }
    public void setSeries(String series) { this.series = series; }

    public String getMember() { return member; }
    public void setMember(String member) { this.member = member; }

    public String getRace() { return race; }
    public void setRace(String race) { this.race = race; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getAttribute() { return attribute; }
    public void setAttribute(String attribute) { this.attribute = attribute; }

    public Integer getLevel() { return level; }
    public void setLevel(Integer level) { this.level = level; }

    public Integer getAttack() { return attack; }
    public void setAttack(Integer attack) { this.attack = attack; }

    public Integer getDefense() { return defense; }
    public void setDefense(Integer defense) { this.defense = defense; }

    public String getRarity() { return rarity; }
    public void setRarity(String rarity) { this.rarity = rarity; }

    public Integer getCost() { return cost; }
    public void setCost(Integer cost) { this.cost = cost; }

    public String getEffectsJson() { return effectsJson; }
    public void setEffectsJson(String effectsJson) { this.effectsJson = effectsJson; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getImage() { return image; }
    public void setImage(String image) { this.image = image; }

    public Boolean getEnabled() { return enabled; }
    public void setEnabled(Boolean enabled) { this.enabled = enabled; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
