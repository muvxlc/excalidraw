# COMMON KNOWLEDGE BASE

## OVERVIEW

Monorepo-wide utilities, constants, data structures, event bus, and shared types (score: 15, distinct domain).

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| Core constants & presets | `src/constants.ts` | Theme, keys, canvas defaults, `PAGE_PRESETS`, `PagePreset`, `PageOrientation` |
| Utility functions | `src/utils.ts` | General helpers, viewport/scene transforms, `getPageDimensions` |
| Utility types | `src/utility-types.ts` | `Merge`, `Mutable`, `ValueOf`, `SubtypeOf` |
| Event bus & emitter | `src/appEventBus.ts`, `src/emitter.ts` | Decoupled cross-component communication |
| Data structures | `src/binary-heap.ts`, `src/queue.ts` | Priority queue, FIFO queue |
| Coordinate points | `src/points.ts` | Point math helpers, angle utilities |
| Async pooling & promises | `src/promise-pool.ts` | Concurrent promise limiter |
| Snapshot storage | `src/versionedSnapshotStore.ts` | In-memory versioned state snapshots |
| Color utilities | `src/colors.ts` | Color conversion, contrast, palette tools |
| Font metadata & assets | `src/font-metadata.ts` | Custom font metadata, `SceneFontAsset`, font format validators |
| Unit tests | `src/utils.test.ts`, `tests/` | Vitest suites (`*.test.ts`) |

## CONVENTIONS

- Import types from `@excalidraw/common/utility-types` for `Merge<Base, Overrides>`.
- Keep utilities pure and framework-agnostic; no React or DOM dependencies inside common primitives.
- Use `appEventBus` for decoupling cross-package event notifications without direct circular imports.
- Re-export all public symbols through `src/index.ts`.
- Page dimensions and presets use `PAGE_PRESETS` and `getPageDimensions` from common.
- Custom font asset types (`SceneFontAsset`, `FontFormat`) resolve in `font-metadata.ts`.

## ANTI-PATTERNS

- Using `Omit<Base, keyof Overrides> & Overrides` instead of `Merge<Base, Overrides>`.
- Importing from `@excalidraw/excalidraw` or `@excalidraw/element` into `@excalidraw/common` (circular dependency).
- Adding React state or hooks into common package utilities.
- Hardcoding theme colors or UI constants outside `src/constants.ts` and `src/colors.ts`.
- Hardcoding custom font shapes or page preset dimensions outside `font-metadata.ts` and `constants.ts`.
