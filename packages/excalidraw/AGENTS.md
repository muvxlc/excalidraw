# EXCALIDRAW PACKAGE KNOWLEDGE BASE

## OVERVIEW

Core drawing canvas, React component library, and state coordinator for Excalidraw (`@excalidraw/excalidraw`). Subtree root (score 17).

## STRUCTURE

```
packages/excalidraw/
├── actions/     # Canvas command registry and keyboard shortcut handlers
├── components/  # React UI hierarchy, App canvas coordinator, LayerUI, modals
├── data/        # Serialization, schema version migrations, filesystem, library
├── renderer/    # Multi-tier canvas rendering engine, interactive overlays, SVG export
├── tests/       # Vitest integration test suite, UI/Pointer interaction harness
├── fonts/       # Split WOFF2 font glyph subsets and font face descriptors
├── charts/      # Spreadsheet data parsing and bar/line/radar chart generation
├── wysiwyg/     # Imperative canvas inline text editing overlay
└── scene/       # Canvas export pipeline (SVG/PNG) and coordinate normalization
```

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| Package entry | `index.tsx` | Main library exports, memoized `Excalidraw` wrapper |
| Canvas coordinator | `components/App.tsx` | Monolithic coordinator class for gestures and state |
| Command dispatch | `actions/` | Action registration and keybinding handling |
| State hydration | `data/restore.ts` | Schema migration pipeline across breaking versions |
| Canvas render loop | `renderer/` | Separate static, interactive, and SVG renderers |
| Custom font registry | `fonts/Fonts.ts` | Singleton managing system and custom scene font faces |
| Page preset handling | `actions/actionCanvas.tsx` | Page sheet bounds (A4, A5) and viewport normalization |
| Inline text editing | `wysiwyg/` | Imperative textarea overlay mounted on container |
| Scene export | `scene/export.ts` | PNG/SVG scene export and clipboard serialization |

## CONVENTIONS

- App coordination: `App.tsx` class component coordinates canvas, split into `App.*.ts` slice files.
- State updates: changes flow through `CaptureUpdateAction` (`NEVER`, `IMMEDIATELY`, `EVENTUALLY`) to manage undo stack and sync.
- Custom fonts: `Fonts` singleton registers and loads scene font assets with `ExcalidrawCustom_*` CSS family names.
- Page presets: canvas renders bounded paper sheets via `appState.pagePreset` (A4/A5) and `appState.pageModeEnabled`.
- Subpath exports: package exposes selective imports for `./common/*`, `./element/*`, and `./math/*`.
- Build pipeline: `yarn build:esm` runs `../../scripts/buildPackage.js` and generates typings via `tsc` to `dist/types`.

## ANTI-PATTERNS

- Never mutate canvas cursor via React style prop; use imperative `app.canvas.style.cursor` in `AppCursor`.
- Never add tests to `tests/regressionTests.test.tsx` (deprecated); use feature test suites.
- Never edit generated WebAssembly artifacts in `subset/` directly.
- Never bypass `restoreElements()` / `restoreAppState()` when deserializing external payloads.

## COMMANDS

```bash
yarn --cwd ./packages/excalidraw build:esm # Build ESM and types
yarn test                                  # Run Vitest test suite
yarn test:typecheck                        # Run TypeScript validation
yarn test:code                             # Lint JavaScript and TypeScript
```
