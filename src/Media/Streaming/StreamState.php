<?php

namespace Phlex\Media\Streaming;

class StreamState
{
    public string $id;
    public string $mediaItemId;
    public string $sessionId;
    public string $userId;
    public int $positionTicks;
    public int $durationTicks;
    public string $status; // playing, paused, stopped
    public string $playMethod; // direct, transcode
    public array $requestedStreams = [];
    public array $actualStreams = [];
    public ?string $transcodeJobId = null;
    public ?string $directStreamUrl = null;
    public float $startedAt;
    public ?float $pausedAt = null;

    public function __construct()
    {
        $this->status = 'stopped';
        $this->positionTicks = 0;
        $this->durationTicks = 0;
        $this->startedAt = microtime(true);
        $this->id = '';
        $this->mediaItemId = '';
        $this->sessionId = '';
        $this->userId = '';
        $this->playMethod = '';
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'media_item_id' => $this->mediaItemId,
            'session_id' => $this->sessionId,
            'user_id' => $this->userId,
            'position_ticks' => $this->positionTicks,
            'duration_ticks' => $this->durationTicks,
            'status' => $this->status,
            'play_method' => $this->playMethod,
            'requested_streams' => $this->requestedStreams,
            'actual_streams' => $this->actualStreams,
            'transcode_job_id' => $this->transcodeJobId,
        ];
    }

    public function getPositionSeconds(): float
    {
        return $this->positionTicks / 10000000;
    }

    public function getDurationSeconds(): float
    {
        return $this->durationTicks / 10000000;
    }

    public function getProgressPercent(): float
    {
        if ($this->durationTicks === 0) {
            return 0;
        }
        return ($this->positionTicks / $this->durationTicks) * 100;
    }

    public function isActive(): bool
    {
        return in_array($this->status, ['playing', 'paused']);
    }

    public function play(): void
    {
        $this->status = 'playing';
        if ($this->pausedAt !== null) {
            // Adjust start time to account for pause duration
            $pauseDuration = microtime(true) - $this->pausedAt;
            $this->startedAt += $pauseDuration;
            $this->pausedAt = null;
        }
    }

    public function pause(): void
    {
        $this->status = 'paused';
        $this->pausedAt = microtime(true);
    }

    public function stop(): void
    {
        $this->status = 'stopped';
    }

    public function seek(int $positionTicks): void
    {
        $this->positionTicks = max(0, min($positionTicks, $this->durationTicks));
    }
}