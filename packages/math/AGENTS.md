# MATH KNOWLEDGE BASE

## OVERVIEW

Pure 2D mathematical primitives: geometry, vectors, curves, polygons, and intersections (score: 15, distinct domain).

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| Geometry types | `src/types.ts` | Branded types: `GlobalPoint`, `LocalPoint`, `Radians`, `Degrees` |
| Vector arithmetic | `src/vector.ts` | Add, subtract, dot product, cross product, normalize, distance |
| Point utilities | `src/point.ts` | Point transformations, centroid, rotation, distance |
| Curves & Bezier | `src/curve.ts` | Bezier curve evaluation, splitting, curvature, bounds |
| Line & segments | `src/line.ts`, `src/segment.ts` | Line equations, segment intersection, point-to-segment distance |
| Polygons & triangles | `src/polygon.ts`, `src/triangle.ts` | Convex hull, polygon containment, area, centroid |
| Rectangles & ranges | `src/rectangle.ts`, `src/range.ts` | Bounding box intersections and range clamp helpers |
| Ellipses | `src/ellipse.ts` | Ellipse geometry, focus, arc calculations |
| Angle conversions | `src/angle.ts` | Radians to degrees, angle normalization, point angle |
| Dimensionality & PCA | `src/pca.ts` | Principal component analysis for shape fitting |
| Math test suites | `tests/` | Precision geometry tests (`*.test.ts`) |

## CONVENTIONS

- Points are 2D tuple pairs `[x, y]` rather than objects `{x, y}`.
- Use branded types (`Radians`, `Degrees`, `GlobalPoint`, `LocalPoint`) to prevent mixing coordinate spaces.
- Keep math routines strictly pure: zero side effects, no DOM or canvas dependencies.
- Re-export all mathematical functions through `src/index.ts`.
- Subpath imports supported via package exports (e.g. `@excalidraw/math/curve`).

## ANTI-PATTERNS

- Converting tuples `[x, y]` to `{x, y}` coordinates in new code (legacy `GlobalCoord` is deprecated).
- Mixing radian and degree values without explicit conversion helpers in `src/angle.ts`.
- Introducing stateful caches or side effects inside pure math calculations.
- Depending on UI packages, element types, or DOM APIs within `@excalidraw/math`.
