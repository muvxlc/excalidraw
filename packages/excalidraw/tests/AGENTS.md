# EXCALIDRAW TESTS KNOWLEDGE BASE

## OVERVIEW

Vitest integration test suite, UI and pointer interaction simulator, and test fixtures (`score: 14`, distinct test domain).

## STRUCTURE

```
packages/excalidraw/tests/
├── helpers/     # Canvas gesture drivers (UI, Pointer, Keyboard), mock stubs, polyfills
├── fixtures/    # Element, diagram, and image mock data
├── queries/     # Custom Testing Library queries for tools and text editor
├── data/        # Persistence, schema restore, and reconciliation test suites
├── scene/       # Canvas export and visual snapshot tests
└── packages/    # Integration events and package packaging tests
```

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| Test harness wrapper | `test-utils.ts` | Custom `render()` overriding Testing Library with canvas tracking |
| Interaction simulation | `helpers/ui.ts` | `UI`, `Pointer`, and `Keyboard` simulators for canvas gestures |
| Programmatic state API | `helpers/api.ts` | `API` helper to mutate selection, elements, and history checkpoints |
| Mock services | `helpers/mocks.ts` | Stubs for `throttleRAF`, `MermaidToExcalidraw`, and `HTMLImageElement` |
| Environment polyfills | `helpers/polyfills.ts` | Mocks `PointerEvent`, `ResizeObserver`, and `fake-indexeddb` |
| Element & diagram fixtures | `fixtures/` | Standard element and diagram mock objects |
| Page presets & canvas | `canvas/pagePresets.test.ts` | Page preset dimensions, serialization, and sheet render |
| Font loading suites | `fonts/` | Font loading, FontFace stubs, and metric assertions |
| Global test config | `setupTests.ts` | Canvas mock registration, FontFace stubs, and DOM error pruning |

## CONVENTIONS

- Runner config: Vitest in `jsdom` with `globals: true` and `sequence.hooks: "parallel"`.
- Canvas simulation: pointer clicks and drags must use `Pointer` or `UI` helper classes rather than dispatching raw DOM events.
- DOM error filtering: Testing Library DOM serialization is suppressed on failure unless `VITE_DEBUG_DOM=true`.
- Scene await hack: tests await `app.initialScene()` to resolve render race conditions before running assertions.

## ANTI-PATTERNS

- DO NOT ADD TESTS TO `regressionTests.test.tsx` (deprecated); add feature-specific test files.
- Do not ignore missing React `act()` warnings; wrap state-triggering canvas updates in `act()`.
- Always wait for async clipboard paste operations (`await sleep(50)`) before querying elements.
- Do not dispatch raw DOM click events on the canvas; use `UI.clickTool()` or `Pointer.click()`.

## COMMANDS

```bash
yarn test:app                          # Run Vitest test suite
yarn test packages/excalidraw/tests/<file> # Run specific test file
yarn test:update                       # Update snapshot files
yarn test:coverage                     # Run coverage suite
```
