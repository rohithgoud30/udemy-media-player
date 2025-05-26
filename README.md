# Udemy Media Player

A self-hosted, offline media library dedicated to Udemy courses. Import your downloaded Udemy course folders via drag-and-drop or a directory picker, organize them into a browsable library, and track your learning progress.

## Features

- **Offline-First**: All processing and data stay on your machine – no cloud services or accounts required
- **Course Library**: Browse, search, and organize your Udemy courses
- **Built-in Video Player**: Watch lectures with subtitle support
- **Progress Tracking**: Keep track of which lectures you've completed
- **Jellyfin-Inspired UI**: Clean, modern interface with dark theme

## Getting Started

### Prerequisites

- Node.js 14+
- npm or yarn

### Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/udemy-media-player.git
   cd udemy-media-player
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development version:
   ```
   npm run dev
   ```

### Building for Production

To create a production build:

```
npm run build
npm run start
```

To create a packaged executable:

```
npm run package
```

This will create platform-specific installers in the `dist` folder.

## How to Use

### Importing Courses

1. Click on "Import Course" in the navigation bar
2. Either drag and drop a course folder or use the "Select Folder" button
3. The app will scan the folder for video files and organize them into sections

### Watching Lectures

1. Navigate to a course in your library
2. Click on a lecture to start watching
3. Use the video player controls to adjust playback
4. Progress is automatically saved as you watch

### Tracking Progress

- Lectures are automatically marked as watched when you finish them
- You can manually mark lectures as watched/unwatched
- Course progress is displayed as a percentage on the library page

## Supported File Formats

- **Video**: MP4, MKV, WebM, AVI, MOV
- **Subtitles**: SRT, VTT, ASS, SSA

## Development

### Project Structure

- `/src/main` - Electron main process
- `/src/renderer` - React application (UI)
- `/src/js` - Shared JavaScript modules
- `/src/renderer/components` - React components

### Technologies Used

- Electron
- React
- IndexedDB (via Dexie.js)
- Video.js

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by [Jellyfin](https://jellyfin.org/) media server
- Built with Electron and React