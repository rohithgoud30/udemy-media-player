---
date: 2026-04-05T10:00:00Z
status: complete
---

# Contributing

## Prerequisites

- Node.js 20+
- pnpm (not npm or yarn)
- macOS recommended for development (Electron + native UI)

## Setup

```bash
git clone https://github.com/rohithgoud30/udemy-media-player.git
cd udemy-media-player
pnpm install
pnpm run dev
```

Note: After `pnpm install`, you may need to approve Electron's build script:
```bash
pnpm approve-builds  # Select electron and esbuild
```

## Code Standards

### TypeScript

- **No `any` types.** Use `unknown` with `instanceof` narrowing, or define proper interfaces.
- All source files are TypeScript. The `src/main/` directory compiles `.ts` to `.js` via `tsconfig.preload.json`.
- Catch blocks use `catch (err: unknown)` with `err instanceof Error ? err.message : "Unknown error"`.

### CSS

- **Component-scoped CSS**: Each component imports its own `.css` file (e.g., `import "./CourseView.css"`).
- **Global CSS** (`global.css`) only covers: layout, navbar, library, import, and shared utilities.
- **No duplicate selectors** across global and component CSS files.
- **Design tokens** in `tokens.css` -- never hardcode colors, spacing, radius, or font values.
- **No `transition: all`** -- always specify exact properties (e.g., `transition: background var(--transition-fast), color var(--transition-fast)`).
- **No `backdrop-filter`** on repeated/list elements -- only use on singletons like the navbar.
- **Class naming**: Component-specific prefixes to avoid collisions (e.g., `cv-` for CourseView, `pi-` for PlayerInfo).

### React

- Functional components only. No class components.
- Custom hooks for complex logic (`useVideoPlayer`, `useSubtitles`).
- State managed via `useState` / `useEffect`. No external state library.
- `React.memo` where parent re-renders are frequent (e.g., Navbar).

### File Organization

```
components/
  ComponentName/
    ComponentName.tsx    # Component logic + JSX
    ComponentName.css    # Scoped styles
```

## Git Workflow

### Branches

- `main` -- stable, production-ready
- `redesign/*` -- UI redesign work
- `feature/*` -- new features
- `fix/*` -- bug fixes

### Commits

- Use imperative mood: "Add feature", not "Added feature"
- Keep commits focused on a single change
- Reference issues when applicable

## Build & Test

```bash
pnpm run build          # Vite build + TypeScript compilation
pnpm run package:mac    # Package for macOS
pnpm run package:win    # Package for Windows
pnpm run package:linux  # Package for Linux
```

## Project Structure

See [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md) for the full directory map and architecture.
