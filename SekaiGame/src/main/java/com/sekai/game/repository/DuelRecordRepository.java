package com.sekai.game.repository;

import com.sekai.game.entity.DuelRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DuelRecordRepository extends JpaRepository<DuelRecord, Long> {
    List<DuelRecord> findByUserIdOrderByCreatedAtDesc(Long userId);
    Page<DuelRecord> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    @Query("SELECT d FROM DuelRecord d WHERE d.user.id = :userId AND d.result = :result ORDER BY d.createdAt DESC")
    List<DuelRecord> findByUserIdAndResult(@Param("userId") Long userId, @Param("result") String result);

    @Query("SELECT COUNT(d) FROM DuelRecord d WHERE d.user.id = :userId AND d.result = 'win'")
    long countWinsByUserId(@Param("userId") Long userId);

    @Query("SELECT d.user.id, COUNT(d) as winCount FROM DuelRecord d WHERE d.result = 'win' GROUP BY d.user.id ORDER BY winCount DESC")
    List<Object[]> findTopWinners(Pageable pageable);
}
