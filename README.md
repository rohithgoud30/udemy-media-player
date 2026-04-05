# Udemy Media Player

A self-hosted, offline media library dedicated to Udemy courses. Import your downloaded Udemy course folders via drag-and-drop or a directory picker, organize them into a browsable library, and track your learning progress.

## Features

- **Offline-First**: All processing and data stay on your machine -- no cloud services or accounts required
- **Course Library**: Browse, search, and sort your Udemy courses with gradient avatar cards
- **Built-in Video Player**: Full-featured player with keyboard shortcuts, subtitle support, and playback speed control
- **Progress Tracking**: Automatic progress saving, lecture completion detection, and resume from where you left off
- **macOS-Native Design**: Vibrancy effects, segmented controls, system fonts, and native-feeling UI

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm

### Installation

1. Clone this repository:
   ```
   git clone https://github.com/rohithgoud30/udemy-media-player.git
   cd udemy-media-player
   ```

2. Install dependencies:
   ```
   pnpm install
   ```

3. Start the development version:
   ```
   pnpm run dev
   ```

### Building for Production

To create a packaged macOS app:

```
pnpm run package:mac
```

Other platforms:

```
pnpm run package:win    # Windows
pnpm run package:linux  # Linux
```

Installers are output to the `dist/` folder.

## How to Use

### Importing Courses

1. Click "Import" in the navigation bar
2. Drag and drop a course folder or use "Select Folder"
3. The app scans for video files and organizes them into sections

### Watching Lectures

1. Navigate to a course in your library
2. Click Play on any lecture
3. Use keyboard shortcuts for playback control
4. Progress is saved automatically every 5 seconds

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space / K | Play/Pause |
| Left / Right | Seek 5s |
| F | Fullscreen |
| M | Mute/Unmute |
| C | Toggle Subtitles |
| , / . | Previous/Next Lecture |

### Tracking Progress

- Lectures auto-complete at 98% watched
- Manual watch/unwatch toggle per lecture
- Course progress shown as percentage with progress bar
- Resume button shows saved position

## Supported File Formats

- **Video**: MP4, MKV, WebM, AVI
- **Subtitles**: SRT, VTT, ASS, SSA

## Project Structure

```
src/
  main/           # Electron main process
  renderer/       # React application
    components/
      Library/    # Course grid, import
      Course/     # Course view with sections
      Player/     # Video player, controls
      Settings/   # App settings
    hooks/        # useVideoPlayer, useSubtitles
    styles/       # Design tokens, global CSS
    utils/        # Formatters, settings manager
  js/             # Database, file scanner
```

## Tech Stack

- **Electron** 41 -- Desktop runtime
- **React** 19 -- UI framework
- **TypeScript** 6 -- Type safety
- **Vite** 8 -- Build tooling
- **Dexie.js** -- IndexedDB wrapper for course/progress data
- **Font Awesome** 7 -- Icons

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

Copyright (c) 2025-2026 Udemy Media Player. All rights reserved.
