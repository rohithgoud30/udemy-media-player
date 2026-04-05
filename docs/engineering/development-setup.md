---
date: 2026-04-05T10:00:00Z
status: complete
tags: [setup, development, electron, pnpm]
---

# Development Setup

## Prerequisites

- **Node.js** 20+ (verify: `node -v`)
- **pnpm** (verify: `pnpm -v`, install: `npm install -g pnpm`)
- **macOS** recommended (native UI optimizations, Electron dock icon)

## Installation

```bash
git clone https://github.com/rohithgoud30/udemy-media-player.git
cd udemy-media-player
pnpm install
```

### Electron Binary

pnpm may block Electron's postinstall script. If you see `Electron failed to install correctly`:

```bash
# Option 1: Approve build scripts
pnpm approve-builds  # Select electron and esbuild

# Option 2: Run install manually
cd node_modules/.pnpm/electron@41.1.1/node_modules/electron
node install.js
cd -
```

Verify: `ls node_modules/.pnpm/electron@41.1.1/node_modules/electron/dist/Electron.app`

## Running in Development

```bash
pnpm run dev
```

This starts:
1. **Vite dev server** on `http://localhost:5173`
2. **Electron** (waits for Vite, then opens the window)

DevTools open automatically in dev mode.

## Building

```bash
pnpm run build    # Vite production build + TypeScript main process compilation
```

The build step:
1. `vite build` -- bundles React app to `dist/`
2. `tsc -p tsconfig.preload.json` -- compiles `main.ts` and `preload.ts` to JS

## Packaging

```bash
pnpm run package:mac      # macOS DMG + ZIP
pnpm run package:win      # Windows NSIS installer
pnpm run package:linux    # AppImage + deb
```

Output goes to `dist/`. The macOS DMG includes your custom icon from `build/icon.png`.

## TypeScript Configuration

| Config | Scope | Output |
|--------|-------|--------|
| `tsconfig.json` | Renderer (React) | noEmit (Vite handles bundling) |
| `tsconfig.preload.json` | Main process | `src/main/*.js` (CommonJS) |

The main process uses `ignoreDeprecations: "6.0"` for TypeScript 6 compatibility with `moduleResolution: "node10"`.

## Troubleshooting

### Electron won't start
- Check if binary exists: `ls node_modules/.pnpm/electron@*/node_modules/electron/dist/`
- Re-run install script (see above)

### Port 5173 in use
- Kill existing Vite: `lsof -ti:5173 | xargs kill`

### TypeScript errors in main process
- Run `pnpm run build:preload` separately to see errors
- The main process tsconfig compiles `main.ts` + `preload.ts` to the same directory
