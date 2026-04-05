---
date: 2026-04-05T10:00:00Z
status: complete
tags: [database, indexeddb, dexie, persistence]
---

# Data Model

## Overview

All data is stored locally on the user's machine. Course/lecture data uses IndexedDB via Dexie.js. Settings use localStorage.

## IndexedDB Schema (Dexie.js)

Defined in `src/js/database.ts`.

### courses
| Field | Type | Description |
|-------|------|-------------|
| id | number (auto) | Primary key |
| title | string | Course name (from folder name) |
| path | string | Absolute path to course directory |
| dateAdded | Date | Import timestamp |

### sections
| Field | Type | Description |
|-------|------|-------------|
| id | number (auto) | Primary key |
| courseId | number | FK to courses |
| title | string | Section name (from subfolder) |
| index | number | Sort order |

### lectures
| Field | Type | Description |
|-------|------|-------------|
| id | number (auto) | Primary key |
| sectionId | number | FK to sections |
| courseId | number | FK to courses |
| title | string | Lecture name (from filename) |
| filePath | string | Absolute path to video file |
| subtitlePath | string | null | Path to subtitle file |
| duration | number | Duration in seconds (0 until loaded) |
| index | number | Sort order |
| size | number | File size in bytes |

### progress
| Field | Type | Description |
|-------|------|-------------|
| lectureId | number | FK to lectures (unique) |
| position | number | Playback position in seconds |
| watched | number | 0 = unwatched, 0.5 = partial, 1 = complete |
| lastPlayed | Date | Last interaction timestamp |

## localStorage

### udemyPlayerSettings
```typescript
interface AppSettings {
  playback: {
    defaultSpeed: number;       // 0.5 - 4.0
    autoPlay: boolean;          // Auto-play on open
    preferredQuality: string;   // Always "auto"
    rememberPosition: boolean;  // Always true (forced)
    autoMarkCompleted: boolean; // Always true (forced)
    autoPlayNext: boolean;      // Always true (forced)
    showCompletionOverlay: boolean; // Show toast on completion
  };
  shortcuts: Record<string, string>; // Key bindings (read-only)
}
```

## Data Flow

### Course Import
```
User selects folder
  → fileScanner.ts scans recursively
  → Groups videos by subfolder (sections)
  → Matches subtitles by filename similarity
  → CourseManager.addCourse() inserts course + sections + lectures
```

### Progress Tracking
```
Video playing
  → Every 5 seconds: ProgressManager.saveProgress(lectureId, currentTime)
  → At 98% watched: ProgressManager.saveProgress(lectureId, 0, true)
  → On lecture open: ProgressManager.getLectureProgress() → restore position
```

### Last Played
```
Opening a lecture
  → ProgressManager.saveLastPlayedLecture(courseId, lectureId)
  → CourseView reads this to auto-expand the correct section
  → Shows "Continue" badge on the lecture row
```
