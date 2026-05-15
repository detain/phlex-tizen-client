# Phlex Tizen - Developer Guide

This document provides detailed information for developers working on the Phlex Tizen TV application.

## Architecture Overview

The Phlex Tizen app follows a modular architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                        App.js                               │
│              (Main Application Controller)                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌───────────┐ ┌───────────┐ ┌───────────┐
│  Router.js │ │  Views    │ │  Managers  │
│            │ │            │ │            │
│ Navigation│ │ HomeView   │ │ ApiClient  │
│ Routing    │ │ LibraryView│ │ SessionMgr│
│ History    │ │ DetailView │ │ PlayerMgr │
│            │ │ PlayerView│ │ AuthMgr   │
└─────────────┘ └───────────┘ └───────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
              ┌───────────┐       ┌───────────┐     ┌───────────┐
              │VideoPlayer│       │RemoteMgr  │     │ Storage   │
              │           │       │           │     │           │
              │ HlsPlayer │       │KeyMapping │     │ Logger   │
              │ Subtitle  │       │RemoteHndlr│     │ Helpers  │
              └───────────┘       └───────────┘     └───────────┘
```

## Component Structure

### Entry Point (`app/js/main.js`)

The application bootstrap process:

1. Loads configuration from `tizen.env`
2. Initializes logging system
3. Creates the App instance
4. Sets up global error handlers

### App Core (`app/js/ui/App.js`)

The main application controller that:
- Manages view lifecycle
- Coordinates navigation
- Handles authentication state
- Bridges views with managers

### Views (`app/js/ui/`)

Each view is a self-contained UI module:

| View | Purpose |
|------|---------|
| `HomeView.js` | Media server selection, user greeting |
| `LibraryView.js` | Grid display of library items |
| `DetailView.js` | Item details, play button, info |
| `PlayerView.js` | Video playback controls overlay |

Views extend a common pattern:
```javascript
class SomeView {
    constructor(container) {
        this.container = container;
        this.element = null;
    }

    show() { /* Render and display */ }
    hide() { /* Hide from DOM */ }
    load(data) { /* Fetch and render data */ }
}
```

### API Client (`app/js/api/ApiClient.js`)

The central hub for all server communication:

```
ApiClient
├── Authentication
│   ├── login(username, password)
│   ├── register(email, username, password)
│   ├── logout()
│   └── restoreSession()
├── Session Management
│   ├── createSession()
│   └── getSessions()
├── Library Operations
│   ├── getLibraries()
│   ├── getLibraryItems(libraryId, options)
│   └── getItem(itemId)
├── Playback
│   ├── getItemPlaybackInfo(itemId, options)
│   ├── playItem(itemId, options)
│   ├── stopPlayback()
│   ├── pausePlayback()
│   ├── resumePlayback()
│   └── seekPlayback(positionTicks)
└── User Data
    ├── updateUserData(itemId, userData)
    ├── markWatched(itemId)
    ├── toggleFavorite(itemId)
    └── reportPlaybackProgress(positionTicks, isPaused)
```

#### API Error Handling

The `ApiError` class provides structured error information:

```javascript
try {
    await api.login(username, password);
} catch (error) {
    if (error instanceof ApiError) {
        console.log(error.status);  // HTTP status code
        console.log(error.message); // User-friendly message
        console.log(error.data);    // Additional error data
    }
}
```

### Video Player (`app/js/player/VideoPlayer.js`)

The player supports multiple playback methods:

#### Direct Play
For formats the TV can natively decode (MP4, MKV with supported codecs):
```javascript
await videoPlayer.load({
    method: 'DirectPlay',
    url: 'https://server/media.mkv'
});
```

#### HLS Streaming
For transcoded content using HLS.js:
```javascript
await videoPlayer.load({
    method: 'Transcode',
    protocol: 'HLS',
    url: 'https://server/stream.m3u8',
    preferredQuality: 'auto'
});
```

#### Player Events
```javascript
videoPlayer.on('ready', (info) => { /* Video ready to play */ });
videoPlayer.on('play', () => { /* Playback started */ });
videoPlayer.on('pause', () => { /* Playback paused */ });
videoPlayer.on('ended', () => { /* Playback finished */ });
videoPlayer.on('error', (err) => { /* Handle error */ });
videoPlayer.on('qualityChanged', (level) => { /* Quality switched */ });
videoPlayer.on('timeupdate', (data) => { /* Position update */ });
```

### Remote Control Handling (`app/js/remote/`)

#### Key Mapping (`KeyMapping.js`)

Maps Samsung remote codes to application actions:

```javascript
const KEY_MAPPING = {
    'MediaPlayPause': 'playPause',
    'MediaStop': 'stop',
    'ArrowUp': 'up',
    'ArrowDown': 'down',
    // ...
};
```

#### Remote Manager (`RemoteManager.js`)

Singleton that:
- Captures keydown events from Tizen
- Maps keys to actions
- Prevents default TV behavior when needed
- Supports key repeat for smooth navigation

#### Player Remote Handler (`PlayerRemoteHandler.js`)

Activated during playback to handle transport controls:

```javascript
PlayerRemoteHandler.activate();  // Enable playback controls
PlayerRemoteHandler.deactivate(); // Return to navigation mode
```

### Session Manager (`app/js/api/SessionManager.js`)

Manages playback session state with the server:

```javascript
sessionManager.on('playbackStarted', (data) => {
    // Notify server that playback began
});

