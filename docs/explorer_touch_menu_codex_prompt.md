# Codex / AI Coding Agent Master Prompt
## Explorer Touch Menu Prototype

You are the senior frontend engineer responsible for implementing a touch-first interactive prototype called **Explorer Touch Menu Prototype**.

Your job is not merely to generate code. You must implement, test, inspect, correct, and repeatedly validate the application until all required quality gates pass.

Do not skip failures. Do not declare completion when core interactions are unverified.

---

# 1. Objective

Create a polished React application for a touchscreen laptop that runs entirely in a modern browser.

V1 is browser-only.

Do not implement external monitor control, Electron, kiosk mode, native display APIs, or physical hardware integration.

The interface consists of:

- a movable connected circular main menu
- 8 main menu items
- a central hub
- water-ripple feedback at touch points
- touch-to-relocate behavior
- one-finger drag behavior
- nested circular submenu behavior
- outside-tap collapse behavior
- smooth animations
- edge-aware menu positioning
- safe handling of multiple simultaneous touch pointers
- independent ripple feedback for multiple fingers

The finished V1 runs locally in Chrome or Edge on the touchscreen laptop.

---

# 2. Required Technology

Use:

- React
- TypeScript
- Vite
- Framer Motion
- Zustand
- Pointer Events
- CSS or CSS Modules

Optional:

- Lucide React for icons
- Vitest
- Playwright

Do not use:

- Unity
- Unreal
- Electron
- backend services
- database
- WebSocket
- cloud services

unless explicitly required later.

---


# 2.1 Initial Visual State and First Interaction

The application must open with an intentional, polished initial state.

## Initial reveal

Required sequence:

1. render the dark background immediately
2. wait approximately 300–500 ms
3. reveal the main menu near the center of the viewport
4. animate:
   - opacity 0 → 1
   - scale 0.82 → 1.04 → 1.00
   - translateY approximately 12 px → 0
   - blur approximately 8 px → 0
5. settle smoothly
6. begin a very subtle idle breathing animation

Idle breathing:
- scale 1.00 → 1.015 → 1.00
- approximately 2.8–3.6 seconds
- ease-in-out
- repeat
- optionally pulse the outer glow slightly
- never continuously rotate the menu

The motion must feel calm and premium, not cartoon-like.

## First background touch

When the user first touches empty screen space:

1. show ripple immediately at raw touch coordinates
2. stop/intercept idle breathing cleanly
3. slightly compress menu to approximately 0.96 scale
4. animate menu toward clamped safe coordinates
5. settle approximately 1.03 → 1.00 scale
6. resume idle breathing after movement completes

Movement feel:
- approximately 350–550 ms
- controlled spring
- very limited overshoot
- no aggressive bounce

The visual metaphor is that the menu is gently attracted to the user's touch.

## Subsequent background touches

Use the same attract-to-touch behavior:
- ripple at exact pointer coordinates
- menu moves from current location
- submenu closes if open
- menu settles
- idle breathing resumes

## Reduced motion

If `prefers-reduced-motion: reduce`:
- disable continuous breathing
- replace spring/bounce with short fade/translate
- simplify ripple motion
- keep all functional behavior


# 3. UX Specification

## 3.0 Multi-Touch Behavior

V1 must correctly handle multiple simultaneous touch pointers using Pointer Events and `pointerId`.

Required behavior:

- every valid background pointerdown may create its own ripple
- only one pointer may own menu drag at a time
- the first pointer that exceeds the drag threshold becomes the active drag owner
- other active pointers must not steal the drag
- releasing a secondary pointer must not terminate the drag
- secondary touches must not cause duplicate submenu opens
- after the active drag pointer ends, the system returns cleanly to idle
- pinch, rotate, and resize gestures are out of scope

## 3.1 Background Tap

When the user taps empty screen space:

1. capture raw pointer coordinates
2. render a water-ripple effect at those exact coordinates
3. collapse any currently open submenu
4. compute a safe main-menu position
5. animate the main menu from its current position to the new safe position

Ripple origin and menu position are not necessarily identical because the menu must be clamped within screen bounds.

---

## 3.2 Ripple

Create a water-like ripple, not a standard material button ripple.

Use:

- 3 expanding concentric rings
- staggered timing
- fade-out
- optional subtle blur/glow
- approximately 650–900 ms total lifespan

Requirements:

- exact touch origin
- pointer-events: none
- safe cleanup after completion
- supports rapid repeated touches
- no memory leak
- no blocked interaction

---

## 3.3 Main Menu

Render:

- central circular hub labeled `MENU`
- 8 equally spaced outer circular items
- visible connectors so the ring looks like one connected circular system

Labels:

- Item 1
- Item 2
- Item 3
- Item 4
- Item 5
- Item 6
- Item 7
- Item 8

Style:

- dark navy background
- deep blue
- rich purple
- bright magenta
- glossy rounded surfaces
- restrained neon glow
- white readable labels

Do not copy any branded third-party UI.

---

## 3.4 Dragging

The whole main menu must be draggable with one finger.

Rules:

- use Pointer Events
- pointer down on center hub or menu shell starts a potential drag
- movement below 10 px remains a tap
- movement >= 10 px becomes dragging
- when dragging begins, close any submenu
- use pointer capture
- update menu position smoothly
- clamp position within viewport
- pointer up ends drag
- pointer cancel safely resets state
- drag release must not activate menu items

Avoid React state updates that cause avoidable render jitter on every raw pointermove if a ref/animation value is more appropriate.

---

# 4. Main Item Tap

When a main item is tapped:

- stop propagation appropriately
- do not trigger background behavior
- do not relocate the main menu
- set the selected item active
- open its submenu
- close/replace any previously open submenu
- animate the new submenu into view

A drag must never be interpreted as a tap.

---

# 5. Submenu

Render:

- smaller central hub labeled `Sub Menu`
- 5 outer connected circular submenu items

Labels:

- SubItem 1
- SubItem 2
- SubItem 3
- SubItem 4
- SubItem 5

Requirements:

- visually connected to the selected main item
- same design language as main menu
- smaller radius and node size
- only one submenu visible at any time
- edge-aware positioning

---

# 6. Outside Tap

When submenu is open and user taps outside the full menu system:

- close submenu
- keep main menu visible

Preferred V1 behavior:

- the same outside tap may also relocate the main menu to the touched safe position

If implementation/testing shows this causes ambiguous or accidental behavior:

- use collapse-only for the first outside tap
- document this decision in README

Do not hide the main menu.

---

# 7. Geometry Requirements

Create reusable helpers.

Required functions should conceptually support:

```ts
getRadialPositions({
  center,
  radius,
  itemCount,
  startAngle
})
```

and:

```ts
clampMenuPosition({
  desiredPosition,
  viewport,
  menuRadius,
  margin
})
```

Do not hard-code individual item coordinates.

Support:

- 8 main items
- 5 submenu items
- different radii
- viewport resize

---

# 8. Required State Model

Use Zustand for durable UI state.

Recommended:

```ts
type ExplorerState = {
  menuPosition: { x: number; y: number };
  activeMainItemId: string | null;
  isSubMenuOpen: boolean;
  interactionMode: "idle" | "pressing" | "dragging";
};
```

Ripple events may use component state or a small local manager.

Pointer-start coordinates should preferably use refs because they are transient.

Avoid unnecessary global state.

---

# 9. Required Project Structure

Use a clean equivalent of:

```text
src/
  app/
    App.tsx

  components/
    TouchSurface.tsx
    RippleLayer.tsx
    Ripple.tsx
    MainRadialMenu.tsx
    MainMenuItem.tsx
    SubRadialMenu.tsx
    SubMenuItem.tsx
    MenuConnectorRing.tsx

  data/
    menuData.ts

  store/
    useExplorerStore.ts

  hooks/
    usePointerDrag.ts
    useOutsidePointer.ts

  utils/
    radialGeometry.ts
    clampPosition.ts
    pointerMath.ts

  styles/
    tokens.css
    explorer.css

  tests/
    radialGeometry.test.ts
    clampPosition.test.ts
```

You may improve structure if there is a clear reason.

Do not create unnecessary abstraction.

---

# 10. CSS / Touch Requirements

Ensure:

```css
touch-action: none;
user-select: none;
-webkit-user-select: none;
```

where appropriate on the interactive surface.

Be careful not to disable behavior globally if unnecessary.

Prevent:

- browser page scroll during drag
- text selection
- accidental image dragging
- unintended browser gestures during normal use

Do not rely only on `touchstart` / `touchmove`.

Use Pointer Events.

---

# 11. Build Sequence

You MUST implement in this order.

## Phase 1 — Bootstrap

1. initialize Vite React TypeScript app
2. install dependencies
3. create base styles
4. verify dev server
5. verify production build

QUALITY CHECK:
- build must pass before proceeding

---

## Phase 2 — Static Main Menu

1. create menu data
2. create radial geometry helper
3. render main hub
4. render 8 items
5. render visual connectors
6. apply color theme

QUALITY CHECK:
- equal spacing
- no overlap
- readable labels
- no console errors

If failed:
- fix
- rerun Phase 2 validation
- do not proceed

---

## Phase 3 — Initial Reveal and Idle Motion

