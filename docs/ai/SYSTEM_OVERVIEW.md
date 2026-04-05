---
date: 2026-04-05T10:00:00Z
status: complete
repository: udemy-media-player
default_branch: main
tags: [electron, react, typescript, media-player, offline-first]
---

# System Overview

Udemy Media Player is a self-hosted, offline-first desktop application for importing, organizing, and watching downloaded Udemy course content. Built with Electron 41, React 19, and TypeScript 6, it runs entirely on the user's machine with no cloud dependencies.

## Directory Map

```
udemy-media-player/
├── src/
│   ├── main/                    # Electron main process (TypeScript)
│   │   ├── main.ts              # App entry, window management, IPC handlers
│   │   └── preload.ts           # Context bridge API for renderer
│   ├── renderer/                # React application
│   │   ├── App.tsx              # Root router, course state, navbar visibility
│   │   ├── main.tsx             # React DOM entry point
│   │   ├── components/
│   │   │   ├── Navbar.tsx       # macOS toolbar with segmented control
│   │   │   ├── Library/         # Course grid, search, import
│   │   │   ├── Course/          # Course view with sections & lectures
│   │   │   ├── Player/          # Video player, controls, progress bar
│   │   │   └── Settings/        # App preferences
│   │   ├── hooks/
│   │   │   ├── useVideoPlayer.ts   # Playback state & methods
│   │   │   └── useSubtitles.ts     # Subtitle loading & display
│   │   ├── styles/
│   │   │   ├── tokens.css       # Design system tokens
│   │   │   └── global.css       # Global + layout + library styles
│   │   └── utils/
│   │       ├── formatters.ts    # Time/duration formatting
│   │       └── settingsManager.ts  # localStorage settings persistence
│   ├── js/                      # Shared modules
│   │   ├── database.ts          # Dexie.js IndexedDB (courses, progress)
│   │   └── fileScanner.ts       # Directory scanner for course import
│   └── types/                   # Global TypeScript declarations
├── build/                       # App icons for packaging
├── public/                      # Static assets
├── docs/                        # Documentation
└── dist/                        # Build output
```

## Runtime Topology

```
┌─────────────────────────────────────────────────┐
│  Electron Main Process  (main.ts)               │
│  ├── BrowserWindow management                   │
│  ├── IPC handlers (directory, settings, files)  │
│  └── Native dialogs                             │
│         ▲                                       │
│         │ contextBridge (preload.ts)             │
│         ▼                                       │
│  Renderer Process  (React 19 + Vite 8)          │
│  ├── HashRouter (Library, Course, Player, etc.) │
│  ├── IndexedDB via Dexie.js                     │
│  └── localStorage (settings)                    │
└─────────────────────────────────────────────────┘
```

## Application Routes

| Route | Component | Navbar | Description |
|-------|-----------|--------|-------------|
| `/` | Library | Yes | Course grid with search/sort |
| `/import` | ImportCourse | Yes | Drag-drop or folder picker |
| `/course/:courseId` | CourseView | Yes | Sections, lectures, progress |
| `/watch/:lectureId` | ModernVideoPlayer | No | Full video player |
| `/settings` | Settings | Yes | Playback preferences |

## Data & Persistence

### IndexedDB (Dexie.js)

- **courses** -- Course metadata (title, path, dateAdded)
- **sections** -- Section groupings within courses
- **lectures** -- Individual video files with paths, durations
- **progress** -- Per-lecture watch position, completion status

### localStorage

- **udemyPlayerSettings** -- Playback speed, auto-play, completion overlay preferences

## Key Architectural Decisions

1. **Navbar hidden on player route** -- `App.tsx` uses `useLocation()` to conditionally render `<Navbar />`, giving the player a full-window experience
2. **Component-scoped CSS** -- Each component owns its styles (CourseView.css, Settings.css, ModernVideoPlayer.css). Global.css only covers layout, navbar, library, import, and utilities
3. **No `any` types** -- Entire codebase uses strict TypeScript with `unknown` + narrowing
4. **macOS-native design system** -- System fonts (`-apple-system`), vibrancy tokens, segmented controls, rounded corners, inset shadows

## Design System

Defined in `src/renderer/styles/tokens.css`:

- **Colors**: Dark space theme with purple accent (`--accent-500: #8b5ff8`)
- **Glass effects**: `--glass-bg`, `--glass-border`, `--glass-blur` for translucent panels
- **Typography**: SF Pro system font stack, SF Mono for code/durations
- **Radius**: Generous macOS rounding (10-22px)
- **Transitions**: `cubic-bezier(0.25, 0.1, 0.25, 1)` for native feel

## Cross-Cutting Concerns

### State Management
React `useState` + `useEffect` throughout. No external state library. Course list lives in `App.tsx`, passed down via props.

### Video Playback
Custom `useVideoPlayer` hook wraps the HTML5 `<video>` element. Manages play/pause, seek, volume, speed, fullscreen. Progress saved to IndexedDB every 5 seconds.

### Subtitle Support
`useSubtitles` hook converts SRT to WebVTT, creates dynamic `<track>` elements. Supports multiple subtitle formats and customizable display.

### File Import
Two paths: Electron native (`electronAPI.scanDirectory`) and web fallback (`webkitdirectory` file input). Both produce the same section/lecture structure.

## Build & Packaging

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Vite dev server + Electron |
| `pnpm run build` | Vite production build + TypeScript compilation |
| `pnpm run package:mac` | macOS DMG via electron-builder |
| `pnpm run package:win` | Windows NSIS installer |
| `pnpm run package:linux` | AppImage + deb |

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Electron | 41.x | Desktop runtime |
| React | 19.x | UI framework |
| TypeScript | 6.x | Type safety |
| Vite | 8.x | Build tooling |
| Dexie.js | 4.x | IndexedDB wrapper |
| Font Awesome | 7.x | Icons |
| React Router | 7.x | Client-side routing |

## Risks & Hotspots

- **Large course imports**: Scanning directories with thousands of files can be slow. Consider async/chunked scanning.
- **Video codec support**: Depends on Electron's Chromium build. Some MKV codecs may not play.
- **Subtitle matching**: Heuristic name-based matching may miss subtitles with non-standard naming.

## Source References

- Main process: `src/main/main.ts`
- Preload bridge: `src/main/preload.ts`
- App root: `src/renderer/App.tsx`
- Database: `src/js/database.ts`
- Design tokens: `src/renderer/styles/tokens.css`
- Video player: `src/renderer/components/Player/ModernVideoPlayer.tsx`
