package com.sekai.game.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "sekai_game_user_cards", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"user_id", "card_id"})
})
public class UserCard {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "card_id", nullable = false)
    private Card card;

    @Column(nullable = false)
    private Integer count = 1;

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public Card getCard() { return card; }
    public void setCard(Card card) { this.card = card; }

    public Integer getCount() { return count; }
    public void setCount(Integer count) { this.count = count; }
}
