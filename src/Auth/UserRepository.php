<?php

namespace Phlex\Auth;

use Workerman\MySQL\Connection;

class UserRepository
{
    private Connection $db;

    public function __construct(Connection $db)
    {
        $this->db = $db;
    }

    public function findById(string $id): ?array
    {
        $result = $this->db->query("SELECT * FROM users WHERE id = ?", [$id]);
        return $result[0] ?? null;
    }

    public function findByUsername(string $username): ?array
    {
        $result = $this->db->query(
            "SELECT * FROM users WHERE username = ?",
            [$username]
        );
        return $result[0] ?? null;
    }

    public function findByEmail(string $email): ?array
    {
        $result = $this->db->query(
            "SELECT * FROM users WHERE email = ?",
            [$email]
        );
        return $result[0] ?? null;
    }

    public function create(array $data): string
    {
        $id = $this->generateUuid();
        $passwordHash = password_hash($data['password'], PASSWORD_ARGON2ID);

        $this->db->query(
            "INSERT INTO users (id, username, email, password_hash, display_name) VALUES (?, ?, ?, ?, ?)",
            [
                $id,
                $data['username'],
                $data['email'],
                $passwordHash,
                $data['display_name'] ?? $data['username'],
            ]
        );

        // Create default settings
        $this->db->query(
            "INSERT INTO user_settings (user_id) VALUES (?)",
            [$id]
        );

        return $id;
    }

    public function update(string $id, array $data): void
    {
        $sets = [];
        $values = [];

        if (isset($data['display_name'])) {
            $sets[] = 'display_name = ?';
            $values[] = $data['display_name'];
        }

        if (isset($data['email'])) {
            $sets[] = 'email = ?';
            $values[] = $data['email'];
        }

        if (isset($data['password'])) {
            $sets[] = 'password_hash = ?';
            $values[] = password_hash($data['password'], PASSWORD_ARGON2ID);
        }

        if (empty($sets)) {
            return;
        }

        $values[] = $id;
        $this->db->query(
            "UPDATE users SET " . implode(', ', $sets) . " WHERE id = ?",
            $values
        );
    }

    public function updateLastLogin(string $id): void
    {
        $this->db->query("UPDATE users SET last_login = NOW() WHERE id = ?", [$id]);
    }

    /**
     * Get user settings including profile-related settings
     */
    public function getSettings(string $userId): ?array
    {
        $result = $this->db->query(
            "SELECT * FROM user_settings WHERE user_id = ?",
            [$userId]
        );

        if (empty($result)) {
            return null;
        }

        $settings = $result[0];

        // Parse JSON fields if present
        if (isset($settings['transcoding_preferences'])) {
            $settings['transcoding_preferences'] = json_decode(
                $settings['transcoding_preferences'],
                true
            ) ?? [];
        }

        return $settings;
    }

    /**
     * Update user settings
     */
    public function updateSettings(string $userId, array $settings): void
    {
        $sets = [];
        $values = [];

        $allowedFields = [
            'max_streams',
            'max_bitrate',
            'preferred_audio_language',
            'preferred_subtitle_language',
            'subtitle_mode',
            'default_content_rating',
        ];

        foreach ($allowedFields as $field) {
            if (isset($settings[$field])) {
                $sets[] = "{$field} = ?";
                $values[] = $settings[$field];
            }
        }

        if (isset($settings['transcoding_preferences']) && is_array($settings['transcoding_preferences'])) {
            $sets[] = 'transcoding_preferences = ?';
            $values[] = json_encode($settings['transcoding_preferences']);
        }

        if (empty($sets)) {
            return;
        }

        $values[] = $userId;

        // Check if settings row exists
        $existing = $this->db->query(
            "SELECT 1 FROM user_settings WHERE user_id = ?",
            [$userId]
        );

        if (empty($existing)) {
            // Create settings row
            $this->db->query(
                "INSERT INTO user_settings (user_id, " . implode(', ', $sets) . ") VALUES (?" . str_repeat(', ?', count($sets)) . ")",
                array_merge([$userId], $values)
            );
        } else {
            $this->db->query(
                "UPDATE user_settings SET " . implode(', ', $sets) . " WHERE user_id = ?",
                $values
            );
        }
    }

    /**
     * Update user avatar
     */
    public function updateAvatar(string $userId, string $avatarUrl): void
    {
        $this->db->query(
            "UPDATE users SET avatar_url = ? WHERE id = ?",
            [$avatarUrl, $userId]
        );
    }

    /**
     * Get user avatar URL
     */
    public function getAvatar(string $userId): ?string
    {
        $result = $this->db->query(
            "SELECT avatar_url FROM users WHERE id = ?",
            [$userId]
        );

        return $result[0]['avatar_url'] ?? null;
    }

    public function verifyPassword(string $id, string $password): bool
    {
        $user = $this->findById($id);
        if (!$user) {
            return false;
        }

        return password_verify($password, $user['password_hash']);
    }

    public function emailExists(string $email): bool
    {
        $result = $this->db->query(
            "SELECT 1 FROM users WHERE email = ?",
            [$email]
        );
        return !empty($result);
    }

    public function usernameExists(string $username): bool
    {
        $result = $this->db->query(
            "SELECT 1 FROM users WHERE username = ?",
            [$username]
        );
        return !empty($result);
    }

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