# PROJECT KNOWLEDGE BASE

**Generated:** 2026-10-27 00:00:00 UTC
**Commit:** a80f1263
**Branch:** master

## OVERVIEW
Virtual whiteboard for sketching hand-drawn diagrams, built as a TypeScript monorepo with React 19, Canvas 2D, Vite, and Jotai. Publishes standalone NPM packages alongside reference web application, developer documentation, and examples.

## STRUCTURE
```
excalidraw/
├── excalidraw-app/     # Standalone web app, Firebase persistence, zero-knowledge WebRTC/WebSocket sync
├── packages/
│   ├── common/         # Foundation utilities, constants, event bus, custom font metadata, page presets
│   ├── element/        # Element schema, mutateElement, bounds, collisions, fractional indexing, shapes cache
│   ├── excalidraw/     # Core <Excalidraw /> component, multi-tier canvas renderer, Fonts registry, App coordinator
│   └── math/           # Pure 2D geometry primitives, branded tuple coordinates (GlobalPoint/LocalPoint)
├── dev-docs/           # Docusaurus v3 documentation site with live interactive canvas playground
├── examples/           # Consumer reference integrations (SSR-suppressed Next.js 14, Vite)
└── scripts/            # CommonJS build automation, esbuild bundlers, wasm base64 codegen, woff2 font plugins
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Canvas UI & component entry | `packages/excalidraw/index.tsx` | Main `<Excalidraw />` export and core API helpers |
| State dispatch & pointer gestures | `packages/excalidraw/components/App.tsx` | Central coordinator class with companion slice modules |
| Element creation & mutation | `packages/element/src/mutateElement.ts` | Required entrypoint for updating version, nonce, and ShapeCache |
| Custom fonts & asset metrics | `packages/excalidraw/fonts/Fonts.ts` | Singleton managing built-in and dynamic `SceneFontAsset` loading |
| Page presets (A4/A5) canvas | `packages/excalidraw/renderer/staticScene.ts` | Paper bounds rendering and `actionChangePagePreset` handling |
| Canvas multi-tier rendering | `packages/excalidraw/renderer/` | Three canvases: static elements, interactive overlays, active drafting |
| 2D geometry & vector math | `packages/math/src/` | Branded tuples (`GlobalPoint`, `LocalPoint`, `Radians`, `Degrees`) |
| Shared types & event bus | `packages/common/src/` | `Merge<Base, Overrides>`, `appEventBus`, font metadata |
| Collab sync & encryption | `excalidraw-app/collab/` & `excalidraw-app/data/` | WebSockets, WebCrypto AES zero-knowledge encryption, Firestore |
| Build & bundling toolchain | `scripts/buildPackage.js` | esbuild configs for packages, fonts, and wasm loaders |

## CODE MAP
| Symbol | Type | Location | Refs | Role |
|--------|------|----------|------|------|
| Excalidraw | Component | `packages/excalidraw/index.tsx:401` | 585 | Primary React public entrypoint |
| App | Class | `packages/excalidraw/components/App.tsx:580` | 329 | Central canvas state and event coordinator |
| mutateElement | Function | `packages/element/src/mutateElement.ts:40` | 244 | Updates element properties, version, and shapes cache |
| CaptureUpdateAction | Const | `packages/element/src/store.ts:38` | 333 | Gates undo/redo capture and remote collab broadcast |
| Fonts | Class | `packages/excalidraw/fonts/Fonts.ts:50` | 42 | Custom and built-in font loader and metrics registry |
| hashElementsVersion | Function | `packages/element/src/index.ts:21` | 7 | djb2 hash over versionNonce for scene versioning |
| Merge | Type | `packages/common/src/utility-types.ts:7` | 11 | Preferred type override utility over Omit/intersection |

## CONVENTIONS
- DOM/browser APIs: use `app.ownerDocument` and `app.ownerWindow` instead of globals; without `app`, derive from mounted node's `ownerDocument` and its `defaultView`.
- Type overrides: prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` over `Omit<Base, keyof Overrides> & Overrides`.
- Coordinate representation: use 2D tuple points `[x, y]` with branded types (`GlobalPoint`, `LocalPoint`, `Radians`) from `@excalidraw/math`; avoid object `{x, y}` coordinates in new code.
- State access in web app: import Jotai atoms strictly from `excalidraw-app/app-jotai` or `editor-jotai`, never raw `jotai` (`no-restricted-imports`).
- Collection lookups: use `ElementsMap` (`Map<string, ExcalidrawElement>`) for O(1) queries; check non-deleted state with `isNonDeletedElement`.
- Update classification: pass `CaptureUpdateAction.NEVER` for remote sync updates or scene hydration to bypass local undo history.
- Element ordering: element z-order is determined strictly by fractional indexing keys (`fractionalIndex.ts`); never reorder arrays manually without updating keys.
- Scripts format: workspace packages use ES modules, but all files in `scripts/` use CommonJS (`require` / `module.exports`).

## ANTI-PATTERNS (THIS PROJECT)
- NEVER mutate `ExcalidrawElement` directly; always call `mutateElement()` to update `version`/`versionNonce` and invalidate `ShapeCache`.
- NEVER use deprecated `getSceneVersion` (can overflow/collide); use `hashElementsVersion()`.
- NEVER introduce circular dependencies between `@excalidraw/common`, `@excalidraw/math`, and `@excalidraw/element`.
- NEVER render `@excalidraw/excalidraw` in server-side rendering (SSR); wrap with dynamic imports `{ ssr: false }` or guard with DOM availability checks.
- NEVER set canvas cursor via React state or CSS style props; modify `app.canvas.style.cursor` directly.
- NEVER bypass `restoreElements()` and `restoreAppState()` when deserializing stored scene payloads.
- NEVER edit generated WebAssembly loaders in `packages/excalidraw/subset/` or `scripts/wasm/`; generated files marked `// GENERATED CODE -- DO NOT EDIT!`.

## UNIQUE STYLES
- Multi-tier canvas rendering: separated into static elements (`staticScene.ts`), interactive overlays/cursors (`interactiveScene.ts`), and active drafting (`renderNewElementScene.ts`).
- Companion slice decomposition: monolithic `App.tsx` logic separated into `App.*.ts` domain files sharing `App` instance context.
- Zero-knowledge collaboration: room IDs and AES keys live in URL hash (`#room=<id>,<key>`); payloads encrypted locally before WebSockets transit.
- Dynamic custom font assets: `SceneFontAsset` runtime loading with registered font-face promises and canvas measure cache.

## COMMANDS
```bash
yarn start                # Start excalidraw-app dev server
yarn build:packages       # Build all package bundles and types (common, math, element, excalidraw)
yarn test:app             # Run Vitest test suite
yarn test:typecheck       # Run TypeScript compiler checks (tsc)
yarn test:code            # Run ESLint across entire repository
```

## NOTES
- Workspace package consumption: `excalidraw-app` aliases packages in Vite dev mode; run `yarn build:packages` before running examples or consumer tests.
- Web app environment variables: configured in root `.env.*` files but read by Vite via `envDir: "../"`; variables must be prefixed with `VITE_APP_`.
- Scene metadata persistence: PNG exports embed scene JSON in PNG `tEXt` chunks; SVG exports embed metadata in XML comments.

