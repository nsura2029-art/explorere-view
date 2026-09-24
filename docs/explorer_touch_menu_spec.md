# Explorer Touch Menu Prototype — Product & Technical Specification

## 1. Purpose

Build a polished, touch-first prototype for a 16-inch touchscreen laptop that acts as an interactive control surface. The interface uses a movable circular menu with ripple feedback, nested submenus, and smooth gesture-driven interactions.

The prototype is intended to demonstrate an immersive "Explorer"-style navigation experience before adding multi-monitor presentation behavior, content orchestration, 360-degree experiences, or kiosk packaging.

---

## 2. Current Scope and Target Environment

### V1 Scope

The current scope is limited to:

- a touchscreen laptop
- browser-based execution
- no dependency on external monitors
- no dependency on Electron, kiosk software, or native desktop APIs
- no dependency on physical display orchestration

The application must be testable directly in a modern browser on the touchscreen laptop.

### Browser Interaction Scope

V1 must support and be tested for:

- single-finger tap
- repeated single-finger taps
- single-finger drag
- multiple simultaneous finger taps
- rapid multi-touch interactions
- touch release
- touch cancellation/interruption

Multi-touch in V1 is primarily an input-safety and visual-feedback requirement. Multiple fingers may create independent ripple effects, but they must not cause duplicate menu movement, broken state, or accidental drag behavior.

### Future Hardware Phase

Physical hardware integration is intentionally deferred.

A future phase may include:

- two external 32-inch monitors
- extended-display mode
- touchscreen as controller
- presentation content on external displays
- multi-screen synchronization
- Electron or native display APIs
- kiosk/fullscreen startup
- physical installation details

Do not implement or assume these capabilities in V1.

---

## 3. Primary User Experience

The user can:

1. Tap anywhere on empty screen space.
2. See a water-ripple effect originate exactly at the touch location.
3. See the main circular menu animate from its current position toward the touched location.
4. Drag the main menu to another position using one finger.
5. Tap a main-menu item.
6. See a connected submenu appear from that selected item.
7. Tap another main-menu item to replace the current submenu.
8. Tap outside the menu system to collapse the submenu.
9. Continue moving and interacting with the main menu without reloading the application.

---


## 3.1 Initial Menu Appearance and Idle State

The prototype should not begin with the menu appearing as a static object.

Recommended initial behavior:

1. Load the page with a clean dark background.
2. After a short delay of approximately 300–500 ms, reveal the main circular menu near the visual center of the screen.
3. Use a soft "materialize" animation:
   - opacity: 0 → 1
   - scale: 0.82 → 1.04 → 1.00
   - slight vertical drift: +12 px → 0
   - subtle blur: 8 px → 0
4. Once fully visible, enter a very gentle idle "breathing" state.

Recommended idle motion:
- scale: 1.00 → 1.015 → 1.00
- duration: approximately 2.8–3.6 seconds
- ease-in-out
- repeat continuously
- optional soft glow pulse synchronized with the breathing animation

Do not use a fast or cartoon-like bounce.

The desired effect is:
- calm
- premium
- responsive
- slightly futuristic

The user should perceive the menu as waiting for interaction.

### Initial Position

Default initial position:
- horizontally centered
- vertically centered or slightly above center
- enough room around the menu to reveal a submenu without immediate clipping

Recommended default:
- X = 50% viewport width
- Y = 46–50% viewport height

### First Touch Transition

On the first valid background touch:

1. show the ripple immediately at the exact touch coordinates
2. interrupt the idle breathing animation cleanly
3. slightly compress the menu before movement
4. animate the menu toward the safe coordinates nearest the touch
5. settle with a small controlled spring
6. return to the idle breathing state after movement completes

Recommended movement sequence:

- pre-move scale: 1.00 → 0.96
- movement duration/feel: approximately 350–550 ms
- arrival scale: 0.96 → 1.03 → 1.00
- no excessive overshoot
- no large bounce

This should feel as if the menu is being gently attracted to the user's touch.

### Subsequent Background Touches

After the first interaction:
- create a ripple at the new touch point
- move the menu from its current location to the new safe location
- use the same "attracted to touch" motion
- preserve selected/idle styling unless a submenu is currently open
- if a submenu is open, collapse it before or during relocation

### Idle Behavior After Interaction

