<?php

namespace Phlex\Media\Streaming;

class QualitySelector
{
    private array $deviceProfiles;

    public function __construct(array $deviceProfiles = [])
    {
        $this->deviceProfiles = $deviceProfiles;
        $this->loadDefaultProfiles();
    }

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

    private function canDirectPlay(?array $videoStream, ?array $audioStream, array $profile): bool
    {
        if (!$videoStream || !$audioStream) {
            return false;
        }

        $videoCodec = strtolower($videoStream['codec'] ?? '');
        $audioCodec = strtolower($audioStream['codec'] ?? '');
        
        // Check video codec
        if (!in_array($videoCodec, $profile['direct_play'])) {
            return false;
        }
        
        // Check audio codec (simplified - might need more codecs)
        $supportedAudio = ['aac', 'ac3', 'eac3', 'mp3', 'flac', 'opus'];
        if (!in_array($audioCodec, $supportedAudio)) {
            return false;
        }
        
        // Check resolution
        $width = $videoStream['width'] ?? 0;
        $height = $videoStream['height'] ?? 0;
        [$maxWidth, $maxHeight] = $profile['max_resolution'];
        
        if ($width > $maxWidth || $height > $maxHeight) {
            return false;
        }
        
        // Check bitrate
        $bitrate = $videoStream['bitrate'] ?? 0;
        if ($bitrate > $profile['max_bitrate']) {
            return false;
        }
        
        return true;
    }

    private function getVideoStream(array $sourceInfo): ?array
    {
        foreach ($sourceInfo['streams'] ?? [] as $stream) {
            if (($stream['codec_type'] ?? '') === 'video') {
                return $stream;
            }
        }
        return null;
    }

    private function getAudioStream(array $sourceInfo): ?array
    {
        foreach ($sourceInfo['streams'] ?? [] as $stream) {
            if (($stream['codec_type'] ?? '') === 'audio') {
                return $stream;
            }
        }
        return null;
    }

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

    public function registerProfile(string $name, array $profile): void
    {
        $this->deviceProfiles[$name] = $profile;
    }

    public function getProfile(string $name): ?array
    {
        return $this->deviceProfiles[$name] ?? null;
    }
}