-- Phase 7: User Management & Parental Controls
-- Migration: Add user profiles, parental controls, and watch history

-- User profiles table (multiple profiles per account)
CREATE TABLE IF NOT EXISTS user_profiles (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Profile settings table (parental controls per profile)
CREATE TABLE IF NOT EXISTS profile_settings (
    id CHAR(36) PRIMARY KEY,
    profile_id CHAR(36) NOT NULL UNIQUE,
    content_rating ENUM('G', 'PG', 'PG-13', 'R', 'NC-17', 'X', 'UNRATED') DEFAULT 'R',
    pin_hash VARCHAR(255),
    pin_required_for_admin BOOLEAN DEFAULT FALSE,
    max_daily_watch_time INT DEFAULT 0,
    allowed_genres JSON,
    blocked_genres JSON,
    allow_unrated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES user_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Watch history per profile
CREATE TABLE IF NOT EXISTS watch_history (
    id CHAR(36) PRIMARY KEY,
    profile_id CHAR(36) NOT NULL,
    media_item_id CHAR(36) NOT NULL,
    position_ticks BIGINT DEFAULT 0,
    duration_ticks BIGINT,
    playback_status ENUM('playing', 'paused', 'stopped', 'completed') DEFAULT 'stopped',
    progress_percent DECIMAL(5,2) DEFAULT 0.00,
    last_watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (profile_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (media_item_id) REFERENCES media_items(id) ON DELETE CASCADE,
    INDEX idx_profile (profile_id),
    INDEX idx_media_item (media_item_id),
    INDEX idx_last_watched (last_watched_at),
    UNIQUE INDEX idx_profile_media (profile_id, media_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add profile_id to sessions for multi-profile support
ALTER TABLE sessions ADD COLUMN profile_id CHAR(36) NULL AFTER user_id;

-- Add rating to user_settings for default preferences
ALTER TABLE user_settings ADD COLUMN default_content_rating ENUM('G', 'PG', 'PG-13', 'R', 'NC-17', 'X', 'UNRATED') DEFAULT 'R' AFTER subtitle_mode;