When no interaction is occurring:
- resume the subtle breathing animation
- do not continuously rotate the menu
- do not move it around the screen automatically
- do not emit repeated ripples automatically

The interface should remain visually alive but spatially stable.

### Reduced Motion

If `prefers-reduced-motion: reduce` is active:
- remove the breathing loop
- replace bounce/spring with a short fade/translate
- keep ripple simpler and less expansive
- preserve all interaction semantics


## 4. Interaction Model

### 4.0 Multi-Touch Rules

The browser prototype must handle multiple active touch pointers safely.

Rules:

- every finger touching empty screen space may create its own ripple effect
- the main menu must have exactly one movement owner at a time
- the first valid pointer that starts a drag becomes the active drag pointer
- additional fingers must not steal the drag
- additional touches must not duplicate submenu activation
- releasing a non-owning pointer must not terminate the active drag
- the application must cleanly handle multiple pointerdown, pointerup, and pointercancel events
- pointer identity must be tracked using `pointerId`

Recommended V1 behavior:

- one finger may move/drag the menu
- additional simultaneous fingers create ripple feedback only
- multi-finger gestures such as pinch, rotate, or resize are out of scope

### 4.1 Background Tap

When the user taps empty screen space:

- capture the pointer position
- create a ripple at the exact raw pointer coordinates
- collapse any open submenu
- calculate a safe menu destination
- animate the main menu from its previous position to that destination

Important:
- the ripple must remain at the true touch point
- the menu position may be clamped inward to remain fully visible

### 4.2 Ripple Effect

The ripple should feel like a water disturbance rather than a generic button ripple.

Recommended visual:
- 3 concentric rings
- staggered delays
- expanding scale
- fading opacity
- subtle blur/glow
- total duration approximately 650–900 ms

The ripple:
- must not block pointer interaction
- must self-remove after animation
- must support rapid repeated touches
- must not leak DOM elements or timers

### 4.3 Main Menu

The main menu is a connected radial menu.

V1:
- 8 main items
- one center hub
- all outer items positioned evenly around a circle
- visual connectors between neighboring items
- premium glossy/glow treatment
- deep blue, rich purple, bright magenta palette

Example item labels:
- Item 1
- Item 2
- Item 3
- Item 4
- Item 5
- Item 6
- Item 7
- Item 8

Center label:
- MENU

### 4.4 Drag Main Menu

The main menu can be moved using one finger.

Behavior:
- pointer down on menu shell or center hub starts a possible drag
- movement below threshold remains a tap
- movement beyond threshold becomes a drag
- during drag, the whole main menu follows the pointer
- submenu may remain attached or close; for V1, close submenu when drag begins
- release ends drag
- final menu position is clamped to screen bounds

Recommended tap/drag threshold:
- 8–12 CSS pixels
- use 10 px as initial default

### 4.5 Main Item Tap

When a main item is tapped:

- do not move the main menu
- do not trigger background ripple behavior
- mark that item active
- open the corresponding submenu
- position submenu relative to the selected main item
- animate submenu in
- close any previously open submenu

### 4.6 Submenu

Each main item can expose submenu items.

V1:
- 5 submenu items
- one submenu hub
- connected circular layout
- same visual language as main menu
- smaller scale than main menu

Example labels:
- SubItem 1
- SubItem 2
- SubItem 3
- SubItem 4
- SubItem 5

Center label:
- Sub Menu

### 4.7 Outside Tap

When a submenu is open and the user taps outside the complete menu system:

- close submenu
- keep main menu visible
- keep main menu at current position
- do not hide the main menu

After submenu collapse, the same background tap may also reposition the main menu only if the tap is clearly outside the menu and the implementation can do so without causing interaction ambiguity.

Preferred V1 rule:
- first outside tap collapses submenu and also repositions the main menu to the tapped location
- if this produces accidental behavior during testing, fall back to collapse-only behavior

### 4.8 Edge Awareness

The menu must never render partially off-screen.

Compute a safe menu center:

safeX = clamp(rawX, menuRadius + margin, viewportWidth - menuRadius - margin)

safeY = clamp(rawY, menuRadius + margin, viewportHeight - menuRadius - margin)

Recommended margin:
- 16–24 px

If submenu geometry extends further than the main menu radius, the safe bounds must include submenu size when submenu is open.

