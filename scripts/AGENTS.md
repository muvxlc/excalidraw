# BUILD & RELEASE SCRIPTS

## OVERVIEW

Node.js build automation, esbuild bundler configuration, Wasm codegen, woff2 font plugins, and package release pipeline (score 18, distinct domain).

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| Package bundling | `buildPackage.js` | esbuild config compiling packages with SCSS & woff2 plugins |
| Base esbuild setup | `buildBase.js` | Base esbuild config for monorepo packages |
| Shared build utilities | `buildUtils.js` | Shared esbuild helper methods and sassPlugin configuration |
| Wasm to JS inlining | `buildWasm.js` | Encodes wasm binaries to base64 JS module loaders |
| Woff2 esbuild plugin | `woff2/woff2-esbuild-plugins.js` | Compresses and inlines woff2 fonts for package output |
| Woff2 Vite plugin | `woff2/woff2-vite-plugins.js` | Rewrites font paths to `EXCALIDRAW_ASSET_PATH` / CDN |
| Version generation | `build-version.js` | Injects Git commit SHA and build timestamp into build output |
| Doc change detection | `buildDocs.js` | Inspects git diff to identify modified doc files |
| Monorepo release | `release.js` | Automated version bumps, changelog updates, and npm publishing |
| Changelog updates | `updateChangelog.js` | Generates changelog entries from Git commits |
| Locales coverage | `locales-coverage-description.js` | Computes translation completion against Crowdin maps |
| Locales build | `build-locales-coverage.js` | Flattens translations and calculates language percentages |
| Node canvas build | `build-node.js` | Builds Node.js-compatible bundle with Cairo canvas |
| Custom fonts / page presets | `woff2/` | Woff2 browser/server plugins supporting custom font subsetting and loading |

## CONVENTIONS

- CommonJS execution: Scripts run directly under Node.js (`require`, `module.exports`); not transpiled.
- Sass bundling: CSS/SCSS files compiled into packages using `esbuild-sass-plugin`.
- Wasm generation: Binary `.wasm` files converted to base64 string modules with header `// GENERATED CODE -- DO NOT EDIT!`.
- Asset path consistency: Font loaders must resolve assets via `EXCALIDRAW_ASSET_PATH` or fallback CDN.
- Independent package releases: `release.js` handles core packages (`common`, `math`, `element`, `excalidraw`); `utils` releases separately.
- Build metadata: Output bundles inject git commit SHA and ISO build timestamp into `build/version.json`.

## ANTI-PATTERNS

- Manual edits to generated Wasm loaders: Never edit `harfbuzz-wasm.ts` or `woff2-wasm.ts` directly; regenerate via `buildWasm.js`.
- Hardcoding font paths: Do not bypass `woff2-vite-plugins.js` or `woff2-esbuild-plugins.js` asset resolution.
- Direct git push during release: Always use `release.js` flow to ensure changelog and version tags stay synchronized.
- Checking in Cairo canvas dependencies: Do not commit `canvas` npm package; install temporarily for node builds.
