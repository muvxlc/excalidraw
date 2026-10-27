# INTEGRATION EXAMPLES

## OVERVIEW

Reference consumer implementations demonstrating how to embed `@excalidraw/excalidraw` in Next.js (App Router/SSR) and Vite SPA environments (score 10, distinct domain).

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| Next.js App Router | `with-nextjs/src/app/page.tsx` | Page mounting client wrapper with dynamic import |
| Client wrapper (Next.js) | `with-nextjs/src/excalidrawWrapper.tsx` | `"use client"` component rendering Excalidraw canvas |
| Static assets directory | `with-nextjs/public/` | Public asset directory for static images and copied fonts |
| Next.js Pages Router | `with-nextjs/src/pages/excalidraw-in-pages.tsx` | Alternative Pages Router example page |
| Next.js root layout | `with-nextjs/src/app/layout.tsx` | HTML shell metadata and responsive viewport setup |
| Next.js bundler config | `with-nextjs/next.config.js` | Configures `transpilePackages: ["../"]` |
| Browser script SPA | `with-script-in-browser/components/ExampleApp.tsx` | Full-featured custom UI embedding Excalidraw |
| Browser initial data | `with-script-in-browser/initialData.tsx` | Initial scene elements and sample diagram data |
| Browser Vite config | `with-script-in-browser/vite.config.mts` | Standalone Vite configuration running on port 5002 |
| File system integration | `with-script-in-browser/utils.ts` | Integration with `browser-fs-access` for local files |
| Custom mobile UI | `with-script-in-browser/components/MobileFooter.tsx` | Compact controls for touch and mobile viewports |
| Custom example UI | `with-script-in-browser/components/` | Custom sidebar, custom footer, and mobile responsive controls |

## CONVENTIONS

- Workspace dependency: Examples consume local monorepo packages; run `yarn build:packages` before starting examples.
- SSR suppression: `@excalidraw/excalidraw` is browser-only (canvas/DOM). In Next.js, always load with `next/dynamic` using `{ ssr: false }`.
- Client component boundary: Next.js components rendering Excalidraw must declare `"use client"`.
- Style imports: Must import `@excalidraw/excalidraw/index.css` for canvas toolbar fonts and UI styles.
- Font asset staging: Next.js app requires static fonts copied to `public/fonts` via `yarn copy:assets` so custom fonts and canvas font face subsets resolve locally.
- Canvas sizing: Embedding page presets and paper sheet previews requires container with explicit width/height dimensions.
- Next.js typecheck bypass: `next.config.js` configures `typescript.ignoreBuildErrors: true` due to monorepo JSX config.
- Dev ports: Next.js dev server runs on port 3005; browser script example runs on port 5002.

## COMMANDS

```bash
yarn --cwd examples/with-nextjs dev             # Run Next.js example (port 3005)
yarn --cwd examples/with-nextjs copy:assets     # Copy font assets to public/
yarn --cwd examples/with-script-in-browser start # Run Vite SPA example (port 5002)
```

## ANTI-PATTERNS

- Server-side rendering Excalidraw: Never import or render `@excalidraw/excalidraw` directly in a Next.js Server Component.
- Missing stylesheet import: Omitting `@excalidraw/excalidraw/index.css` results in unstyled canvas and broken UI layouts.
- Missing font assets: Running Next.js without `yarn copy:assets` breaks custom font rendering and canvas text measurement.
- Running examples without package builds: Do not start examples against unbuilt package sources; rebuild packages on change.
- Direct DOM mutations: Do not manipulate canvas DOM directly; use `excalidrawAPI` methods (`updateScene`, `setToast`).
- Monorepo package drift: Do not add standalone dependencies to examples that conflict with root workspace peer dependencies.