1. add 300–500 ms initial reveal delay
2. animate opacity/scale/translate/blur into place
3. add subtle idle breathing
4. ensure first user interaction interrupts idle/reveal cleanly
5. support reduced-motion preference

QUALITY CHECK:
- menu does not appear abruptly
- reveal animation is smooth
- idle motion is subtle
- menu does not drift across screen
- touch during reveal does not cause duplicate or conflicting animation
- reduced-motion path is functional

If failed:
- fix
- rerun all previous gates

---

## Phase 5 — Ripple

1. create ripple model
2. capture background pointerdown
3. render 3 concentric rings
4. animate scale/opacity
5. remove ripple after completion

QUALITY CHECK:
- ripple origin matches pointer
- repeated taps work
- no stale nodes
- no interference with menu interaction

If failed:
- fix
- recheck build + Phase 2 + Phase 3

---

## Phase 5 — Relocate Menu

1. capture background tap
2. compute desired destination
3. clamp to viewport
4. animate from current position
5. handle viewport resize

QUALITY CHECK:
- tap center
- tap all four edges
- tap all four corners
- menu remains fully visible
- ripple remains at raw touch position

If failed:
- fix
- rerun all previous quality checks

---

## Phase 6 — Drag

1. implement pointerdown on draggable menu area
2. record start position
3. implement 10 px drag threshold
4. use pointer capture
5. move menu while dragging
6. clamp continuously
7. pointerup ends drag
8. pointercancel resets safely
9. close submenu when drag begins

QUALITY CHECK:
- slow drag
- fast drag
- diagonal drag
- edge drag
- drag then release
- drag never triggers item tap
- app never remains stuck in dragging mode

If failed:
- fix
- rerun all previous gates

---

## Phase 7 — Submenu

1. add submenu data
2. render submenu geometry
3. connect submenu to selected item
4. animate open
5. ensure only one submenu exists
6. replace submenu when another main item is tapped

QUALITY CHECK:
- each main item can open submenu
- selecting another item replaces it
- main menu does not move on item tap
- no duplicate submenu DOM
- no item overlap

If failed:
- fix
- rerun all previous gates

---

## Phase 8 — Outside Tap

1. detect pointer outside main menu + submenu
2. collapse submenu
3. preserve main menu
4. implement preferred reposition behavior if reliable
5. ensure submenu taps do not bubble into outside handler

QUALITY CHECK:
- tap submenu item
- tap main item
- tap inside hub
- tap empty background
- no accidental immediate submenu close

If failed:
- fix
- rerun all prior gates

---

## Phase 9 — Polish

Improve:

- ripple timing
- motion easing
- selected-item highlight
- submenu entrance
- glow consistency
- typography
- connector geometry
- responsive sizing

QUALITY CHECK:
- no flicker
- no clipping
- readable text
- stable 60 FPS feel
- no noticeable layout jumps

---

# 12. Browser Touch Validation

The implementation must be designed for direct testing in Chrome or Edge on the touchscreen laptop.

Required manual browser checks:

- one-finger tap
- repeated one-finger taps
- one-finger drag
- two-finger simultaneous taps
- three-or-more-finger simultaneous taps if supported
- drag with one finger while a second finger taps elsewhere
- rapid multi-pointer down/up cycles
- pointercancel/lostpointercapture recovery

Multi-touch success criteria:

- multiple ripples may coexist
- only one pointer owns menu movement
- no duplicate submenu state
- no stuck drag state
- no accidental page scroll during intended interaction
- no browser text selection during gestures

---

# 14. Automated Tests

At minimum create unit tests for:

## radialGeometry
- correct number of points
- points evenly distributed
- radius respected
- startAngle respected

## clampPosition
- center position unchanged when already safe
- left edge clamps
- right edge clamps
- top edge clamps
- bottom edge clamps
- corner clamps

If Playwright is available, add smoke tests for:

- app loads
- main menu visible
- clicking a main item opens submenu
- clicking background closes submenu

Touch-specific fidelity still requires manual testing.

---

# 14. Manual Regression Matrix

After EVERY major interaction fix, rerun:

## RT-00
Launch application and do not interact.

Expected:
- background appears first
- menu materializes after short delay
- menu settles smoothly near center
- subtle idle breathing begins
- menu remains spatially fixed

## RT-00A
Tap during initial reveal.

Expected:
- ripple appears immediately
- initial reveal is interrupted safely
- menu transitions toward touch coordinates
- no visual jump or double animation

## RT-01
Tap center background.

Expected:
- ripple
- menu moves

## RT-02
Tap top-left corner.

Expected:
- ripple at touch
- menu clamped inward

## RT-03
Tap bottom-right corner.

