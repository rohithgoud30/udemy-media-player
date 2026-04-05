---
title: SOP -- Add a New Component
date: 2026-04-05T10:00:00Z
version: 1.0.0
applies_to: [src/renderer/components/]
risk_level: low
---

# SOP: Add a New Component

## Purpose

Ensure new components follow the project's conventions for file structure, CSS scoping, and TypeScript standards.

## Procedure

### 1. Create the component directory

```
src/renderer/components/
  NewComponent/
    NewComponent.tsx
    NewComponent.css
```

### 2. Write the component

```tsx
import React from "react";
import "./NewComponent.css";

const NewComponent: React.FC = () => {
  return (
    <div className="nc-container">
      {/* Use prefixed class names */}
    </div>
  );
};

export default NewComponent;
```

### 3. CSS rules

- **Import the CSS** in the component file (`import "./NewComponent.css"`)
- **Prefix all class names** with a short abbreviation (e.g., `nc-` for NewComponent)
- **Use design tokens** from `tokens.css` -- never hardcode colors, spacing, or fonts
- **Specify transition properties** explicitly (not `transition: all`)
- **No `backdrop-filter`** unless the component is a singleton (not rendered in a list)

### 4. TypeScript rules

- No `any` types. Use `unknown` with narrowing or define interfaces.
- Props interface defined at the top of the file.
- Catch blocks: `catch (err: unknown)` with `err instanceof Error` guard.

### 5. Add the route (if page-level)

In `App.tsx` `AppShell`, add the route inside `<Routes>`:

```tsx
<Route path="/new-page" element={<NewComponent />} />
```

If the page should hide the navbar, update the `isPlayerRoute` check or add a similar condition.

## Verification

- Component renders without errors
- CSS doesn't conflict with existing selectors (check for name collisions)
- `pnpm run build` passes cleanly
- No `any` types in the file
