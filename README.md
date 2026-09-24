# Explorer Touch Menu — V1 prototype

Touch-first radial menu for a 16" touchscreen laptop. Browser-only (Chrome / Edge).
Stack: React 19 · TypeScript · Vite 7 · Framer Motion 12 · Zustand 5 · Pointer Events.

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Bootstrap, tokens | done |
| 2 | Static main menu (8 items, hub, liquid connectors, icons) | done |
| 3 | Materialize reveal, idle breathing, reduced motion | done |
| 4 | Bouncing-ball attract loop, ripple, tap-to-relocate, one-finger drag, multi-touch safety | done |
| 5 | Collapsible submenus, outside-tap collapse, edge-aware submenu placement | done |
| 6 | Sub item → image card; drag to detach and move freely | done |
| 7 | Throw image cards to external screens (full-screen display windows) | done |
| — | Real touchscreen gate (QG-6) + two 32" screens on target hardware | pending |

## Behaviour

- **Load:** the menu fades in at the bottom-left corner and drifts slowly toward the top right,
  then keeps roaming to random spots across the window on smooth curves (never leaving the screen)
  until the first touch. The first touch stops it where it is (or glides it fully into view if it
  was still coming in); after that it only "breathes".
- **Tap empty space:** a water ripple appears at the exact touch point and the menu glides there
  (clamped so it never leaves the screen). Extra simultaneous fingers only ripple.
- **Drag** the hub, an item or the ring with one finger (10 px threshold) to move the menu; a drag never
  activates an item.
- **Item ring clock (idle only):** on load, and again after **15 s without any touch**, the ring of
  main items ticks round like a seconds hand, one slot per second: 2–3 ticks clockwise, a beat, 1–2
  ticks back (random each cycle). Any touch stops it. Labels stay upright and the hub stays still.
  It never ticks while a submenu is open.
- **Double-tap an item → rotate mode:** the hub shows *ROTATE · drag to turn* and the ring glows.
  Drag around the menu to turn the ring clockwise or anticlockwise (a flick keeps spinning, up to 4
  slots, and snaps to the nearest slot). Double-tap-and-drag in one motion also works. Leave rotate
  mode by double-tapping again, tapping the hub, tapping empty space, single-tapping an item (which
  then opens its submenu), or after 15 s idle.
- **Tap a main item or sub item:** a soft water ripple in the item's colour spreads from its center.
- **Tap a main item** (single tap; it waits 0.3 s to tell it from a double tap) to open its submenu; tap it again (or the hub, or empty space) to collapse it.
  If the submenu would not fit, it rotates around the item and, if needed, the menu glides just enough.
- **Tap a sub item** to show its image, tethered to the item. Tap the sub item again to hide it.
  **Drag the image** to detach it: it stays wherever you drop it (on top of everything, tap to bring
  to front, × to close). Attached images close with their submenu; detached ones stay.

## External screens (throw to display)

The laptop page is the **controller**; each external screen runs a **display** window
(`http://localhost:5173/?view=display`). Flick an image card toward a screen and it flies off the
laptop and appears on that screen, **full screen, edge to edge**, arriving from the side facing the
laptop. A newer throw replaces the image shown there.

Setup (once per session):

1. Windows **Display settings → "Extend these displays"**, and arrange the screens to match the desk
   (throw directions come from this arrangement).
2. Windows **Tablet PC Settings → Setup…** so touch maps to the laptop panel.
3. Open the controller on the laptop in Chrome/Edge (F11 for fullscreen) and tap **Open screens**
   (top right). Allow *"Manage windows on all your displays"* and pop-ups when asked, then tap again.
   A display window opens on each other screen.
4. If a display isn't full screen yet, click it once with a mouse or press F11 there (browsers
   require a gesture on that window; the app tries to hand over fullscreen automatically first).

Without the permission (or in another browser) just open the display URL on each screen yourself and
press F11 — the controller finds display windows automatically (they appear as "Screen 1", "Screen 2"
from left to right, and the top-right button shows how many are linked).

Throwing: drag a card and release while still moving (≈ 900 px/s or faster) toward the screen; while
dragging, glowing edge badges show which way each screen is. A slow release, or a flick where no screen
lies (±55°), just drops the card.

> Step-by-step local setup (install, run, external screens, troubleshooting): [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md)

## Prerequisites

Node.js **20.19+ or 22.12+** (required by Vite 7).

## Commands

```bash
npm install        # first time
npm run dev        # http://localhost:5173
npm run typecheck
npm test           # vitest unit tests (geometry, clamping, placement, store)
npm run build      # production build -> dist/
```

## Touchscreen testing

Open http://localhost:5173 in Chrome or Edge on the touchscreen laptop and press F11 for fullscreen.
Pinch-zoom, text selection, long-press menus and page scroll are suppressed on the surface.

## Layout

```
src/
  app/App.tsx                 viewport → layout → initial/resize clamping
  components/                 TouchSurface, Backdrop, RippleLayer, MainRadialMenu, MainMenuItem,
                              SubRadialMenu, MenuConnectorRing, ImageLayer (image cards), icons
  display/DisplayApp.tsx      display window for an external screen (?view=display)
  displays/                   protocol (BroadcastChannel), useDisplayLink (registry), openDisplays
                              (Window Management API), throwMath (velocity, target, edge badges)
  data/menuData.ts            8 main items × 5 sub-items, tones
  store/useExplorerStore.ts   Zustand: position, submenu, interaction + motion phase
  hooks/                      useViewport, usePointerDrag (single-owner tap-vs-drag recognizer), useClockTicks
  utils/                      radialGeometry, clampPosition, menuLayout (responsive sizing),
                              subMenuPlacement, cardPlacement, pointerRegistry (multi-touch),
                              sceneImage (procedural offline placeholder images)
  styles/                     tokens.css, explorer.css
  tests/                      unit tests
```

Menu motion is layered: **anchor** (x/y motion values, no re-render on move) → **reveal** (one-shot)
(the anchor is driven by the **drift** until first touch, `motionPhase === 'wandering'`,
`utils/wander.ts`) → **move scale** (compress before a
tap-move, pop on arrival) → **breath** (idle loop, only while `motionPhase === 'idle'`) → **rotor**
(item ring only, clock ticks from `ringStep`; items counter-rotate).

Note: the spec (3.1) asks for the menu to appear near the center; per stakeholder feedback it
instead drifts in from the bottom-left and roams the window until the first interaction.

## Known limitations

- Font "Sora" loads from Google Fonts; offline it falls back to Segoe UI.
- Hardware touch validation remains to be performed on the target 16-inch touchscreen laptop.
