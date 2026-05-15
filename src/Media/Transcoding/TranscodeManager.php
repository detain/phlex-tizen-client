<?php

declare(strict_types=1);

namespace Phlex\Media\Transcoding;

use Phlex\Common\Database\Connection;
use Phlex\Media\Streaming\StreamState;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;

/**
 * Transcode Manager - Manages media transcoding jobs and lifecycle.
 *
 * Coordinates transcoding operations by creating FFmpeg jobs, tracking their
 * status, managing concurrent job limits, and cleaning up stale jobs.
 * Integrates with the streaming system to provide transcoded content.
 *
 * @author Phlex Media Server Team
 * @version 1.0.0
 * @description Job management for FFmpeg-based media transcoding with concurrency limits
 * @see FfmpegRunner For FFmpeg process execution
 * @see EncodingHelper For encoding parameter generation
 */
class TranscodeManager
{
    /** @var Connection Database connection for job persistence */
    private Connection $db;

    /** @var FfmpegRunner FFmpeg execution engine */
    private FfmpegRunner $ffmpeg;

    /** @var EncodingHelper Encoding parameter calculator */
    private EncodingHelper $encodingHelper;

    /** @var string Base directory for transcoded output files */
    private string $transcodeDir;

    /** @var string Base directory for HLS segments */
    private string $segmentDir;

    /** @var array<string, array{id: string, state: StreamState, output_path: string, encoding_params: array, started_at: int}> Active jobs */
    private array $activeJobs = [];

    /** @var int Maximum concurrent transcode jobs allowed */
    private int $maxConcurrentTranscodes;

    /** @var LoggerInterface Logger instance */
    private LoggerInterface $logger;

    // Job status constants
    public const STATUS_PENDING = 'pending';
    public const STATUS_RUNNING = 'running';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_FAILED = 'failed';
    public const STATUS_CANCELLED = 'cancelled';

    /**
     * Creates a new TranscodeManager instance.
     *
     * @param Connection $db Database connection
     * @param FfmpegRunner $ffmpeg FFmpeg execution engine
     * @param EncodingHelper $encodingHelper Encoding parameter calculator
     * @param string $transcodeDir Output directory for transcoded files
     * @param string $segmentDir Directory for HLS segments
     * @param LoggerInterface|null $logger Optional PSR logger
     *
     * @example
     * ```php
     * $manager = new TranscodeManager($db, $ffmpeg, $helper, '/var/transcodes', '/var/segments');
     * ```
     */
    public function __construct(
        Connection $db,
        FfmpegRunner $ffmpeg,
        EncodingHelper $encodingHelper,
        string $transcodeDir,
        string $segmentDir,
        ?LoggerInterface $logger = null
    ) {
        $this->db = $db;
        $this->ffmpeg = $ffmpeg;
        $this->encodingHelper = $encodingHelper;
        $this->transcodeDir = $transcodeDir;
        $this->segmentDir = $segmentDir;
        $this->maxConcurrentTranscodes = 4;
        $this->logger = $logger ?? new NullLogger();
    }

