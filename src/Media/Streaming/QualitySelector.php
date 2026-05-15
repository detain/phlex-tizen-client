<?php

declare(strict_types=1);

namespace Phlex\Media\Streaming;

/**
 * Quality Selector - Device profile-based quality selection for adaptive streaming.
 *
 * Determines optimal streaming quality based on device capabilities and source
 * compatibility. Evaluates codec support, resolution limits, and bitrate constraints
 * to decide between direct play and transcoding.
 *
 * @author Phlex Media Server Team
 * @version 1.0.0
 * @description Adaptive quality selection based on device profiles and source compatibility
 * @see https://developer.mozilla.org/en-US/docs/Glossary/Adaptive_bitrate_streaming
 */
class QualitySelector
{
    /**
     * @var array<string, array{
     *     max_bitrate: int,
     *     max_resolution: array<int, int>,
     *     direct_play: array<string>,
     *     transcode: array<string>,
     *     container: array<string>
     * }> Device profiles indexed by name
     */
    private array $deviceProfiles;

    /**
     * Creates a new QualitySelector with optional custom profiles.
     *
     * @param array<string, array{
     *     max_bitrate?: int,
     *     max_resolution?: array<int, int>,
     *     direct_play?: array<string>,
     *     transcode?: array<string>,
     *     container?: array<string>
     * }> $deviceProfiles Optional custom device profiles to merge with defaults
     *
     * @example
     * ```php
     * $selector = new QualitySelector(['custom-profile' => ['max_bitrate' => 5000000]]);
     * ```
     */
    public function __construct(array $deviceProfiles = [])
    {
        $this->deviceProfiles = $deviceProfiles;
        $this->loadDefaultProfiles();
    }

    /**
     * Loads default device profiles.
     *
     * Provides profiles for various device categories:
     * - generic: High-capability generic device
     * - mobile-low: Low-end mobile (480p max)
     * - mobile-high: High-end mobile (720p max)
     * - web: Web browser (1080p max)
     * - tv-4k: 4K TV (2160p max)
     */
    private function loadDefaultProfiles(): void
    {
        $this->deviceProfiles = array_merge($this->deviceProfiles, [
            'generic' => [
                'max_bitrate' => 100000000,
                'max_resolution' => [3840, 2160],
                'direct_play' => ['h264', 'h265', 'vp9'],
                'transcode' => ['h264'],
                'container' => ['mp4', 'mkv', 'webm'],
            ],
            'mobile-low' => [
                'max_bitrate' => 1500000,
                'max_resolution' => [854, 480],
                'direct_play' => ['h264'],
                'transcode' => ['h264'],
                'container' => ['mp4'],
            ],
            'mobile-high' => [
                'max_bitrate' => 4000000,
                'max_resolution' => [1280, 720],
                'direct_play' => ['h264', 'h265'],
                'transcode' => ['h264'],
                'container' => ['mp4'],
            ],
            'web' => [
                'max_bitrate' => 10000000,
                'max_resolution' => [1920, 1080],
                'direct_play' => ['h264', 'vp9'],
                'transcode' => ['h264', 'vp9'],
                'container' => ['mp4', 'webm'],
            ],
            'tv-4k' => [
                'max_bitrate' => 50000000,
                'max_resolution' => [3840, 2160],
                'direct_play' => ['h264', 'h265', 'vp9'],
                'transcode' => ['h264', 'h265'],
                'container' => ['mp4', 'mkv', 'ts'],
            ],
        ]);
    }

    /**
     * Selects optimal quality for a source with a given device profile.
     *
     * Analyzes the source media and device capabilities to determine whether
     * direct play is possible or if transcoding is required.
     *
     * @param array{
     *     streams: array<int, array{codec_type: string, codec?: string, width?: int, height?: int, bitrate?: int}>,
     *     format?: array{format_name?: string}
     * } $sourceInfo Source media information from probe
     * @param string $profileName Device profile name (e.g., 'generic', 'mobile-high')
     * @param array<string, mixed> $options Additional options
     *
     * @return array{
     *     method: string,
     *     container: string,
     *     video_codec: string|null,
     *     audio_codec: string|null,
     *     max_resolution: array<int, int>,
     *     max_bitrate: int
     * } Quality selection result with method and encoding parameters
     *
     * @example
     * ```php
     * $result = $selector->selectQuality($sourceInfo, 'web');
     * if ($result['method'] === 'direct') {
     *     // Stream directly without transcoding
     * } else {
     *     // Transcode with specified parameters
     * }
     * ```
     */
    public function selectQuality(array $sourceInfo, string $profileName, array $options = []): array
    {
        $profile = $this->deviceProfiles[$profileName] ?? $this->deviceProfiles['generic'];

        $videoStream = $this->getVideoStream($sourceInfo);
        $audioStream = $this->getAudioStream($sourceInfo);

        $canDirectPlay = $this->canDirectPlay($videoStream, $audioStream, $profile);

        if ($canDirectPlay) {
            return [
                'method' => 'direct',
                'container' => $this->detectContainer($sourceInfo),
                'video_codec' => $videoStream['codec'] ?? null,
                'audio_codec' => $audioStream['codec'] ?? null,
                'max_resolution' => $profile['max_resolution'],
                'max_bitrate' => $profile['max_bitrate'],
            ];
        }

        return [
            'method' => 'transcode',
            'container' => 'ts',
            'video_codec' => 'libx264',
            'audio_codec' => 'aac',
            'max_resolution' => $profile['max_resolution'],
            'max_bitrate' => min($profile['max_bitrate'], 8000000),
        ];
    }

