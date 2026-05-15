<?php

namespace Phlex\Media\Streaming;

class HlsStreamer
{
    private string $segmentDir;
    private string $baseUrl;
    private QualitySelector $qualitySelector;
    private array $variantPlaylists = [];

    public function __construct(string $segmentDir, string $baseUrl, QualitySelector $qualitySelector)
    {
        $this->segmentDir = $segmentDir;
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->qualitySelector = $qualitySelector;
    }

    public function generateMasterPlaylist(string $jobId, array $qualityLevels): string
    {
        $playlist = "#EXTM3U\n";
        $playlist .= "#EXT-X-VERSION:3\n";

        foreach ($qualityLevels as $index => $level) {
            $playlist .= sprintf(
                "#EXT-X-STREAM-INF:BANDWIDTH=%d,RESOLUTION=%dx%d,NAME=\"%s\"\n",
                $level['bandwidth'],
                $level['width'],
                $level['height'],
                $level['name']
            );
            $playlist .= "stream_{$index}.m3u8\n";
        }

        return $playlist;
    }

    public function generateVariantPlaylist(string $jobId, int $variantIndex, array $segments, int $targetDuration): string
    {
        $playlist = "#EXTM3U\n";
        $playlist .= "#EXT-X-VERSION:3\n";
        $playlist .= "#EXT-X-TARGETDURATION:{$targetDuration}\n";
        $playlist .= "#EXT-X-MEDIA-SEQUENCE:0\n";
        $playlist .= "#EXT-X-PLAYLIST-TYPE:VOD\n";

        foreach ($segments as $i => $segment) {
            $duration = $segment['duration'] ?? $targetDuration;
            $playlist .= "#EXTINF:{$duration},\n";
            $playlist .= "segment_{$variantIndex}_" . sprintf('%03d', $i) . ".ts\n";
        }

        $playlist .= "#EXT-X-ENDLIST\n";

        return $playlist;
    }

    public function getSegmentPath(string $jobId, int $variantIndex, int $segmentNumber): string
    {
        return "{$this->segmentDir}/{$jobId}/segment_{$variantIndex}_" . sprintf('%03d', $segmentNumber) . ".ts";
    }

    public function segmentExists(string $jobId, int $variantIndex, int $segmentNumber): bool
    {
        $path = $this->getSegmentPath($jobId, $variantIndex, $segmentNumber);
        return file_exists($path);
    }

    public function getSegmentContent(string $jobId, int $variantIndex, int $segmentNumber): ?string
    {
        $path = $this->getSegmentPath($jobId, $variantIndex, $segmentNumber);

        if (!file_exists($path)) {
            return null;
        }

        return file_get_contents($path);
    }

    public function getPlaylistUrl(string $jobId): string
    {
        return "{$this->baseUrl}/hls/{$jobId}/playlist.m3u8";
    }

    public function getVariantPlaylistUrl(string $jobId, int $variantIndex): string
    {
        return "{$this->baseUrl}/hls/{$jobId}/stream_{$variantIndex}.m3u8";
    }

    public function getSegmentUrl(string $jobId, int $variantIndex, int $segmentNumber): string
    {
        return "{$this->segmentDir}/{$jobId}/segment_{$variantIndex}_" . sprintf('%03d', $segmentNumber) . ".ts";
    }

    public function getQualityLevelsForProfile(array $profile, array $sourceInfo): array
    {
        $maxHeight = min($profile['max_resolution'][1] ?? 1080, 2160);

        $levels = [
            ['index' => 0, 'name' => '1080p', 'width' => 1920, 'height' => 1080, 'bandwidth' => 5000000],
            ['index' => 1, 'name' => '720p', 'width' => 1280, 'height' => 720, 'bandwidth' => 2500000],
            ['index' => 2, 'name' => '480p', 'width' => 854, 'height' => 480, 'bandwidth' => 1000000],
        ];

        // Filter based on profile max resolution
        return array_filter($levels, function ($level) use ($maxHeight) {
            return $level['height'] <= $maxHeight;
        });
    }

    public function savePlaylist(string $jobId, string $content, string $filename): void
    {
        $dir = "{$this->segmentDir}/{$jobId}";
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        file_put_contents("{$dir}/{$filename}", $content);
    }

    public function getJobDirectory(string $jobId): string
    {
        return "{$this->segmentDir}/{$jobId}";
    }

    public function cleanupJob(string $jobId): void
    {
        $dir = "{$this->segmentDir}/{$jobId}";
        if (is_dir($dir)) {
            $files = glob("{$dir}/*");
            foreach ($files as $file) {
                unlink($file);
            }
            rmdir($dir);
        }
    }

    public function getSegmentCount(string $jobId, int $variantIndex): int
    {
        $dir = "{$this->segmentDir}/{$jobId}";
        $pattern = "{$dir}/segment_{$variantIndex}_*.ts";
        $files = glob($pattern);
        return count($files);
    }
}