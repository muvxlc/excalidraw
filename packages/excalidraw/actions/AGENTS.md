# EXCALIDRAW ACTIONS KNOWLEDGE BASE

## OVERVIEW

Command action registry, keyboard shortcuts, and state delta transformers (`score: 14`, distinct action domain).

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| Action dispatch & lifecycle | `manager.tsx` | `ActionManager` executes actions, keybindings, and context menus |
| Action type contracts | `types.ts` | Type definitions for `Action`, `ActionFn`, `ActionResult` |
| Style & visual properties | `actionProperties.tsx` | Stroke color, background color, fill style, opacity, font |
| Element transformations | `actionZindex.tsx` | Bring forward, send backward, and z-index reordering |
| Viewport & page presets | `actionCanvas.tsx` | Zoom controls, theme toggling, `actionChangePagePreset` (A4/A5) |
| Drawing completion | `actionFinalize.tsx` | Commits active drawing and wraps bound text |
| Text shape binding | `actionBoundText.tsx` | Bind and unbind text elements to geometric containers |
| Selection & clipboard | `actionClipboard.tsx` | Copy, cut, and paste serialization triggers |

## CONVENTIONS

- Action definition helper: actions register via `register()` helper returning a typed `Action` configuration object.
- Pure state transformations: `perform()` methods return immutable diff `{ elements?, appState?, files?, captureUpdate }` or `false`.
- History and sync flags: each action specifies `captureUpdate` enum (`CaptureUpdateAction.EVENTUALLY`, `NEVER`, `IMMEDIATELY`) controlling history stack recording and remote broadcast.
- Embedded action UI: action declarations co-locate their toolbar/panel control JSX via `PanelComponent`.
- Page presets: `actionChangePagePreset` updates `pagePreset` ("A4"/"A5"/null), recalculates sheet dimensions, and preserves center.
- Analytics hooks: action metadata defines `trackEvent` predicates for mobile/desktop interaction analytics.

## ANTI-PATTERNS

- Do not capture stale element or AppState references inside action closures; resolve state from `perform()` arguments at execution time.
- Do not bypass `ActionManager`; trigger state changes through `actionManager.executeAction()` rather than manual state setting.
- Do not re-allocate element arrays if no elements changed during action execution.
- Do not perform alignment or distribution on frames until hierarchy boundaries are validated.
- Do not duplicate history recordings for elements finalized via `app.drawShape.finalize()`.

## COMMANDS

```bash
yarn test packages/excalidraw/actions # Run action unit tests
yarn test:typecheck                  # Typecheck action signatures
```
