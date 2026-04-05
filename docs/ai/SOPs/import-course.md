---
title: SOP -- Import a Course
date: 2026-04-05T10:00:00Z
version: 1.0.0
applies_to: [ImportCourse.tsx, fileScanner.ts, database.ts]
risk_level: low
---

# SOP: Import a Course

## Purpose

Document the course import flow from user action to database storage.

## Procedure

### 1. User initiates import

Two entry points:
- **Drag & drop**: User drops a folder onto the drop zone. `handleDrop()` extracts the directory path from `e.dataTransfer.items[i].getAsFile().path` (Electron-only).
- **Folder picker**: User clicks "Select Folder". In Electron, `electronAPI.selectDirectory()` opens a native dialog. In browser fallback, a hidden `<input webkitdirectory>` element opens.

### 2. Directory scanning

**Electron path** (`importCourse()`):
- `fileScanner.scanCourseDirectory(dirPath)` recursively reads the directory
- Returns structured `{ title, path, sections: [...] }`

**Browser fallback** (`importCourseFromFiles()`):
- Receives `File[]` from the file input
- Groups files by subfolder path (section = first directory level)
- Matches subtitles to videos by filename similarity

### 3. File classification

- **Video**: `.mp4`, `.mkv`, `.webm`, `.avi`
- **Subtitles**: `.srt`, `.vtt`, `.ass`, `.ssa`
- Other files are ignored

### 4. Database insertion

`CourseManager.addCourse(courseData)` inserts:
1. Course record (title from folder name, path, dateAdded)
2. Section records (one per subfolder)
3. Lecture records (one per video file, with subtitle path if matched)

### 5. Navigation

After 1.5s delay (to show "100% complete"), navigates to `/course/:courseId`.

## Verification

- Course appears in Library grid
- Sections and lectures are correctly grouped
- Subtitle files are matched (check lecture records)
- Progress is initialized at 0%

## Failure Modes

| Failure | Cause | Recovery |
|---------|-------|----------|
| "No video files found" | Folder contains no supported video formats | User selects correct folder |
| Import hangs | Very large directory with thousands of files | Wait; consider chunked scanning |
| Subtitles not matched | Non-standard naming | Manual subtitle loading not yet supported |

## Source References

- `src/renderer/components/Library/ImportCourse.tsx`
- `src/js/fileScanner.ts`
- `src/js/database.ts` (`CourseManager.addCourse`)
