# EXCALIDRAW RENDERER KNOWLEDGE BASE

## OVERVIEW

Multi-tier 2D canvas render pipelines, interactive overlays, animations, and SVG export (`score: 9`, distinct rendering domain).

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| Interactive overlay | `interactiveScene.ts` | Selection bounds, rotation/transform handles, remote cursors, laser trail |
| Static canvas render | `staticScene.ts` | Background elements, frame clipping, zoom scale caching, page preset paper sheet |
| SVG export rendering | `staticSvgScene.ts` | Generates static SVG DOM element tree for scene exports |
| In-progress elements | `renderNewElementScene.ts` | Renders active drawn shape before canvas commit |
| Canvas math & DPI | `helpers.ts` | Device pixel ratio scaling, canvas bootstrap, coordinate snapping |
| Canvas animation | `animation.ts` | Animation controller for laser trails and smooth viewport pans |
| Snapping guides | `renderSnaps.ts` | Renders geometric alignment snap lines and points |
| Rounded shapes | `roundRect.ts` | Rounded rectangle canvas path drawing routine |

## CONVENTIONS

- Three-tier canvas architecture: separate canvases for static elements, interactive overlays, and new element creation.
- Direct context API: canvas logic uses 2D canvas context commands directly for 60fps performance without React overhead.
- Page preset paper sheet: static scene renders paper sheet bounds when `appState.pageModeEnabled && appState.pagePreset` is set.
- High-DPI handling: canvas dimensions are normalized and scaled using devicePixelRatio via `bootstrapCanvas()`.
- Throttled renders: static and new-element canvas updates provide throttled variants (`renderStaticSceneThrottled`).

## ANTI-PATTERNS

- Do not show transform handles when inline text editor is active or element is in crop mode.
- Do not register animations under active keys without canceling prior animation frame callbacks.
- Never leave dirty background frames on screen; force clear canvas when opacity state is indeterminate.
- In SVG export, never violate strict compositing order `[background, stroke]`.
- Do not manually mutate canvas dimensions inside export pipelines; handled by export lifecycle.

## COMMANDS

```bash
yarn test:app packages/excalidraw/renderer/helpers.test.ts # Run renderer unit tests
yarn test:typecheck                                       # Check TypeScript types
```