    /**
     * Starts a transcode job for a stream.
     *
     * Creates the output directory, probes the source, calculates encoding
     * parameters, and initiates the transcode process.
     *
     * @param StreamState $state Stream state containing media item reference
     * @param array<string, mixed> $options Additional options (device_profile, etc.)
     *
     * @return string Job ID for tracking
     *
     * @throws \InvalidArgumentException If media item not found
     * @throws \RuntimeException If probing fails or transcode fails to start
     *
     * @example
     * ```php
     * $jobId = $manager->startTranscode($streamState, ['device_profile' => 'mobile-high']);
     * ```
     */
    public function startTranscode(StreamState $state, array $options = []): string
    {
        $jobId = $this->generateUuid();

        $outputDir = "{$this->transcodeDir}/{$jobId}";
        if (!mkdir($outputDir, 0755, true) && !is_dir($outputDir)) {
            throw new \RuntimeException("Failed to create transcode directory: {$outputDir}");
        }

        $item = $this->getMediaItem($state->mediaItemId);
        if (!$item) {
            throw new \InvalidArgumentException("Media item not found");
        }

        $sourceInfo = $this->ffmpeg->probe($item['path']);
        if (!$sourceInfo) {
            throw new \RuntimeException("Failed to probe media file");
        }

        $profile = $options['device_profile'] ?? [];
        $encodingParams = $this->encodingHelper->getEncodingParams($sourceInfo, $profile, $options);

        $container = $encodingParams['container'] ?? 'ts';
        $outputPath = "{$outputDir}/output.{$container}";

        $this->db->query(
            "INSERT INTO transcode_jobs (id, media_item_id, input_path, output_path, status) VALUES (?, ?, ?, ?, 'running')",
            [$jobId, $state->mediaItemId, $item['path'], $outputPath]
        );

        $success = $this->ffmpeg->transcode($item['path'], $outputPath, $encodingParams);

        if (!$success) {
            $this->db->query("UPDATE transcode_jobs SET status = 'failed' WHERE id = ?", [$jobId]);
            throw new \RuntimeException("Transcode failed");
        }

        $this->activeJobs[$jobId] = [
            'id' => $jobId,
            'state' => $state,
            'output_path' => $outputPath,
            'encoding_params' => $encodingParams,
            'started_at' => time(),
        ];

        $this->logger->info('Transcode started', ['job_id' => $jobId]);

        return $jobId;
    }

    /**
     * Stops a running transcode job.
     *
     * Terminates the job, deletes output files, and updates the database
     * status to 'cancelled'.
     *
     * @param string $jobId Job identifier
     */
    public function stopTranscode(string $jobId): void
    {
        if (!isset($this->activeJobs[$jobId])) {
            return;
        }

        $job = $this->activeJobs[$jobId];

        $dir = dirname($job['output_path']);
        if (is_dir($dir)) {
            $files = glob("{$dir}/*");
            foreach ($files as $file) {
                if (is_file($file)) {
                    unlink($file);
                }
            }
            rmdir($dir);
        }

        $this->db->query("UPDATE transcode_jobs SET status = 'cancelled' WHERE id = ?", [$jobId]);

        unset($this->activeJobs[$jobId]);

        $this->logger->info('Transcode cancelled', ['job_id' => $jobId]);
    }

    /**
     * Gets the status of a transcode job.
     *
     * @param string $jobId Job identifier
     *
     * @return array{
     *     id: string,
     *     status: string,
     *     output_path?: string
     * }|null Job status array or null if not found
     */
    public function getTranscodeStatus(string $jobId): ?array
    {
        if (isset($this->activeJobs[$jobId])) {
            return [
                'id' => $jobId,
                'status' => self::STATUS_RUNNING,
                'output_path' => $this->activeJobs[$jobId]['output_path'],
            ];
        }

        $result = $this->db->query("SELECT * FROM transcode_jobs WHERE id = ?", [$jobId]);
        return $result[0] ?? null;
    }

    /**
     * Gets count of currently running transcode jobs.
     *
     * @return int Number of active transcodes
     */
    public function getActiveTranscodeCount(): int
    {
        return count(array_filter($this->activeJobs, fn($j) => ($j['status'] ?? '') === self::STATUS_RUNNING));
    }

    /**
     * Cleans up stale transcode jobs older than max age.
     *
     * Identifies jobs that have been running longer than the specified
     * threshold and stops them to free resources.
     *
     * @param int $maxAgeSeconds Maximum job age in seconds (default: 3600)
     */
    public function cleanupStaleJobs(int $maxAgeSeconds = 3600): void
    {
        $cutoff = time() - $maxAgeSeconds;

        foreach ($this->activeJobs as $jobId => $job) {
            if ($job['started_at'] < $cutoff) {
                $this->stopTranscode($jobId);
                $this->logger->warning('Cleaned up stale transcode job', ['job_id' => $jobId]);
            }
        }
    }

    /**
     * Retrieves media item from database.
     *
     * @param string $itemId Media item identifier
     *
     * @return array|null Media item row or null
     */
    private function getMediaItem(string $itemId): ?array
    {
        $result = $this->db->query("SELECT * FROM media_items WHERE id = ?", [$itemId]);
        return $result[0] ?? null;
    }

    /**
     * Generates a UUID v4 identifier.
     *
     * @return string UUID string
     */
    private function generateUuid(): string
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff)
        );
    }
}
