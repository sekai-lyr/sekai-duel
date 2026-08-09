package com.sekai.game.repository;

import com.sekai.game.entity.UserCard;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserCardRepository extends JpaRepository<UserCard, Long> {
    List<UserCard> findByUserId(Long userId);
    Optional<UserCard> findByUserIdAndCardId(Long userId, String cardId);
    boolean existsByUserIdAndCardId(Long userId, String cardId);

    @Modifying
    @Transactional
    void deleteByCardId(String cardId);

    @Modifying
    @Transactional
    void deleteByUserId(Long userId);
}
