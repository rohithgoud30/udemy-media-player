---
date: 2026-04-05T10:00:00Z
status: complete
tags: [css, design-tokens, macos, dark-theme]
---

# Design System

## Overview

The UI follows a macOS-native dark aesthetic with a space/purple accent theme. All design decisions are encoded as CSS custom properties in `src/renderer/styles/tokens.css`.

## Color Palette

### Backgrounds (Dark Space Theme)
| Token | Value | Usage |
|-------|-------|-------|
| `--bg-base` | `#0f0f1a` | App background |
| `--bg-surface` | `#1a1a2e` | Surface panels |
| `--bg-elevated` | `#252549` | Elevated elements |
| `--bg-card` | `#1e1e3a` | Card backgrounds |
| `--bg-hover` | `#2a2a50` | Hover states |
| `--bg-inset` | `#141428` | Inset inputs, progress tracks |
| `--bg-toolbar` | `rgba(22, 22, 40, 0.85)` | Navbar (with blur) |

### Accent (Purple)
| Token | Value |
|-------|-------|
| `--accent-400` | `#a78bfa` |
| `--accent-500` | `#8b5ff8` |
| `--accent-600` | `#7c3aed` |

### Glass/Vibrancy
| Token | Value | Usage |
|-------|-------|-------|
| `--glass-bg` | `rgba(30, 30, 58, 0.65)` | Translucent panels |
| `--glass-border` | `rgba(255, 255, 255, 0.08)` | Subtle borders |
| `--glass-blur` | `blur(20px)` | Navbar only |

## Typography

- **System font**: `-apple-system, BlinkMacSystemFont, 'SF Pro Display'`
- **Mono**: `'SF Mono', 'JetBrains Mono', 'Menlo'`
- **Scale**: `0.6875rem` (xs) to `2.25rem` (4xl)
- **Letter spacing**: `-0.01em` body, `-0.02em` headings

## Border Radius

macOS-generous rounding:
- `--radius-sm`: 6px
- `--radius-md`: 10px
- `--radius-lg`: 14px
- `--radius-xl`: 18px
- `--radius-full`: 9999px (pills)

## Component Patterns

### Segmented Control (Navbar)
Background `--bg-inset` container with 2px padding, child segments with `calc(--radius-md - 2px)` radius. Active segment gets `--bg-elevated` + shadow.

### Glass Cards (Sections, Course Progress)
`--glass-bg` background, `--glass-border` border, `--radius-lg` radius. No `backdrop-filter` on repeated items for performance.

### Pill Buttons (Play, Resume, Badge)
`--radius-full` radius, compact padding. Purple for play, yellow/warning for resume.

### macOS Toggle Switch (Settings)
Custom checkbox: 38x22px pill, 16px circle knob, slides on `:checked`. Uses `::before` pseudo-element.

## CSS Architecture

| File | Scope |
|------|-------|
| `tokens.css` | Design tokens (imported by global.css) |
| `global.css` | Layout, navbar, library, import, utilities, volume |
| `CourseView.css` | Course page (prefixed `cv-`) |
| `ModernVideoPlayer.css` | Player + controls (prefixed `pi-`) |
| `Settings.css` | Settings page |

### Rules
- No duplicate selectors across files
- Component CSS files imported by their component
- Specific `transition` properties, never `all`
- `backdrop-filter` only on navbar singleton