---

## 5. Gesture Priority

Priority order is important.

1. Active drag
2. Main-menu item tap
3. Submenu item tap
4. Main-menu shell/center drag candidate
5. Outside/background tap
6. Ripple creation

Do not allow event propagation to cause:
- a main-item tap plus background move
- a submenu tap plus outside collapse
- a drag release plus item activation

Use pointer capture where appropriate.

---

## 6. State Model

Recommended state:

```ts
type Point = {
  x: number;
  y: number;
};

type MainMenuItem = {
  id: string;
  label: string;
  icon?: string;
  subItems: SubMenuItem[];
};

type SubMenuItem = {
  id: string;
  label: string;
  icon?: string;
};

type Ripple = {
  id: string;
  x: number;
  y: number;
  createdAt: number;
};

type ExplorerState = {
  menuPosition: Point;
  activeMainItemId: string | null;
  isSubMenuOpen: boolean;
  interactionMode: "idle" | "pressing" | "dragging";
  ripples: Ripple[];
};
```

Transient pointer coordinates may remain in component-local refs instead of global state.

---

## 7. Recommended Technology Stack

Required:
- React
- TypeScript
- Vite
- Framer Motion
- Zustand
- CSS or CSS Modules
- Pointer Events API

Optional:
- Lucide React for simple placeholder icons
- Vitest for geometry/state-unit tests
- Playwright for browser interaction smoke tests

Avoid in V1:
- Electron
- Unity
- Unreal Engine
- backend server
- database
- WebSocket
- cloud services

---

## 8. Suggested Project Structure

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

---

## 9. Radial Geometry

For N items:

```ts
angle = startAngle + (360 / itemCount) * index
x = centerX + radius * Math.cos(angleInRadians)
y = centerY + radius * Math.sin(angleInRadians)
```

Requirements:
- equal spacing
- configurable radius
- configurable start angle
- reusable for main menu and submenu
- no hard-coded item coordinates

---

## 10. Visual Design

Theme:
- dark navy or near-black background
- deep electric blue
- rich violet/purple
- bright magenta/pink
- subtle glow
- translucent connector surfaces
- smooth rounded nodes
- premium touchscreen installation feel

Design tokens should be centralized.

Example:

```css
:root {
  --bg: #060817;
  --blue-1: #0b4dff;
  --blue-2: #00b7ff;
  --purple-1: #6d28d9;
  --purple-2: #9b5cff;
  --magenta-1: #d100d1;
  --magenta-2: #ff2fb3;
  --text: #ffffff;
  --muted: rgba(255,255,255,.7);
}
```

Do not overuse bloom to the point text becomes unreadable.

---

## 11. Animation Requirements

### Ripple
- 3 rings
- stagger: 60–100 ms
- duration: 650–900 ms
- opacity decreases to zero
- scale increases smoothly

### Main Menu Move
Preferred:
- spring animation
- no overshoot that causes edge collision
- duration/feel equivalent to approximately 250–450 ms

### Submenu Open
- slight scale from 0.85 to 1
- fade from 0 to 1
- optional small rotational reveal
- duration approximately 180–300 ms

### Submenu Close
- scale down slightly
- fade out
- complete before state cleanup

---

## 12. Browser and Touch Testing Requirements

The prototype must be directly testable in Chrome or Edge on the target touchscreen laptop.

Required browser testing:

- one-finger tap on background
- one-finger drag of main menu
- repeated single-finger taps
- two-finger simultaneous taps
- three-or-more-finger simultaneous taps when supported by hardware/browser
- one finger dragging while another finger taps elsewhere
- rapid multi-touch down/up cycles
- pointercancel recovery

Expected multi-touch behavior:

- each valid empty-space touch can show an independent ripple
- only one pointer can own main-menu drag at a time
- secondary touches must not move the menu unless they become the next valid interaction after the active pointer releases
- no broken, stuck, or duplicated UI state

Browser constraints:

- prevent accidental text selection
- prevent unwanted page scrolling during intended menu interaction
- prevent browser image drag behavior
- avoid relying on native touch-only APIs; use Pointer Events
- do not disable browser behavior more broadly than necessary

---

## 14. Accessibility & Touch Targets

