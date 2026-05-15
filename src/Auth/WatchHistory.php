<?php

namespace Phlex\Auth;

use Workerman\MySQL\Connection;

/**
 * Manages watch history and progress tracking per profile.
 */
class WatchHistory
{
    private Connection $db;

    /**
     * Playback status constants
     */
    public const STATUS_PLAYING = 'playing';
    public const STATUS_PAUSED = 'paused';
    public const STATUS_STOPPED = 'stopped';
    public const STATUS_COMPLETED = 'completed';

    /**
     * Progress percentage threshold for marking as completed
     */
    public const COMPLETED_THRESHOLD = 90.0;

    public function __construct(Connection $db)
    {
        $this->db = $db;
    }

    /**
     * Get watch history for a profile
     */
    public function getHistory(string $profileId, int $limit = 50, int $offset = 0): array
    {
        $results = $this->db->query(
            "SELECT wh.*, mi.name as media_name, mi.type as media_type, mi.metadata_json
             FROM watch_history wh
             JOIN media_items mi ON wh.media_item_id = mi.id
             WHERE wh.profile_id = ?
             ORDER BY wh.last_watched_at DESC
             LIMIT ? OFFSET ?",
            [$profileId, $limit, $offset]
        );

        return array_map(fn($r) => $this->hydrateEntry($r), $results);
    }

    /**
     * Get continue watching items for a profile (in progress but not completed)
     */
    public function getContinueWatching(string $profileId, int $limit = 10): array
    {
        $results = $this->db->query(
            "SELECT wh.*, mi.name as media_name, mi.type as media_type, mi.metadata_json
             FROM watch_history wh
             JOIN media_items mi ON wh.media_item_id = mi.id
             WHERE wh.profile_id = ?
               AND wh.playback_status != 'completed'
               AND wh.progress_percent > 0
               AND wh.progress_percent < ?
             ORDER BY wh.last_watched_at DESC
             LIMIT ?",
            [$profileId, self::COMPLETED_THRESHOLD, $limit]
        );

        return array_map(fn($r) => $this->hydrateEntry($r), $results);
    }

    /**
     * Get recently completed items for a profile
     */
    public function getRecentlyCompleted(string $profileId, int $limit = 20): array
    {
        $results = $this->db->query(
            "SELECT wh.*, mi.name as media_name, mi.type as media_type, mi.metadata_json
             FROM watch_history wh
             JOIN media_items mi ON wh.media_item_id = mi.id
             WHERE wh.profile_id = ?
               AND wh.playback_status = 'completed'
             ORDER BY wh.completed_at DESC
             LIMIT ?",
            [$profileId, $limit]
        );

        return array_map(fn($r) => $this->hydrateEntry($r), $results);
    }

    /**
     * Get watch history for a specific media item on a profile
     */
    public function getForMediaItem(string $profileId, string $mediaItemId): ?array
    {
        $result = $this->db->query(
            "SELECT * FROM watch_history WHERE profile_id = ? AND media_item_id = ?",
            [$profileId, $mediaItemId]
        );

        if (empty($result)) {
            return null;
        }

        return $this->hydrateEntry($result[0]);
    }

    /**
     * Update or create watch progress for a profile and media item
     */
    public function updateProgress(
        string $profileId,
        string $mediaItemId,
        int $positionTicks,
        ?int $durationTicks = null,
        string $status = self::STATUS_PLAYING
    ): array {
        // Get existing entry to calculate progress
        $existing = $this->getForMediaItem($profileId, $mediaItemId);

        $progressPercent = 0.0;
        if ($durationTicks && $durationTicks > 0) {
            $progressPercent = round(($positionTicks / $durationTicks) * 100, 2);
        }

        $completedAt = null;
        if ($progressPercent >= self::COMPLETED_THRESHOLD) {
            $status = self::STATUS_COMPLETED;
            $completedAt = date('Y-m-d H:i:s');
        }

        $now = date('Y-m-d H:i:s');

        if ($existing) {
            // Update existing entry
            $this->db->query(
                "UPDATE watch_history
                 SET position_ticks = ?,
                     duration_ticks = COALESCE(?, duration_ticks),
                     playback_status = ?,
                     progress_percent = ?,
                     last_watched_at = ?,
                     completed_at = COALESCE(?, completed_at)
                 WHERE profile_id = ? AND media_item_id = ?",
                [
                    $positionTicks,
                    $durationTicks,
                    $status,
                    $progressPercent,
                    $now,
                    $completedAt,
                    $profileId,
                    $mediaItemId,
                ]
            );
        } else {
            // Create new entry
            $id = $this->generateUuid();
            $this->db->query(
                "INSERT INTO watch_history (id, profile_id, media_item_id, position_ticks, duration_ticks, playback_status, progress_percent, last_watched_at, completed_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    $id,
                    $profileId,
                    $mediaItemId,
                    $positionTicks,
                    $durationTicks,
                    $status,
                    $progressPercent,
                    $now,
                    $completedAt,
                ]
            );
        }