    /**
     * Determines if direct play is possible with the given streams and profile.
     *
     * Checks video codec, audio codec, resolution, and bitrate against profile
     * constraints to determine compatibility.
     *
     * @param array|null $videoStream Video stream info
     * @param array|null $audioStream Audio stream info
     * @param array $profile Device profile constraints
     *
     * @return bool True if all constraints are satisfied for direct play
     */
    private function canDirectPlay(?array $videoStream, ?array $audioStream, array $profile): bool
    {
        if (!$videoStream || !$audioStream) {
            return false;
        }

        $videoCodec = strtolower($videoStream['codec'] ?? '');
        $audioCodec = strtolower($audioStream['codec'] ?? '');

        if (!in_array($videoCodec, $profile['direct_play'], true)) {
            return false;
        }

        $supportedAudio = ['aac', 'ac3', 'eac3', 'mp3', 'flac', 'opus'];
        if (!in_array($audioCodec, $supportedAudio, true)) {
            return false;
        }

        $width = $videoStream['width'] ?? 0;
        $height = $videoStream['height'] ?? 0;
        [$maxWidth, $maxHeight] = $profile['max_resolution'];

        if ($width > $maxWidth || $height > $maxHeight) {
            return false;
        }

        $bitrate = $videoStream['bitrate'] ?? 0;
        if ($bitrate > $profile['max_bitrate']) {
            return false;
        }

        return true;
    }

    /**
     * Extracts video stream information from source info.
     *
     * @param array $sourceInfo Source media information
     *
     * @return array|null First video stream found or null
     */
    private function getVideoStream(array $sourceInfo): ?array
    {
        foreach ($sourceInfo['streams'] ?? [] as $stream) {
            if (($stream['codec_type'] ?? '') === 'video') {
                return $stream;
            }
        }
        return null;
    }

    /**
     * Extracts audio stream information from source info.
     *
     * @param array $sourceInfo Source media information
     *
     * @return array|null First audio stream found or null
     */
    private function getAudioStream(array $sourceInfo): ?array
    {
        foreach ($sourceInfo['streams'] ?? [] as $stream) {
            if (($stream['codec_type'] ?? '') === 'audio') {
                return $stream;
            }
        }
        return null;
    }

    /**
     * Detects container format from source format info.
     *
     * @param array $sourceInfo Source media information
     *
     * @return string Detected container type (mkv, mp4, webm, ts, mp4)
     */
    private function detectContainer(array $sourceInfo): string
    {
        $format = $sourceInfo['format'] ?? [];
        $formatName = strtolower($format['format_name'] ?? '');

        if (str_contains($formatName, 'matroska')) {
            return 'mkv';
        }
        if (str_contains($formatName, 'mp4')) {
            return 'mp4';
        }
        if (str_contains($formatName, 'webm')) {
            return 'webm';
        }
        if (str_contains($formatName, 'mpegts')) {
            return 'ts';
        }

        return 'mp4';
    }

    /**
     * Registers a custom device profile.
     *
     * @param string $name Profile name
     * @param array{
     *     max_bitrate?: int,
     *     max_resolution?: array<int, int>,
     *     direct_play?: array<string>,
     *     transcode?: array<string>,
     *     container?: array<string>
     * } $profile Profile definition
     *
     * @example
     * ```php
     * $selector->registerProfile('smart-tv', [
     *     'max_bitrate' => 20000000,
     *     'max_resolution' => [1920, 1080],
     *     'direct_play' => ['h264', 'h265'],
     * ]);
     * ```
     */
    public function registerProfile(string $name, array $profile): void
    {
        $this->deviceProfiles[$name] = $profile;
    }

    /**
     * Gets a device profile by name.
     *
     * @param string $name Profile name
     *
     * @return array|null Profile definition or null if not found
     */
    public function getProfile(string $name): ?array
    {
        return $this->deviceProfiles[$name] ?? null;
    }
}
