# EXCALIDRAW COMPONENTS KNOWLEDGE BASE

## OVERVIEW

React UI hierarchy, canvas overlays, modal dialogs, and App coordinator slices (`score: 14`, distinct UI domain).

## STRUCTURE

```
packages/excalidraw/components/
├── App.*.ts         # Monolithic App controller logic decomposed by domain
├── TTDDialog/       # Text-to-Diagram AI dialog, Mermaid converter, chat panel
├── ColorPicker/     # Custom color picker popovers and pointer-capture drag-drop
├── FontPicker/      # Font selection list with live preview and top-picks D&D
├── Sidebar/         # Compound docking sidebar component with Jotai atom
├── dropdownMenu/    # Compound menu components with keyboard selection handlers
├── CommandPalette/  # Global command search and shortcut palette
├── Stats/           # Canvas element metrics and multi-dimension editor
└── canvases/        # Layered canvas elements (Interactive, Static, NewElement)
```

## WHERE TO LOOK

| Task | Location | Notes |
| --- | --- | --- |
| Canvas event orchestration | `App.tsx` | Main class component managing pointer gestures and lifecycle |
| Selection interaction | `App.selectionTool.ts` | Multi-element transform gestures and drag handlers |
| Viewport & coordinates | `App.viewport.ts` | Zoom, pan, and viewport coordinate normalization |
| Text editing logic | `App.text.ts` | Text editing state and container-bound text sync |
| UI chrome wrapper | `LayerUI.tsx` | Hosts toolbars, sidebars, context menus, and footer |
| Sidebar docking | `Sidebar/Sidebar.tsx` | Docking sidebar using `isSidebarDockedAtom` |
| Fast color selection | `ColorPicker/` | Color swatches with custom `colorTopPicksDnD` |
| Font picker & preview | `FontPicker/` | Font family dropdown, custom font support, top-picks D&D |
| Main menu & presets | `main-menu/DefaultItems.tsx` | Menu items, canvas actions, page preset selector (A4/A5) |
| Text-to-Diagram AI | `TTDDialog/` | AI prompt dialog with streaming SSE client |

## CONVENTIONS

- Companion file architecture: `App.tsx` delegates interaction logic to `App.<slice>.ts` companion modules.
- Compound components: components (`Sidebar`, `dropdownMenu`) export subcomponents attached via static properties.
- Colocated styling: SCSS files live alongside TSX files (`LayerUI.scss`, `Sidebar/Sidebar.scss`).
- Pointer capture drag: drag interactions (`TopPicksDnD`, `ColorPicker`, `FontPicker`) use pointer capture instead of HTML5 drag-and-drop.

## ANTI-PATTERNS

- Never set canvas cursor via React component props; call `app.canvas.style.cursor` directly.
- Never close dropdown menus during theme toggle actions; preserve menu state.
- Never clear element selections during active lasso selection drags.
- Do not notify external consumers while the canvas scene is in loading state.
- Do not memoize top-picks swatches in `ColorPicker` across render cycles.

## COMMANDS

```bash
yarn test packages/excalidraw/components # Run components unit tests
yarn test:typecheck                     # Validate TypeScript types
```