Expected:
- ripple at touch
- menu clamped inward

## RT-04
Slow-drag menu.

Expected:
- smooth movement
- no submenu activation

## RT-05
Fast-drag menu.

Expected:
- no pointer loss
- stable final state

## RT-06
Tap Item 1.

Expected:
- submenu opens
- main menu remains fixed

## RT-07
Tap Item 2.

Expected:
- old submenu replaced

## RT-08
Tap outside.

Expected:
- submenu closes
- main menu remains

## RT-09
Tap 10 different background points rapidly.

Expected:
- ripples clean up
- final menu moves to final target
- no lag buildup

## RT-10
Open submenu then drag main menu.

Expected:
- submenu closes
- drag proceeds

## RT-11
Simulate pointercancel.

Expected:
- state returns to idle

## RT-12
Resize viewport.

Expected:
- menu remains usable and within bounds

---

# 15. Quality Gate Loop

This loop is mandatory.

After implementing any phase:

1. run TypeScript/build checks
2. run automated tests
3. run relevant manual scenarios
4. inspect browser console
5. inspect visible layout
6. record failures
7. fix failures
8. rerun the same gate
9. rerun all earlier regression scenarios
10. proceed only when everything passes

Never skip directly to the next feature after a failed gate.

---

# 16. Failure Rules

If a test fails:

- identify root cause
- make the smallest correct fix
- do not hide error with arbitrary timeout unless justified
- do not disable tests
- do not weaken acceptance criteria
- rerun affected tests
- rerun earlier regression cases

If multiple fixes fail:
- reconsider event architecture
- simplify
- preserve required behavior
- document decision

---

# 17. Performance Rules

During pointermove:

- avoid expensive DOM queries
- avoid unnecessary full-tree re-renders
- prefer refs/motion values where appropriate
- avoid forced synchronous layout
- do not generate new arrays/objects excessively in hot paths without reason

Target:
- visually smooth 60 FPS interaction on normal laptop hardware

---

# 18. Defensive Interaction Rules

Handle:

- pointercancel
- lostpointercapture
- pointer leaving interactive region
- viewport resize
- rapid repeated taps
- drag followed immediately by tap
- submenu open while moving
- menu near every screen edge

The app must never remain in an impossible state such as:
- `dragging` with no active pointer
- submenu open with no active main item
- two submenus visible
- menu center outside safe bounds

---

# 19. Accessibility / Reduced Motion

Add:

```css
@media (prefers-reduced-motion: reduce) {
  /* reduce spring travel and ripple complexity */
}
```

Touch target size:
- at least 48x48 CSS px
- ideally 64 px or larger

Keep labels readable against glow.

---

# 20. README Requirements

README must include:

- project purpose
- prerequisites
- install command
- dev command
- build command
- test command
- touchscreen testing instructions
- explanation of tap vs drag
- explanation of outside tap
- known limitations
- future multi-monitor extension notes

---

# 21. Final Completion Checklist

Do not declare completion until all are true:

- [ ] React + TypeScript + Vite app works
- [ ] production build passes
- [ ] ripple works
- [ ] ripple begins at exact touch coordinates
- [ ] main menu moves to safe target position
- [ ] main menu is edge-safe
- [ ] single-finger drag works
- [ ] tap vs drag is reliable
- [ ] main item opens submenu
- [ ] another main item replaces submenu
- [ ] outside tap closes submenu
- [ ] main menu remains visible
- [ ] no duplicate submenu
- [ ] no console errors
- [ ] automated tests pass
- [ ] full regression matrix passes
- [ ] real touchscreen test checklist is documented
- [ ] README is complete

---

# 22. Final Agent Report

When finished, output a concise report containing:

1. what was implemented
2. architecture summary
3. files added/changed
4. automated test results
5. manual test results
6. quality-gate results
7. any limitations
8. exact commands to run the application

Do not claim touchscreen hardware testing was performed unless it actually was.

If you cannot physically test the real touchscreen, explicitly state:

`Hardware touch validation remains to be performed on the target 16-inch touchscreen laptop.`

---

# 23. Future Compatibility

Do not implement multi-monitor behavior now, but keep the design extensible for:

```text
/controller
/display/1
/display/2
```

Future communication may use:
- BroadcastChannel for same-computer browser windows
- Electron IPC for kiosk packaging
- WebSocket for distributed displays

Do not couple V1 menu logic to any future display transport.

---

# 24. Important Engineering Principle

Prefer a small, deterministic, well-tested interaction model over a visually impressive but unstable prototype.

Core priority:

1. correct touch behavior
2. predictable state transitions
3. smooth movement
4. visual polish
5. future extensibility