Even though this is a prototype:
- touch targets should be at least 48x48 CSS px
- preferably 64 px or larger on this display
- text must remain readable
- avoid controls too close together
- respect prefers-reduced-motion with simpler transitions
- keyboard support is optional for V1 but should not be intentionally broken

---

## 14. Functional Stories


### EX-000 — Initial Menu Materialization

As a user, I want the interface to reveal the main menu in a calm, polished way so that the experience feels intentional before I interact.

Acceptance Criteria:
- background loads first
- menu appears after a brief 300–500 ms delay
- menu fades/scales into place smoothly
- menu settles without a cartoon-like bounce
- idle breathing motion begins after settle
- first user touch immediately interrupts idle motion
- reduced-motion preference disables continuous idle animation



### EX-001 — Show Ripple on Background Touch

As a user, I want to see a water ripple where I touch the screen so that the interface gives immediate physical feedback.

Acceptance Criteria:
- ripple begins at touch coordinates
- ripple is visible within 50 ms
- ripple fades automatically
- repeated taps work
- no console errors

### EX-002 — Move Main Menu to Touch Location

As a user, I want the circular menu to move to my point of interaction so that controls follow my attention.

Acceptance Criteria:
- menu animates from old center to new safe center
- ripple remains at actual touch point
- menu remains fully on-screen

### EX-003 — Drag Main Menu with One Finger

As a user, I want to drag the main menu so I can reposition it freely.

Acceptance Criteria:
- one-finger drag moves entire menu
- menu follows pointer smoothly
- menu remains bounded
- submenu closes when drag begins
- release does not activate menu item

### EX-004 — Open Submenu

As a user, I want to tap a menu item and see its submenu.

Acceptance Criteria:
- selected item becomes active
- submenu opens near selected item
- only one submenu is visible
- background does not move menu during item tap

### EX-005 — Replace Submenu

As a user, I want a different submenu when I select another main item.

Acceptance Criteria:
- old submenu closes/replaces cleanly
- new submenu matches selected item
- no overlapping stale menus

### EX-006 — Collapse Submenu

As a user, I want to tap outside the menu to close the submenu.

Acceptance Criteria:
- submenu collapses
- main menu remains
- menu position is retained or intentionally moved according to the chosen V1 behavior
- no accidental item activation

### EX-007 — Edge-safe Positioning

As a user, I want the menu to remain usable even when I touch close to a screen edge.

Acceptance Criteria:
- ripple appears at exact edge touch location
- menu center is clamped inward
- no menu node is clipped

---

## 15. Non-Functional Requirements

Performance:
- target 60 FPS during drag and animations
- no visible stutter on normal laptop hardware
- no layout thrashing in pointermove loops

Reliability:
- no uncaught errors
- no stale pointer state after pointercancel
- no duplicate active submenus
- no runaway ripple nodes

Maintainability:
- no hard-coded screen dimensions
- no duplicated radial math
- state transitions are explicit
- components remain reusable

---

## 16. Implementation Order

Build in this exact order:

1. Scaffold React + TypeScript + Vite
2. Create theme tokens
3. Render static main radial menu
4. Add reusable radial geometry helper
5. Add initial menu materialization animation
6. Add subtle idle breathing animation
7. Add ripple layer
8. Add background tap handling
9. Add animated menu relocation
10. Add bounds clamping
11. Add drag handling
12. Add tap-vs-drag threshold
13. Add submenu rendering
14. Add item selection
15. Add outside-tap collapse
16. Add event-propagation safeguards
17. Add motion polish
18. Add responsive sizing
19. Add tests
20. Run full regression checklist
21. Fix defects
22. Repeat quality gates until all pass

---

## 17. Quality Gates

### QG-1 — Build Gate

Must pass:
- application starts successfully
- TypeScript compilation succeeds
- production build succeeds
- no blocking lint errors
- no uncaught runtime exceptions

Failure action:
- stop
- fix
- rerun QG-1
- do not continue until passed

### QG-2 — Geometry Gate

Must pass:
- 8 main items positioned evenly
- 5 submenu items positioned evenly
- menu clamps correctly at all four corners
- viewport resize does not strand menu off-screen

Failure action:
- fix geometry/clamping
- rerun QG-1 and QG-2

### QG-3 — Touch Interaction Gate

