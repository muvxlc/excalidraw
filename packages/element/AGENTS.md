# ELEMENT KNOWLEDGE BASE

## OVERVIEW

Core canvas element manipulation, rendering, bounds, collision, and transform logic (score: 15, distinct domain).

## STRUCTURE

```
packages/element/
├── src/        # Element definitions, factories, transforms, math, rendering, caches
│   └── arrows/ # Elbow and linear arrow control point focus and dragging helpers
└── tests/      # Vitest unit and integration test suites for element math and behaviors
```

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| Element definitions & types | `src/types.ts` | `ExcalidrawElement`, `NonDeleted`, `ElementsMap`, `fontRef` |
| Mutation & versioning | `src/mutateElement.ts` | Updates version/versionNonce, clears `ShapeCache` |
| Element instantiation | `src/newElement.ts` | Factory functions for shapes, text (custom fonts), arrows |
| Bounds & hit testing | `src/bounds.ts`, `src/collision.ts` | Common bounding boxes, element collision |
| Transforms & resizing | `src/transform.ts`, `src/resizeElements.ts` | Rotation, scale, handle calculations |
| Linear elements & arrows | `src/linearElementEditor.ts`, `src/elbowArrow.ts` | Point editing, routing, binding |
| Arrow focus & helpers | `src/arrows/focus.ts`, `src/arrows/helpers.ts` | Arrow control points and dragging |
| Element binding | `src/binding.ts` | Arrow-to-shape binding and updates |
| Z-indexing & ordering | `src/zindex.ts`, `src/fractionalIndex.ts` | Fractional index ordering, reordering |
| Text wrapping & measure | `src/textWrapping.ts`, `src/textMeasurements.ts` | Text layout, custom font metrics |
| Element rendering | `src/renderElement.ts` | RoughJS and canvas draw routines, fontRef handling |
| Element shape cache | `src/shape.ts` | Cached RoughJS drawn shapes |
| Element grouping | `src/groups.ts` | Group id tracking and group selection |
| Unit & integration tests | `tests/`, `src/__tests__/` | Vitest suites (`*.test.ts`, `*.test.tsx`) |

## CONVENTIONS

- Always mutate elements through `mutateElement()`; updates `version`, `versionNonce`, and clears `ShapeCache`.
- Use `hashElementsVersion` to compute version hashes; never use deprecated `getSceneVersion`.
- Filter deleted elements with `isNonDeletedElement` or `getNonDeletedElements` type guards.
- Prefer `ElementsMap` (`Map<string, ExcalidrawElement>`) over array searches for O(1) lookups.
- Keep `created` immutable; lifetime metadata set once during construction.
- Use fractional indexing (`src/fractionalIndex.ts`) for deterministic order key generation.
- Custom fonts: text elements use `fontRef?: FontAssetId | null` for external typography assets.

## ANTI-PATTERNS

- Direct property mutation on element objects (bypasses `ShapeCache` invalidation and collaboration sync).
- Using `getSceneVersion` (unsafe across collaboration; use `hashElementsVersion`).
- Re-exporting non-element app logic from this package; keep element domain self-contained.
- Manual array index slicing for ordering; use fractional indexing functions from `src/fractionalIndex.ts`.
- Omitting `isDeleted` checks when traversing element collections.

## COMMANDS

```bash
yarn --cwd packages/element build:esm # Build ESM and TypeScript declarations
yarn test packages/element/tests/     # Run element test suite
yarn test:typecheck                   # Run TypeScript validation across workspaces
```
