---
date: 2026-04-05T10:00:00Z
status: complete
tags: [electron-builder, packaging, distribution]
---

# Packaging & Distribution

## Overview

The app is packaged using `electron-builder` (v26). Configuration is in `package.json` under the `"build"` key.

## App Identity

| Field | Value |
|-------|-------|
| App ID | `com.udemymediaplayer.app` |
| Product Name | Udemy Media Player |
| Icon | `build/icon.png` (1024x1024 recommended) |

## Platform Targets

### macOS
```bash
pnpm run package:mac
```
- **Targets**: DMG, ZIP
- **Category**: `public.app-category.education`
- **Code signing**: Automatic if Apple Developer identity is available
- **Output**: `dist/Udemy Media Player-{version}-arm64.dmg`

### Windows
```bash
pnpm run package:win        # Default arch
pnpm run package:win:x64    # x64 only
pnpm run package:win:arm64  # ARM64 only
```
- **Target**: NSIS installer
- **Options**: User can choose install directory (`oneClick: false`)
- **Output**: `dist/Udemy Media Player-{version}-win-{arch}.exe`

### Linux
```bash
pnpm run package:linux
```
- **Targets**: AppImage, deb
- **Category**: Education
- **Output**: `dist/Udemy Media Player-{version}.AppImage`, `.deb`

## Build Pipeline

```
pnpm run package:mac
  └── pnpm run build
       ├── vite build              → dist/ (HTML, CSS, JS)
       └── tsc -p tsconfig.preload.json  → src/main/*.js
  └── electron-builder build --mac
       ├── Downloads Electron binary (if not cached)
       ├── Copies dist/ + src/main/ into .app bundle
       ├── Code signs (if identity available)
       └── Creates DMG + ZIP
```

## Files Included in Package

Defined in `package.json` `"build.files"`:
```json
["dist/**/*", "src/main/**/*"]
```

The renderer build output (`dist/`) and compiled main process (`src/main/*.js`) are bundled into the Electron app.

## Icon

The icon at `build/icon.png` is used by electron-builder to generate platform-specific icons:
- macOS: `.icns` (auto-generated)
- Windows: `.ico` (auto-generated)
- Linux: Multiple PNG sizes (auto-generated)

Note: In dev mode, macOS dock shows the default Electron icon. The custom icon only appears in packaged builds.