        return $this->getForMediaItem($profileId, $mediaItemId);
    }

    /**
     * Mark a media item as completed for a profile
     */
    public function markCompleted(string $profileId, string $mediaItemId): array
    {
        return $this->updateProgress(
            $profileId,
            $mediaItemId,
            0,
            null,
            self::STATUS_COMPLETED
        );
    }

    /**
     * Remove a media item from watch history
     */
    public function removeFromHistory(string $profileId, string $mediaItemId): void
    {
        $this->db->query(
            "DELETE FROM watch_history WHERE profile_id = ? AND media_item_id = ?",
            [$profileId, $mediaItemId]
        );
    }

    /**
     * Clear all watch history for a profile
     */
    public function clearHistory(string $profileId): void
    {
        $this->db->query(
            "DELETE FROM watch_history WHERE profile_id = ?",
            [$profileId]
        );
    }

    /**
     * Get total watch time for a profile in seconds
     */
    public function getTotalWatchTime(string $profileId): int
    {
        $result = $this->db->query(
            "SELECT SUM(duration_ticks) as total
             FROM watch_history
             WHERE profile_id = ? AND playback_status = 'completed'",
            [$profileId]
        );

        $totalTicks = (int)($result[0]['total'] ?? 0);

        // Convert ticks to seconds (assuming 1 tick = 100 nanoseconds = 1/10 microsecond)
        // In typical media, 1 tick = 1ms, so divide by 10000 to get seconds
        return (int)($totalTicks / 10000);
    }

    /**
     * Get watch time for today for a profile
     */
    public function getTodayWatchTime(string $profileId): int
    {
        $result = $this->db->query(
            "SELECT SUM(duration_ticks) as total
             FROM watch_history
             WHERE profile_id = ?
               AND playback_status = 'completed'
               AND DATE(last_watched_at) = CURDATE()",
            [$profileId]
        );

        $totalTicks = (int)($result[0]['total'] ?? 0);

        return (int)($totalTicks / 10000);
    }

    /**
     * Get daily watch times for the past N days
     */
    public function getWatchTimeByDay(string $profileId, int $days = 7): array
    {
        $results = $this->db->query(
            "SELECT DATE(last_watched_at) as watch_date,
                    SUM(duration_ticks) as total_ticks
             FROM watch_history
             WHERE profile_id = ?
               AND playback_status = 'completed'
               AND last_watched_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
             GROUP BY DATE(last_watched_at)
             ORDER BY watch_date ASC",
            [$profileId, $days]
        );

        $data = [];
        foreach ($results as $row) {
            $data[$row['watch_date']] = (int)($row['total_ticks'] / 10000);
        }

        return $data;
    }

    /**
     * Check if a media item has been watched by a profile
     */
    public function hasWatched(string $profileId, string $mediaItemId): bool
    {
        $result = $this->db->query(
            "SELECT 1 FROM watch_history
             WHERE profile_id = ? AND media_item_id = ?
               AND playback_status = 'completed'",
            [$profileId, $mediaItemId]
        );

        return !empty($result);
    }

    /**
     * Get resume position for a media item (where to continue playback)
     */
    public function getResumePosition(string $profileId, string $mediaItemId): ?int
    {
        $entry = $this->getForMediaItem($profileId, $mediaItemId);

        if (!$entry || $entry['playback_status'] === self::STATUS_COMPLETED) {
            return null;
        }

        return (int)$entry['position_ticks'];
    }

    /**
     * Get count of items in watch history
     */
    public function getCount(string $profileId): int
    {
        $result = $this->db->query(
            "SELECT COUNT(*) as count FROM watch_history WHERE profile_id = ?",
            [$profileId]
        );

        return (int)($result[0]['count'] ?? 0);
    }

    /**
     * Hydrate a watch history entry
     */
    private function hydrateEntry(array $row): array
    {
        $entry = [
            'id' => $row['id'],
            'profile_id' => $row['profile_id'],
            'media_item_id' => $row['media_item_id'],
            'position_ticks' => (int)($row['position_ticks'] ?? 0),
            'duration_ticks' => $row['duration_ticks'] ? (int)$row['duration_ticks'] : null,
            'playback_status' => $row['playback_status'],
            'progress_percent' => (float)($row['progress_percent'] ?? 0),
            'last_watched_at' => $row['last_watched_at'],
            'created_at' => $row['created_at'] ?? null,
            'completed_at' => $row['completed_at'] ?? null,
        ];

        // Include media info if joined
        if (isset($row['media_name'])) {
            $entry['media_name'] = $row['media_name'];
            $entry['media_type'] = $row['media_type'];

            if (isset($row['metadata_json'])) {
                $metadata = is_string($row['metadata_json'])
                    ? json_decode($row['metadata_json'], true) ?? []
                    : $row['metadata_json'];
                $entry['metadata'] = $metadata;

                // Add poster/thumbnail if available
                if (isset($metadata['poster_url'])) {
                    $entry['poster_url'] = $metadata['poster_url'];
                }
                if (isset($metadata['thumbnail_url'])) {
                    $entry['thumbnail_url'] = $metadata['thumbnail_url'];
                }
            }
        }

        return $entry;
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