sessionManager.on('playbackStopped', () => {
    // Notify server that playback ended
});
```

## API Client Design

### Request Flow

```
App Code
    │
    ▼
ApiClient.request(method, path, body, options)
    │
    ▼
┌─ Add Headers ─────────────────────────────┐
│  Content-Type: application/json          │
│  Authorization: Bearer {token}          │
│  X-Phlex-Device-ID: {deviceId}           │
│  X-Phlex-Session-ID: {sessionId}         │
└─────────────────────────────────────────┘
    │
    ▼
fetch(url, config)
    │
    ▼
┌─ Error Handling ────────────────────────┐
│  401: Token expired → restoreSession()  │
│  408: Timeout → AbortError             │
│  4xx/5xx: ApiError with status         │
└─────────────────────────────────────────┘
    │
    ▼
Return parsed JSON response
```

### Device Profile

The ApiClient sends a device profile for playback decisions:

```javascript
{
    Name: 'Samsung Tizen TV',
    MaxStreamingBitrate: 80000000,  // 80 Mbps
    MaxStaticBitrate: 80000000,
    SupportedMediaTypes: ['Video', 'Audio'],
    DirectPlayProfiles: [{
        Container: 'mkv,mp4,webm',
        Type: 'Video',
        VideoCodec: 'h264,hevc,vp9',
        AudioCodec: 'aac,ac3,eac3,dts,flac'
    }],
    TranscodingProfiles: [{
        Container: 'ts',
        Type: 'Video',
        VideoCodec: 'h264',
        AudioCodec: 'aac,ac3'
    }]
}
```

## Building and Testing Guide

### Prerequisites

- Node.js 18+
- npm 8+
- Tizen Studio (for TV deployment)

### Setup

```bash
# Clone and install
git clone https://github.com/detain/phlex-tizen.git
cd phlex-tizen
npm install
```

### Development Workflow

```bash
# Start dev server with hot reload
npm run serve

# Run tests in watch mode
npm test -- --watch

# Build development bundle
npm run build:dev

# Production build
npm run build
```

### Code Style

The project uses ESLint for code quality:
- Module imports/exports
- No unused variables
- Consistent formatting

```bash
# Check for issues
npm run lint

# Auto-fix issues
npm run lint -- --fix
```

### Writing Tests

Place tests in `tests/unit/` mirroring the source structure:

```javascript
// tests/unit/api/ApiClient.test.js
import { ApiClient } from '../../app/js/api/ApiClient.js';

describe('ApiClient', () => {
    let apiClient;

    beforeEach(() => {
        apiClient = new ApiClient('http://localhost:8096', 'test-device');
    });

    it('should create instance with correct base URL', () => {
        expect(apiClient.baseUrl).toBe('http://localhost:8096');
    });
});
```

### Building for Production

```bash
# Create production bundle
npm run build

# Package for Tizen
node scripts/package.js

# Output: dist/org.phlex.phlextv.wgt
```

### Debugging

```bash
# Start debug server
node scripts/debug.js

# In Tizen Studio:
# Run → Debug As → Tizen TV Application
```

### Performance Considerations

1. **Lazy Loading**: Views are loaded on demand
2. **HLS Buffering**: Configured for 30s buffer to handle network jitter
3. **Image Loading**: Thumbnails loaded as items scroll into view
4. **Memory**: Old HLS players destroyed before creating new ones

### Tizen-Specific Notes

1. **No Web Audio API**: Use HTML5 video element for audio
2. **Limited Storage**: Use Storage.js wrapper for localStorage
3. **No Pointer Events**: Use keydown/keyup events only
4. **Focus Management**: Manual focus handling required

## Common Tasks

### Adding a New View

1. Create `app/js/ui/NewView.js`:
```javascript
export default class NewView {
    constructor(container) {
        this.container = container;
    }

    show() { /* Implementation */ }
    hide() { /* Implementation */ }
    load(params) { /* Fetch and display data */ }
}
```

2. Register in `App.js`:
```javascript
this.views.set('new', new NewView(container));
```

3. Add route in `App.js`:
```javascript
this.router.addRoute('/new', () => this.showView('new'));
```

### Adding a New API Endpoint

1. Add method to `ApiClient.js`:
```javascript
async getNewData(id) {
    return this.request('GET', `/NewEndpoint/${id}`);
}
```

2. Export if needed:
```javascript
export { ApiClient, ApiError, /* export new items */ };
```

3. Add unit tests in `tests/unit/api/`

### Adding Remote Control Support

1. Add key mapping in `KeyMapping.js`:
```javascript
const KEY_MAPPING = {
    ...existing,
    'NewKey': 'newAction'
};
```

2. Handle in appropriate handler:
```javascript
if (action === 'newAction') {
    // Handle new action
}
```

## Troubleshooting

### Debug Logging

Enable detailed logging in `app/js/utils/Logger.js` or via `LOG_LEVEL` env var.

### Network Issues

Check CORS configuration on Phlex server - TV must be allowed to make requests.

### Playback Failures

1. Check server logs for codec support
2. Verify network connectivity
3. Try direct play vs transcoded playback
