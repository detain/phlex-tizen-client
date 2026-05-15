# Phlex Tizen TV App

Samsung Smart TV client application for Phlex Media Server, built with Tizen SDK.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Building the App](#building-the-app)
- [Testing](#testing)
- [Deployment to TV](#deployment-to-tv)
- [Supported Codecs](#supported-codecs)
- [License](#license)

## Overview

Phlex Tizen is a native Samsung Smart TV application that connects to a Phlex Media Server, allowing users to browse their media library and play content directly on their television. The app is built using vanilla JavaScript with webpack for bundling and supports both direct play and transcoded streaming via HLS.

## Features

- **Library Browsing**: Browse movies, TV shows, music, and other media from Phlex
- **Video Playback**: Support for direct play and HLS streaming with quality selection
- **Remote Control**: Full Samsung remote control support with intuitive navigation
- **User Authentication**: Secure login with Phlex account credentials
- **Progress Tracking**: Automatic resume from last playback position
- **Subtitle Support**: Multiple subtitle tracks and languages
- **Audio Tracks**: Multiple audio track selection
- **Search**: Search across your media library
- **Favorites**: Mark items as favorites
- **Watch History**: Track watched items

## Prerequisites

### Development Environment

- **Node.js**: Version 18 or higher
- **npm**: Version 8 or higher (included with Node.js)
- **Git**: For version control

### Samsung TV Development

- **Tizen Studio**: Version 4.0 or higher
- **Samsung TV SDK**: Tizen TV Extensions
- **Samsung Smart TV**: 2016 model or newer (Tizen OS)

### Phlex Media Server

- **Phlex Media Server**: Version 4.8 or higher
- **Network**: TV and server must be on the same network

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/detain/phlex-tizen.git
cd phlex-tizen
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Create a `tizen.env` file in the project root (see [Configuration](#configuration) section).

### 4. Start Development Server

```bash
npm run serve
```

The app will be available at `http://localhost:8080`.

## Configuration

### Environment Variables

Create or edit `tizen.env` in the project root:

```env
PHLEX_SERVER_URL=http://192.168.1.100:8096
PHLEX_DEVICE_NAME=Living Room TV
LOG_LEVEL=info
```

| Variable | Description | Default |
|----------|-------------|---------|
| `PHLEX_SERVER_URL` | URL of your Phlex Media Server | `http://localhost:8096` |
| `PHLEX_DEVICE_NAME` | Display name for this TV device | `Samsung Tizen TV` |
| `LOG_LEVEL` | Logging verbosity | `info` |

### Tizen Configuration

The `app/config.xml` file contains Tizen-specific settings:

- App ID and version
- Network access permissions
- TV capabilities declaration
- Focus navigation settings

## Building the App

### Development Build

```bash
# Build with development settings
npm run build:dev

# Watch for changes and rebuild
npm run watch
```

### Production Build

```bash
# Create production bundle
npm run build
```

Output is placed in the `dist/` directory.

### Packaging for Tizen

```bash
# Package the app for Tizen
node scripts/package.js
```

This creates a `.wgt` widget file in the `dist/` directory.

## Testing

### Run All Tests

```bash
npm test
```

### Run Unit Tests Only

```bash
npm run test:unit
```

### Run Integration Tests

```bash
npm run test:integration
```

### Code Linting

```bash
npm run lint
```

### Run Linting with Auto-fix

```bash
npm run lint -- --fix
```

## Deployment to TV

### Option 1: Tizen Studio

1. **Open Tizen Studio**
   ```bash
   tizen studio
   ```

2. **Import Project**
   - File → Import → Tizen → Tizen Project
   - Select the `phlex-tizen` directory
   - Choose "TV" as the platform

3. **Connect Device**
   - Ensure your TV and computer are on the same network
   - In Tizen Studio, go to Window → Preferences → Tizen TV → Devices
   - Add your TV's IP address

4. **Run on Device**
   - Right-click the project → Run As → Tizen TV Application
   - Or press `Shift + F11` to run

### Option 2: CLI Deployment

```bash
# Package the app
npm run build
node scripts/package.js

# Deploy via Tizen CLI
tizen install -n dist/org.phlex.phlextv.wgt -t <TV_IP>

# Launch on TV
tizen launch -n org.phlex.phlextv
```

### Option 3: Debugging

```bash
# Start debug server
node scripts/debug.js

# In Tizen Studio, attach debugger to running app
```

## Remote Control

The app supports full Samsung remote control navigation:

| Button | Action |
|--------|--------|
| Arrow Up/Down/Left/Right | Navigate through items |
| OK | Select item / Enter |
| Back | Go back / Return |
| Play/Pause | Toggle playback |
| Stop | Stop playback and return to library |
| Fast Forward | Seek forward 10 seconds |
| Rewind | Seek backward 10 seconds |
| Red (Color) | Toggle subtitles |
| Green (Color) | Cycle audio tracks |
| Yellow (Color) | Cycle quality levels |
| Blue (Color) | Toggle favorite |
| Info | Show/hide playback info panel |
| Tools | Show options menu |

## Supported Codecs

### Video
- H.264 (AVC)
- H.265 (HEVC)
- VP9

### Audio
- AAC
- AC3 (Dolby Digital)
- EAC3 (Dolby Digital Plus)
- DTS
- FLAC
- MP3

### Containers
- MP4
- MKV
- WebM
- TS (MPEG Transport Stream)

### Streaming
- HLS (HTTP Live Streaming)
- MPEG-DASH
- Progressive HTTP download

## Project Structure

```
phlex-tizen/
├── app/
│   ├── index.html           # Main HTML entry point
│   ├── config.xml           # Tizen configuration
│   ├── js/
│   │   ├── main.js          # Application bootstrap
│   │   ├── api/            # API client modules
│   │   │   ├── ApiClient.js
│   │   │   ├── AuthManager.js
│   │   │   ├── LibraryManager.js
│   │   │   ├── PlayerManager.js
│   │   │   └── SessionManager.js
│   │   ├── player/          # Video player components
│   │   │   ├── VideoPlayer.js
│   │   │   ├── HlsPlayer.js
│   │   │   ├── SubtitleRenderer.js
│   │   │   └── QualitySelector.js
│   │   ├── remote/          # Remote control handling
│   │   │   ├── RemoteManager.js
│   │   │   ├── PlayerRemoteHandler.js
│   │   │   └── KeyMapping.js
│   │   ├── ui/              # User interface views
│   │   │   ├── App.js
│   │   │   ├── Router.js
│   │   │   ├── HomeView.js
│   │   │   ├── LibraryView.js
│   │   │   ├── DetailView.js
│   │   │   └── PlayerView.js
│   │   ├── config/          # Configuration
│   │   │   └── constants.js
│   │   └── utils/           # Utility functions
│   │       ├── Logger.js
│   │       ├── Storage.js
│   │       └── Helpers.js
│   └── css/                 # Stylesheets
│       ├── style.css
│       ├── player.css
│       ├── components.css
│       └── themes/
│           └── dark.css
├── scripts/                  # Build scripts
│   ├── build.js
│   ├── package.js
│   └── debug.js
├── tests/                    # Test files
│   └── unit/
│       ├── api/
│       │   └── ApiClient.test.js
│       ├── remote/
│       │   └── KeyMapping.test.js
│       └── utils/
│           └── Helpers.test.js
├── .github/
│   └── workflows/
│       ├── test.yml
│       └── lint.yml
├── babel.config.js           # Babel configuration
├── webpack.config.js         # Webpack configuration
├── package.json
└── README.md
```

## Troubleshooting

### App Won't Start

1. Ensure your TV supports Tizen OS (2016+ models)
2. Check that the TV is connected to the same network as the server
3. Verify the Phlex Media Server is running and accessible

### Playback Issues

1. For buffering issues, check network bandwidth
2. If direct play fails, the server may transcode (slower start)
3. Check server logs for codec compatibility warnings

### Remote Not Working

1. Ensure no other device is controlling the TV
2. Try restarting the TV
3. Check that the remote's batteries are fresh

## License

MIT License

Copyright (c) 2024 Phlex

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
