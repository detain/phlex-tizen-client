<?php

namespace Phlex\Auth;

use Workerman\MySQL\Connection;

/**
 * Manages user profiles with support for multiple profiles per account.
 * Handles profile creation, switching, deletion, and profile-specific settings.
 */
class UserProfileManager
{
    private Connection $db;

    /**
     * Content ratings in order of restrictiveness (least to most restrictive)
     */
    public const RATING_ORDER = [
        'G' => 1,
        'PG' => 2,
        'PG-13' => 3,
        'R' => 4,
        'NC-17' => 5,
        'X' => 6,
        'UNRATED' => 7,
    ];

    public const MAX_PROFILES_PER_USER = 5;

    public function __construct(Connection $db)
    {
        $this->db = $db;
    }

    /**
     * Find a profile by ID
     */
    public function findById(string $profileId): ?array
    {
        $result = $this->db->query(
            "SELECT * FROM user_profiles WHERE id = ?",
            [$profileId]
        );
        return $result[0] ?? null;
    }

    /**
     * Find a profile by ID with settings
     */
    public function findByIdWithSettings(string $profileId): ?array
    {
        $result = $this->db->query(
            "SELECT p.*, ps.content_rating, ps.pin_hash, ps.pin_required_for_admin,
                    ps.max_daily_watch_time, ps.allowed_genres, ps.blocked_genres, ps.allow_unrated
             FROM user_profiles p
             LEFT JOIN profile_settings ps ON p.id = ps.profile_id
             WHERE p.id = ?",
            [$profileId]
        );

        if (empty($result)) {
            return null;
        }

        return $this->hydrateProfile($result[0]);
    }

    /**
     * Get all profiles for a user
     */
    public function findByUserId(string $userId): array
    {
        $results = $this->db->query(
            "SELECT p.*, ps.content_rating
             FROM user_profiles p
             LEFT JOIN profile_settings ps ON p.id = ps.profile_id
             WHERE p.user_id = ?
             ORDER BY p.is_active DESC, p.name ASC",
            [$userId]
        );

        return array_map(fn($r) => $this->hydrateProfile($r), $results);
    }

    /**
     * Get the active profile for a user
     */
    public function getActiveProfile(string $userId): ?array
    {
        $result = $this->db->query(
            "SELECT p.*, ps.content_rating
             FROM user_profiles p
             LEFT JOIN profile_settings ps ON p.id = ps.profile_id
             WHERE p.user_id = ? AND p.is_active = TRUE
             LIMIT 1",
            [$userId]
        );

        if (empty($result)) {
            return null;
        }

        return $this->hydrateProfile($result[0]);
    }

    /**
     * Create a new profile for a user
     */
    public function create(string $userId, array $data): string
    {
        // Check max profiles limit
        $existingCount = $this->db->query(
            "SELECT COUNT(*) as count FROM user_profiles WHERE user_id = ?",
            [$userId]
        );

        if (($existingCount[0]['count'] ?? 0) >= self::MAX_PROFILES_PER_USER) {
            throw new \InvalidArgumentException(
                'Maximum number of profiles (' . self::MAX_PROFILES_PER_USER . ') reached'
            );
        }

        // Validate name
        $name = trim($data['name'] ?? '');
        if (strlen($name) < 1 || strlen($name) > 100) {
            throw new \InvalidArgumentException('Profile name must be 1-100 characters');
        }

        $id = $this->generateUuid();
        $isAdmin = $data['is_admin'] ?? false;

        $this->db->query(
            "INSERT INTO user_profiles (id, user_id, name, avatar_url, is_active, is_admin)
             VALUES (?, ?, ?, ?, ?, ?)",
            [
                $id,
                $userId,
                $name,
                $data['avatar_url'] ?? null,
                $data['is_active'] ?? false,
                $isAdmin,
            ]
        );

        // Create default settings for the profile
        $this->createProfileSettings($id, [
            'content_rating' => $data['content_rating'] ?? 'R',
            'pin_hash' => isset($data['pin']) ? password_hash($data['pin'], PASSWORD_ARGON2ID) : null,
            'pin_required_for_admin' => $data['pin_required_for_admin'] ?? false,
            'max_daily_watch_time' => $data['max_daily_watch_time'] ?? 0,
            'allowed_genres' => $data['allowed_genres'] ?? null,
            'blocked_genres' => $data['blocked_genres'] ?? null,
            'allow_unrated' => $data['allow_unrated'] ?? true,
        ]);

        return $id;
    }

