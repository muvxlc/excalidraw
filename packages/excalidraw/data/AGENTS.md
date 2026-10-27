# EXCALIDRAW DATA KNOWLEDGE BASE

## OVERVIEW

Scene serialization, schema migrations, filesystem access, encryption, and library persistence (`score: 11`, distinct persistence domain).

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| Schema migrations | `restore.ts` | Normalizes legacy element/AppState versions to current format (page presets, fonts) |
| Blob decoding & files | `blob.ts` | Loads scene or library files from Blobs and extracts embedded images |
| JSON serialization | `json.ts` | Serializes and parses canvas JSON state, custom font assets, and library collections |
| Filesystem integration | `filesystem.ts` | File System Access API wrapper with `<input type="file">` fallback |
| Cryptography | `encryption.ts` | WebCrypto AES-GCM 128-bit key generation and payload encryption |
| Data compression | `encode.ts` | Deflate/Gzip compression streams, byte string and base64 conversions |
| Library state | `library.ts` | Jotai atom-backed library asset store, deduplication, and grid layout |
| Element reconciliation | `reconcile.ts` | Two-way CRDT element version reconciliation for collaboration |

## CONVENTIONS

- Migration on load: loading routines (`loadFromBlob`, `loadFromJSON`) never assume schemas match; all payloads run through `restoreElements()` and `restoreAppState()` (preserving `pagePreset`).
- Branded types: `ExportedElements` uses nominal branding (`_brand: "exportedElements"`) to prevent exporting un-sanitized elements.
- State persistence: AppState serialization preserves `pagePreset` and `pageOrientation` across export, localStorage, and database clean passes.
- Persistence adapters: library state interacts via `LibraryPersistenceAdapter` rather than raw browser storage directly.
- Embedded image metadata: serialized scene JSON is saved directly into PNG `tEXt` chunks or SVG XML comments.

## ANTI-PATTERNS

- Do not use deprecated `opts.getInitialLibraryItems`; always pass `opts.adapter`.
- Do not touch raw DOM APIs inside data adapters; DOM manipulation belongs strictly in UI layers.
- Do not perform secondary string decoding on compressed byte strings.
- Never allow transparent strokes on restored sticky note elements; outline stroke must remain visible.
- Do not mutate element ids during restoration migrations without updating container binding ids.

## COMMANDS

```bash
yarn test packages/excalidraw/data/library.test.ts # Run data tests
yarn test:typecheck                                # Check TypeScript types
```
