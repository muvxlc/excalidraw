# EXCALIDRAW APP

## OVERVIEW

Standalone web application client embedding `@excalidraw/excalidraw` with Firebase persistence, WebRTC/WebSocket collaboration, and export tooling (score 34, high complexity).

## STRUCTURE

```
excalidraw-app/
├── app-language/  # Language state, detector, selector modal
├── collab/        # Real-time room socket client, encryption, follow mode
├── components/    # App shell UI: debug canvas, AI modal, sidebar, export
├── data/          # Persistence adapters: LocalData, Firebase, IndexedDB, tabSync
├── share/         # Room share dialog, QR code generator chunk
└── tests/         # App-level Vitest integration tests and snapshots
```

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| App entry & root render | `index.tsx` | Service worker registration, `window.__EXCALIDRAW_SHA__` |
| Main shell & state | `App.tsx` | Scene coordination, storage debounce, room join lifecycle |
| Vite bundler & aliases | `vite.config.mts` | Aliases `@excalidraw/*` to package sources, root `envDir` |
| Collab sync & sockets | `collab/Collab.tsx` | Room coordination, user following, element broadcast |
| Room crypto transport | `collab/Portal.tsx` | Web Crypto API encryption/decryption for socket payloads |
| Cloud storage | `data/firebase.ts` | Firestore scene save/load, binary file chunks |
| Local persistence | `data/LocalData.ts` | LocalStorage quota handling, IndexedDB storage engine |
| Multi-tab sync | `data/tabSync.ts` | BroadcastChannel element and scene sync across tabs |
| App Jotai store | `app-jotai.ts` | App-isolated Jotai atom instances and hooks |
| App Main Menu & Page Setup | `components/AppMainMenu.tsx` | Mounts `MainMenu.DefaultItems.PageSetup` for page presets |
| Constants & keys | `app_constants.ts` | `STORAGE_KEYS`, sync and save debounce intervals |

## CONVENTIONS

- Jotai imports: Import from `./app-jotai` (or `editor-jotai`), never directly from `jotai`.
- DOM context: Prefer `app.ownerDocument`/`app.ownerWindow` over global `window`/`document`.
- Env variables: Prefix with `VITE_APP_`, stored in repository root `.env.*` (not in `excalidraw-app/`).
- Font loading: Embedded custom fonts served via woff2 plugin with `EXCALIDRAW_ASSET_PATH`; custom uploaded fonts persist via font storage.
- Page setup: Canvas page setup mounted via `MainMenu.DefaultItems.PageSetup` in `AppMainMenu.tsx`.
- History bypass: Use `CaptureUpdateAction.NEVER` for non-undoable remote scene updates and initial loads.

## ANTI-PATTERNS

- Direct Jotai imports: Lint rule `no-restricted-imports` forbids `import from "jotai"`.
- Barrel imports in app: Do not import from `@excalidraw/excalidraw` index barrel when submodule imports apply.
- Window globals in headless/iframe: Never assume root window; resolve from active canvas owner window.
- Hardcoded storage keys: Always reference keys defined in `app_constants.ts`.