Must pass:
- background tap creates ripple
- background tap moves menu
- drag starts only after threshold
- drag does not trigger item tap
- item tap does not move menu
- pointercancel recovers to idle state

Failure action:
- fix pointer handling
- rerun QG-1 through QG-3

### QG-4 — Submenu Gate

Must pass:
- main item opens submenu
- only one submenu exists
- selecting a second main item replaces previous submenu
- outside tap closes submenu
- submenu interaction does not trigger outside close

Failure action:
- fix
- rerun QG-1 through QG-4

### QG-5 — Visual Quality Gate

Must pass:
- no text clipping
- no item overlap
- no obvious flicker
- glow does not reduce readability
- ripple is visually smooth
- animations feel consistent
- menu never visibly jumps during normal interaction

Failure action:
- polish and retest all prior gates

### QG-6 — Real Touchscreen Gate

Must pass on the actual touchscreen laptop:
- single-finger drag works
- taps register predictably
- no browser text selection during gestures
- no unintended page scrolling
- no pinch/zoom interference during ordinary use
- repeated tap/drag cycles remain stable

Failure action:
- adjust CSS touch-action and pointer handling
- rerun all interaction regression tests

---

## 18. Required Regression Test Matrix

Run after every major interaction change.

### RT-00
Launch application without touching screen.

Expected:
- dark background appears first
- menu materializes after brief delay
- menu settles near center
- subtle breathing motion begins
- no automatic movement across the screen

### RT-00A
Tap screen while initial reveal animation is still running.

Expected:
- reveal animation transitions cleanly into touch response
- ripple appears at exact touch coordinates
- menu moves toward safe touch coordinates
- no jump, flicker, duplicate animation, or stuck state

### RT-01
Tap center background.

Expected:
- ripple
- menu moves to center-safe position

### RT-02
Tap near top-left corner.

Expected:
- ripple at exact touch point
- menu clamped inward

### RT-03
Tap near bottom-right corner.

Expected:
- ripple at exact touch point
- menu clamped inward

### RT-04
Drag main menu slowly.

Expected:
- smooth movement
- no submenu opens

### RT-05
Drag main menu rapidly.

Expected:
- stable movement
- no lost pointer state

### RT-06
Tap Item 1.

Expected:
- submenu opens
- main menu does not move

### RT-07
Tap Item 2 while Item 1 submenu is open.

Expected:
- Item 1 submenu closes/replaces
- Item 2 submenu opens

### RT-08
Tap outside open submenu.

Expected:
- submenu closes
- main menu remains visible

### RT-09
Rapidly tap 10 background locations.

Expected:
- ripples render and clean up
- final menu reaches last selected safe position
- app stays responsive

### RT-10
Open submenu, begin dragging main menu.

Expected:
- submenu closes
- drag proceeds normally

### RT-11
Pointer leaves viewport during drag or pointercancel occurs.

Expected:
- interaction returns safely to idle

### RT-12
Resize browser window.

Expected:
- menu stays or is moved back into safe bounds
- layout remains usable

---

## 19. Definition of Done

V1 is done only when all are true:

- ripple appears on empty-space touch
- menu animates to touched location
- menu remains edge-safe
- menu can be dragged with one finger
- tap and drag are reliably distinguished
- main item opens submenu
- only one submenu is open
- outside tap closes submenu
- interactions work with real touch input
- no console errors
- production build passes
- all quality gates pass
- regression matrix passes
- README includes setup and test instructions

---

## 20. Future Phase — Multi-Monitor Extension

Do not implement in V1, but preserve architecture for:

- controller route on touchscreen
- display 1 route
- display 2 route
- BroadcastChannel for same-machine browser prototype
- later WebSocket or Electron IPC
- drag/throw content from controller to external displays
- presentation-state synchronization
- kiosk mode
- 360-degree content
- media playback
- resort/content data model

The V1 code should avoid design decisions that make this extension difficult.

---

## 21. Final V1 Decision Summary

Use:
- React
- TypeScript
- Vite
- Framer Motion
- Zustand
- Pointer Events

Do not use:
- backend
- Electron
- Unity
- 3D engine
- database
- external monitor integration
- native display APIs

The goal is a clean, polished, browser-based touch interaction prototype running only on the laptop touchscreen.

Physical hardware/display integration belongs to a later phase and must not influence V1 implementation decisions beyond keeping the code modular.
