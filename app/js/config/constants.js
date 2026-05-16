/**
 * Application constants
 */

export default {
    // API Configuration
    API_BASE_URL: window.PHLEX_SERVER_URL || 'http://localhost:8096',
    API_VERSION: 'v1',

    // Device Configuration
    DEVICE_TYPE: 'samsung-tizen',
    DEVICE_NAME: 'Samsung Tizen TV',
    MAX_STREAMING_BITRATE: 80000000, // 80 Mbps
    MAX_STATIC_BITRATE: 80000000,

    // Supported Codecs
    VIDEO_CODECS: ['h264', 'hevc', 'vp9'],
    AUDIO_CODECS: ['aac', 'ac3', 'eac3', 'dts', 'flac'],
    CONTAINERS: ['mkv', 'mp4', 'webm', 'ts'],

    // Playback
    SEEKBAR_STEP: 10, // seconds
    VOLUME_STEP: 5, // percent
    PROGRESS_REPORT_INTERVAL: 10000, // ms
    HEARTBEAT_INTERVAL: 30000, // ms

    // UI
    INFO_PANEL_TIMEOUT: 3000, // ms
    FOCUS_CLASS: 'focusable',
    SELECTED_CLASS: 'selected'
};