    /**
     * Update a profile
     */
    public function update(string $profileId, array $data): void
    {
        $profile = $this->findById($profileId);
        if (!$profile) {
            throw new \InvalidArgumentException('Profile not found');
        }

        $sets = [];
        $values = [];

        if (isset($data['name'])) {
            $name = trim($data['name']);
            if (strlen($name) < 1 || strlen($name) > 100) {
                throw new \InvalidArgumentException('Profile name must be 1-100 characters');
            }
            $sets[] = 'name = ?';
            $values[] = $name;
        }

        if (array_key_exists('avatar_url', $data)) {
            $sets[] = 'avatar_url = ?';
            $values[] = $data['avatar_url'];
        }

        if (isset($data['is_active'])) {
            $sets[] = 'is_active = ?';
            $values[] = (bool)$data['is_active'];
        }

        if (!empty($sets)) {
            $values[] = $profileId;
            $this->db->query(
                "UPDATE user_profiles SET " . implode(', ', $sets) . " WHERE id = ?",
                $values
            );
        }

        // Update settings if provided
        if (isset($data['content_rating']) || isset($data['pin']) || isset($data['pin_required_for_admin'])
            || isset($data['max_daily_watch_time']) || isset($data['allowed_genres'])
            || isset($data['blocked_genres']) || isset($data['allow_unrated'])) {
            $this->updateProfileSettings($profileId, $data);
        }
    }

    /**
     * Switch the active profile for a user
     */
    public function switchProfile(string $userId, string $profileId): bool
    {
        // Verify profile belongs to user
        $profile = $this->findById($profileId);
        if (!$profile || $profile['user_id'] !== $userId) {
            return false;
        }

        $this->db->query(
            "UPDATE user_profiles SET is_active = FALSE WHERE user_id = ?",
            [$userId]
        );

        $this->db->query(
            "UPDATE user_profiles SET is_active = TRUE WHERE id = ?",
            [$profileId]
        );

        return true;
    }

    /**
     * Delete a profile
     */
    public function delete(string $profileId): void
    {
        $profile = $this->findById($profileId);
        if (!$profile) {
            throw new \InvalidArgumentException('Profile not found');
        }

        $this->db->query("DELETE FROM user_profiles WHERE id = ?", [$profileId]);
    }

    /**
     * Verify a profile PIN
     */
    public function verifyPin(string $profileId, string $pin): bool
    {
        $result = $this->db->query(
            "SELECT pin_hash FROM profile_settings WHERE profile_id = ?",
            [$profileId]
        );

        if (empty($result) || empty($result[0]['pin_hash'])) {
            return true; // No PIN set, allow access
        }

        return password_verify($pin, $result[0]['pin_hash']);
    }

    /**
     * Set or update a profile PIN
     */
    public function setPin(string $profileId, string $pin): void
    {
        if (strlen($pin) !== 4 && strlen($pin) !== 6) {
            throw new \InvalidArgumentException('PIN must be 4 or 6 digits');
        }

        if (!ctype_digit($pin)) {
            throw new \InvalidArgumentException('PIN must contain only digits');
        }

        $pinHash = password_hash($pin, PASSWORD_ARGON2ID);

        $this->db->query(
            "UPDATE profile_settings SET pin_hash = ? WHERE profile_id = ?",
            [$pinHash, $profileId]
        );
    }

    /**
     * Remove a profile PIN
     */
    public function removePin(string $profileId): void
    {
        $this->db->query(
            "UPDATE profile_settings SET pin_hash = NULL WHERE profile_id = ?",
            [$profileId]
        );
    }

    /**
     * Check if content rating is allowed for a profile
     */
    public function isContentRatingAllowed(string $profileId, string $contentRating): bool
    {
        $result = $this->db->query(
            "SELECT content_rating, allow_unrated FROM profile_settings WHERE profile_id = ?",
            [$profileId]
        );

        if (empty($result)) {
            return true; // No settings, allow all
        }

        $settings = $result[0];

        // Unrated content check
        if ($contentRating === 'UNRATED') {
            return (bool)$settings['allow_unrated'];
        }

        // Check rating order
        $profileRating = $settings['content_rating'] ?? 'R';
        $profileRatingLevel = self::RATING_ORDER[$profileRating] ?? 4;
        $contentRatingLevel = self::RATING_ORDER[$contentRating] ?? 4;

        return $contentRatingLevel <= $profileRatingLevel;
    }

