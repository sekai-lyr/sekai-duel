package com.sekai.game.repository;

import com.sekai.game.entity.Card;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CardRepository extends JpaRepository<Card, String> {
    List<Card> findByType(String type);
    List<Card> findByRarity(String rarity);
    List<Card> findBySeries(String series);
    List<Card> findByAttribute(String attribute);
    List<Card> findByEnabledTrue();
    List<Card> findByTypeAndRarity(String type, String rarity);
    List<Card> findBySeriesAndEnabledTrue(String series);
    boolean existsByName(String name);
}
