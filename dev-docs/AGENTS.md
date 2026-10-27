# DEVELOPER DOCUMENTATION

## OVERVIEW

Docusaurus v3 developer documentation site with live interactive Excalidraw playground and API guides (score 10, distinct domain).

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| Site configuration | `docusaurus.config.js` | Site metadata, navigation, presets, port 3003 config |
| Navigation sidebar | `sidebars.js` | Sidebar hierarchy for documentation categories |
| Live code scope | `src/theme/ReactLiveScope/index.js` | Injects `Excalidraw` component and utils into react-live |
| MDX components | `src/theme/MDXComponents.js` | Swizzled Docusaurus theme components for custom tags |
| Initial canvas data | `src/initialData.js` | Pre-populated drawing elements displayed in demo canvases |
| Homepage layout | `src/pages/index.tsx` | Landing page layout and hero sections |
| Code highlighter | `src/components/Highlight.js` | Custom syntax highlight helper for doc samples |
| Global styles | `src/css/custom.scss` | Docusaurus theme overrides and custom styles |
| Codebase architecture | `docs/codebase/` | Internal repository architecture and contributor guides |
| API reference docs | `docs/@excalidraw/excalidraw/api/` | Markdown and MDX documentation for public APIs |

## CONVENTIONS

- Port assignment: Dev server runs on port 3003 (`yarn start`).
- SSR DOM guarding: `@excalidraw/excalidraw` relies on browser DOM; must guard with `ExecutionEnvironment.canUseDOM` before importing.
- React live playground: Components used inside interactive code blocks must be registered in `ReactLiveScope`.
- Theme synchronization: Canvas theme must synchronize with Docusaurus dark/light state via `useColorMode()`.
- Preact suppression: Must keep `process.env.IS_PREACT = "false"` in `docusaurus.config.js` to avoid runtime bundle mismatch.
- Broken links: Docusaurus configured with `onBrokenLinks: "throw"`; all internal doc links must resolve.
- Asset path fallback: `ReactLiveScope` configures fallback `window.EXCALIDRAW_ASSET_PATH` for custom font glyphs and static asset loading.
- Custom fonts & page presets: Interactive doc samples using custom font loading or page setup presets require active DOM and initialized asset paths.

## COMMANDS

```bash
yarn start      # Start Docusaurus dev server (port 3003)
yarn build      # Build static docs bundle (docusaurus build)
yarn typecheck  # Run TypeScript validation
```

## ANTI-PATTERNS

- Top-level Excalidraw imports: Never import `@excalidraw/excalidraw` at module root in SSR files; crashes Node during `docusaurus build`.
- Direct DOM access in Docusaurus SSR: Never call `document` or `window` in doc components without checking `canUseDOM`.
- Hardcoded asset URLs: Do not point live examples to ad-hoc external CDNs; use configured `EXCALIDRAW_ASSET_PATH`.
- Untracked markdown routes: Do not add `.mdx` files without updating `sidebars.js` navigation.