    /**
     * Get allowed content ratings for a profile
     */
    public function getAllowedRatings(string $profileId): array
    {
        $result = $this->db->query(
            "SELECT content_rating, allow_unrated FROM profile_settings WHERE profile_id = ?",
            [$profileId]
        );

        if (empty($result)) {
            return ['G', 'PG', 'PG-13', 'R', 'NC-17', 'X', 'UNRATED'];
        }

        $settings = $result[0];
        $maxRating = $settings['content_rating'] ?? 'R';
        $maxLevel = self::RATING_ORDER[$maxRating] ?? 4;

        $allowed = [];
        foreach (self::RATING_ORDER as $rating => $level) {
            if ($level <= $maxLevel) {
                $allowed[] = $rating;
            }
        }

        if ($settings['allow_unrated']) {
            $allowed[] = 'UNRATED';
        }

        return $allowed;
    }

    /**
     * Create default profile settings
     */
    private function createProfileSettings(string $profileId, array $data): void
    {
        $id = $this->generateUuid();

        $this->db->query(
            "INSERT INTO profile_settings (id, profile_id, content_rating, pin_hash, pin_required_for_admin,
             max_daily_watch_time, allowed_genres, blocked_genres, allow_unrated)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                $id,
                $profileId,
                $data['content_rating'] ?? 'R',
                $data['pin_hash'] ?? null,
                $data['pin_required_for_admin'] ?? false,
                $data['max_daily_watch_time'] ?? 0,
                isset($data['allowed_genres']) ? json_encode($data['allowed_genres']) : null,
                isset($data['blocked_genres']) ? json_encode($data['blocked_genres']) : null,
                $data['allow_unrated'] ?? true,
            ]
        );
    }

    /**
     * Update profile settings
     */
    private function updateProfileSettings(string $profileId, array $data): void
    {
        $sets = [];
        $values = [];

        if (isset($data['content_rating'])) {
            $sets[] = 'content_rating = ?';
            $values[] = $data['content_rating'];
        }

        if (isset($data['pin'])) {
            $sets[] = 'pin_hash = ?';
            $values[] = password_hash($data['pin'], PASSWORD_ARGON2ID);
        }

        if (isset($data['pin_required_for_admin'])) {
            $sets[] = 'pin_required_for_admin = ?';
            $values[] = (bool)$data['pin_required_for_admin'];
        }

        if (isset($data['max_daily_watch_time'])) {
            $sets[] = 'max_daily_watch_time = ?';
            $values[] = (int)$data['max_daily_watch_time'];
        }

        if (isset($data['allowed_genres'])) {
            $sets[] = 'allowed_genres = ?';
            $values[] = json_encode($data['allowed_genres']);
        }

        if (isset($data['blocked_genres'])) {
            $sets[] = 'blocked_genres = ?';
            $values[] = json_encode($data['blocked_genres']);
        }

        if (isset($data['allow_unrated'])) {
            $sets[] = 'allow_unrated = ?';
            $values[] = (bool)$data['allow_unrated'];
        }

        if (empty($sets)) {
            return;
        }

        $values[] = $profileId;
        $this->db->query(
            "UPDATE profile_settings SET " . implode(', ', $sets) . " WHERE profile_id = ?",
            $values
        );
    }

    /**
     * Hydrate a profile row with parsed settings
     */
    private function hydrateProfile(array $row): array
    {
        $profile = [
            'id' => $row['id'],
            'user_id' => $row['user_id'],
            'name' => $row['name'],
            'avatar_url' => $row['avatar_url'],
            'is_active' => (bool)$row['is_active'],
            'is_admin' => (bool)$row['is_admin'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];

        // Settings
        if (isset($row['content_rating'])) {
            $profile['settings'] = [
                'content_rating' => $row['content_rating'],
                'pin_required_for_admin' => (bool)($row['pin_required_for_admin'] ?? false),
                'max_daily_watch_time' => (int)($row['max_daily_watch_time'] ?? 0),
                'allow_unrated' => (bool)($row['allow_unrated'] ?? true),
            ];

            if (isset($row['allowed_genres']) && $row['allowed_genres']) {
                $profile['settings']['allowed_genres'] = json_decode($row['allowed_genres'], true);
            }

            if (isset($row['blocked_genres']) && $row['blocked_genres']) {
                $profile['settings']['blocked_genres'] = json_decode($row['blocked_genres'], true);
            }
        }

        return $profile;
    }

    /**
     * Generate a UUID v4
     */
    private function generateUuid(): string
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }
}
