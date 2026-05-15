<?php

namespace Phlex\Media\Streaming;

use Phlex\Common\Logger\LogChannels;
use Phlex\Common\Logger\LoggerFactory;
use Phlex\Common\Logger\StructuredLogger;
use Phlex\Media\Library\ItemRepository;
use Workerman\MySQL\Connection;

class StreamManager
{
    private array $activeStreams = [];
    private Connection $db;
    private ItemRepository $itemRepository;
    private QualitySelector $qualitySelector;
    private StructuredLogger $logger;

    public function __construct(
        Connection $db,
        ItemRepository $itemRepository,
        QualitySelector $qualitySelector
    ) {
        $this->db = $db;
        $this->itemRepository = $itemRepository;
        $this->qualitySelector = $qualitySelector;
        $this->logger = LoggerFactory::get(LogChannels::STREAMING);
    }

    public function createStream(
        string $mediaItemId,
        string $sessionId,
        string $userId,
        array $options = []
    ): StreamState {
        $item = $this->itemRepository->findById($mediaItemId);
        if (!$item) {
            throw new \InvalidArgumentException("Media item not found: $mediaItemId");
        }

        $state = new StreamState();
        $state->id = $this->generateUuid();
        $state->mediaItemId = $mediaItemId;
        $state->sessionId = $sessionId;
        $state->userId = $userId;
        $state->durationTicks = $item['metadata']['runtime_ticks'] ?? 0;

        // Get device profile
        $profileName = $options['device_profile'] ?? 'generic';
        
        // Probe source file
        $sourceInfo = $this->probeMedia($item['path']);
        
        // Select quality
        $quality = $this->qualitySelector->selectQuality($sourceInfo, $profileName, $options);
        $state->playMethod = $quality['method'];

        if ($quality['method'] === 'direct') {
            $state->directStreamUrl = $this->buildDirectStreamUrl($mediaItemId);
        } else {
            // Transcode will be started by TranscodeManager
            $state->transcodeJobId = $options['transcode_job_id'] ?? null;
        }

        $this->activeStreams[$state->id] = $state;
        
        // Persist to database
        $this->persistStreamState($state);
        
        $this->logger->info('Stream created', [
            'stream_id' => $state->id,
            'media_item_id' => $mediaItemId,
            'method' => $quality['method'],
        ]);

        return $state;
    }

    public function getStream(string $streamId): ?StreamState
    {
        return $this->activeStreams[$streamId] ?? null;
    }

    public function getStreamBySession(string $sessionId): ?StreamState
    {
        foreach ($this->activeStreams as $stream) {
            if ($stream->sessionId === $sessionId) {
                return $stream;
            }
        }
        return null;
    }

    public function updatePosition(string $streamId, int $positionTicks): void
    {
        $stream = $this->getStream($streamId);
        if (!$stream) {
            return;
        }

        $stream->positionTicks = $positionTicks;
        
        // Persist periodically (could add debouncing)
        $this->persistPlaybackState($stream);
    }

    public function play(string $streamId): void
    {
        $stream = $this->getStream($streamId);
        if (!$stream) {
            return;
        }

        $stream->play();
        $this->logger->debug('Stream playing', ['stream_id' => $streamId]);
    }

    public function pause(string $streamId): void
    {
        $stream = $this->getStream($streamId);
        if (!$stream) {
            return;
        }

        $stream->pause();
        $this->logger->debug('Stream paused', ['stream_id' => $streamId]);
    }

    public function stop(string $streamId): void
    {
        $stream = $this->getStream($streamId);
        if (!$stream) {
            return;
        }

        $stream->stop();
        $this->persistPlaybackState($stream);
        unset($this->activeStreams[$streamId]);
        
        $this->logger->info('Stream stopped', ['stream_id' => $streamId]);
    }

    public function seek(string $streamId, int $positionTicks): void
    {
        $stream = $this->getStream($streamId);
        if (!$stream) {
            return;
        }

        $stream->seek($positionTicks);
        $this->logger->debug('Stream seeked', [
            'stream_id' => $streamId,
            'position_ticks' => $positionTicks,
        ]);
    }

    public function getActiveStreams(): array
    {
        return array_values($this->activeStreams);
    }

    public function getActiveStreamCount(): int
    {
        return count($this->activeStreams);
    }

    private function probeMedia(string $path): array
    {
        // Simplified - would use FFprobe in real implementation
        return [
            'streams' => [
                ['codec_type' => 'video', 'codec' => 'h264', 'width' => 1920, 'height' => 1080, 'bitrate' => 5000000],
                ['codec_type' => 'audio', 'codec' => 'aac', 'channels' => 2],
            ],
            'format' => ['format_name' => 'mov,mp4,m4a,3gp,3g2,mj2'],
        ];
    }

    private function buildDirectStreamUrl(string $mediaItemId): string
    {
        return "/media/$mediaItemId/stream";
    }

    private function persistStreamState(StreamState $state): void
    {
        $this->db->query(
            "INSERT INTO playback_state (id, session_id, media_item_id, position_ticks, duration_ticks, playback_status)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE position_ticks = VALUES(position_ticks), playback_status = VALUES(playback_status)",
            [$state->id, $state->sessionId, $state->mediaItemId, $state->positionTicks, $state->durationTicks, $state->status]
        );
    }

    private function persistPlaybackState(StreamState $state): void
    {
        $this->db->query(
            "UPDATE playback_state SET position_ticks = ?, duration_ticks = ?, playback_status = ?, updated_at = NOW()
             WHERE id = ?",
            [$state->positionTicks, $state->durationTicks, $state->status, $state->id]
        );
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