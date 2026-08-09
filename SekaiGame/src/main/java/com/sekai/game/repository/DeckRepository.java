package com.sekai.game.repository;

import com.sekai.game.entity.Deck;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DeckRepository extends JpaRepository<Deck, String> {
    List<Deck> findByUserId(Long userId);
    List<Deck> findByUserIdAndIsPreset(Long userId, Boolean isPreset);
    long countByUserId(Long userId);
}
