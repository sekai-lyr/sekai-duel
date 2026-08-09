-- ============================================
-- Sekai Friend - 数据库建表脚本
-- 数据库: sekai_friend
-- 表名前缀: sekai_card_
-- ============================================

-- 1. 卡牌表
CREATE TABLE IF NOT EXISTS `sekai_card_cards` (
    `id` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `series` VARCHAR(50) DEFAULT NULL,
    `member` VARCHAR(50) DEFAULT NULL,
    `type` VARCHAR(20) NOT NULL COMMENT 'monster/spell/trap',
    `attribute` VARCHAR(20) NOT NULL COMMENT 'dark/light/fire/water/earth/wind',
    `level` INT DEFAULT 0,
    `attack` INT DEFAULT 0,
    `defense` INT DEFAULT 0,
    `rarity` VARCHAR(10) NOT NULL COMMENT 'N/R/SR/SSR/UR',
    `cost` INT DEFAULT 0,
    `effects_json` TEXT DEFAULT NULL,
    `description` TEXT DEFAULT NULL,
    `image` VARCHAR(255) DEFAULT NULL,
    `enabled` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_cards_type` (`type`),
    INDEX `idx_cards_rarity` (`rarity`),
    INDEX `idx_cards_series` (`series`),
    INDEX `idx_cards_attribute` (`attribute`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. 用户表
CREATE TABLE IF NOT EXISTS `sekai_card_users` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(50) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `nickname` VARCHAR(100) DEFAULT NULL,
    `avatar` VARCHAR(255) DEFAULT NULL,
    `duel_coins` INT NOT NULL DEFAULT 2000,
    `shards_json` TEXT DEFAULT NULL,
    `packs_opened` INT DEFAULT 0,
    `duels_played` INT DEFAULT 0,
    `wins` INT DEFAULT 0,
    `losses` INT DEFAULT 0,
    `draws` INT DEFAULT 0,
    `selected_deck_id` VARCHAR(50) DEFAULT NULL,
    `settings_json` TEXT DEFAULT NULL,
    `last_login_at` DATETIME DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 用户拥有的卡牌
CREATE TABLE IF NOT EXISTS `sekai_card_user_cards` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `card_id` VARCHAR(50) NOT NULL,
    `count` INT NOT NULL DEFAULT 1,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_user_card` (`user_id`, `card_id`),
    INDEX `idx_user_cards_user` (`user_id`),
    INDEX `idx_user_cards_card` (`card_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. 卡组表
CREATE TABLE IF NOT EXISTS `sekai_card_decks` (
    `id` VARCHAR(50) NOT NULL,
    `user_id` BIGINT NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `cover_card_id` VARCHAR(50) DEFAULT NULL,
    `description` VARCHAR(500) DEFAULT NULL,
    `difficulty` VARCHAR(20) DEFAULT NULL,
    `strategy` VARCHAR(20) DEFAULT NULL,
    `is_preset` TINYINT(1) DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_decks_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. 卡组中的卡牌
CREATE TABLE IF NOT EXISTS `sekai_card_deck_cards` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `deck_id` VARCHAR(50) NOT NULL,
    `card_id` VARCHAR(50) NOT NULL,
    `slot_type` VARCHAR(20) NOT NULL COMMENT 'main/extra/side',
    `position` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    INDEX `idx_deck_cards_deck` (`deck_id`),
    INDEX `idx_deck_cards_slot` (`deck_id`, `slot_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. 对局记录
CREATE TABLE IF NOT EXISTS `sekai_card_duel_records` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `result` VARCHAR(20) NOT NULL COMMENT 'win/loss/draw',
    `opponent_type` VARCHAR(20) DEFAULT 'ai' COMMENT 'ai/player',
    `opponent_name` VARCHAR(50) DEFAULT NULL,
    `deck_used_id` VARCHAR(50) DEFAULT NULL,
    `lp_remaining` INT DEFAULT 0,
    `turns_played` INT DEFAULT 0,
    `damage_dealt` INT DEFAULT 0,
    `damage_received` INT DEFAULT 0,
    `coins_earned` INT DEFAULT 0,
    `duration_seconds` INT DEFAULT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_duel_records_user` (`user_id`),
    INDEX `idx_duel_records_result` (`result`),
    INDEX `idx_duel_records_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
