# CLAUDE.md — agent brief for Explorer touch menu

Read this first in every chat. It holds the context that is not obvious from the code: decisions,
status, pending work and how to verify changes. History lives in `CHANGELOG.md`; user-facing
behaviour in `README.md`; setup in `docs/LOCAL_SETUP.md`. **Keep this file and `CHANGELOG.md`
up to date** whenever a feature lands or a decision changes.

## What this is

A touch-first radial menu prototype for a 16" touchscreen laptop (Chrome/Edge, browser only),
controlling two external 32" screens. React 19 + TypeScript (strict) + Vite 7 + Framer Motion 12
+ Zustand 5 + Pointer Events. No backend. Original spec: `docs/explorer_touch_menu_spec.md`
(and `docs/explorer_touch_menu_codex_prompt.md`).

**User feedback overrides the spec.** Where they differ, the user's later requests win (listed
under "Decisions" below). Note deviations in `README.md`.

## Commands

```bash
npm install
npm run dev        # http://localhost:5173 (strictPort)
npm run typecheck  # tsc --noEmit
npm test           # vitest (src/tests/**/*.test.ts)
npm run build      # typecheck + production build to dist/
```

Display window for an external screen: `http://localhost:5173/?view=display`.

## Git workflow

- Branches: `main` (stable), `develop` (integration), `feature/*` (work). Current work:
  `feature/subitem-rotate` (branched from `develop` at `6e35ae9`), pushed to
  `origin` = https://github.com/nsura2029-art/explorere-view.
- **Commit / push / merge only when the user asks.** The user usually says "yes please" / "go"
  to a proposed plan that includes committing.
- Commit messages: summary line + bullet body, ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Windows checkout: "LF will be replaced by CRLF" warnings are harmless.
- The user commits assets themselves sometimes (e.g. the mp3) — check `git status` before
  committing and ask about files you did not create.

## How the user works

- Gives feature requests in plain language (sometimes long pasted specs). Before large or
  ambiguous changes, **summarise understanding + a to-do list and ask**; then implement fully.
- Expects: no regressions ("do not change existing behaviour"), verification in the browser,
  unit tests, docs updated, a clear summary with what was verified and what was not.

## Architecture map

```
src/
  main.tsx                  ?view=display → DisplayApp, else App
  app/App.tsx               controller: layers, background press, resize clamping, link, tap chime
  store/useExplorerStore.ts Zustand: menu position/phase, submenu, spin modes, images (tray),
                            ripples, activity time, split view (focusCardId, menuScale)
  components/
    TouchSurface            full-screen surface; background presses; activity tracking
    MainRadialMenu          main menu: drift intro, position springs, reveal/breath layers, rotor
                            (clock ticks + rotate mode), gestures, submenu open, dock in split
                            view, idle demo wiring
    MainMenuItem            item orb (+ demo pulse animation)
    SubRadialMenu           submenu (scaled twin), its rotate mode, open/close transition
    ImageLayer              image cards: drag/detach, pinch/double-tap zoom, throw, tray, split
    RippleLayer             water ripples (surface + item)
    effects/                CrystallineEffectLayer + CrystallineBurst (touch burst overlay)
    ScreensButton, SoundToggle, ThrowPortals, SpinHubLabel, MenuConnectorRing, Backdrop, icons
  hooks/
    usePointerDrag          single-owner tap/drag recognizer (+ velocity, optional pinch)
    useDoubleTap, useRingSpin, useClockTicks, useIdle, useAttractDemo, useTapChime, useViewport
  utils/                    pure, unit-tested maths: radialGeometry, clampPosition, menuLayout,
                            subMenuPlacement, cardPlacement (split/tray), spinMath, wander,
                            attractDemo, createCrystallineParticles, tapSound, sceneImage (SVG
                            placeholder images), chime (audio), pointerRegistry
  displays/                 controller ↔ display link (BroadcastChannel), Window Management API,
                            throw maths
  display/DisplayApp.tsx    external-screen window (full-screen image)
  tests/                    vitest unit tests (pure utils + store)
```

Key mechanics:
- Menu center lives in Framer motion values (`x`, `y`) on `.menu-anchor`; the store's
  `menuPosition` is the committed target (`moveKind` jump/spring). During the drift intro
  (`motionPhase === 'wandering'`) the drift owns the position.
- Layers inside the anchor: reveal → move-scale → breathing → rotor (items counter-rotate).
- Gestures: every interactive element uses `usePointerDrag` (stops propagation, pointer
  capture); the background is whatever is not handled. Window-level **capture** listeners
  (activity, demo interrupt, crystalline burst, tap chime) only observe, never block.
- Split view: `focusCardId !== null || any image shelved` → menus docked (scaled) in the left
  half, active image in the right half between the top-right controls and the tray.
- Sound: one shared `Audio` element (`utils/chime.ts`), restarted per tap, mute in localStorage.

## Decisions (user-approved, override the spec)

- Intro: drift in from bottom-left, roam until first touch (bounce was replaced).
- Clock-tick ring rotation only after 15 s idle; double-tap an item = rotate mode (main and
  submenu); single tap waits 300 ms (double-tap window).
- Submenu = main menu at 84%, outer circles never overlap, longer bridge.
- Images: tap sub item → image; earlier images go to the tray (max 5); zoom max 50% width,
  between top-right controls and tray; closing a submenu keeps images.
- Throw images to external screens (full screen there).
- Idle demo after 8–12 s idle: pulse random item 2× outward, then preview its submenu; any input
  stops it. **Silent.**
- Crystalline burst on every touch (visual). **Chime only on taps** (released without moving),
  never on drags/pinch/flick, ×, "Open screens", mute button; mute button left of
  "Open screens".
- `prefers-reduced-motion`: no drift/demo/big motions; simplified bursts.

## Conventions

- Put maths in `src/utils/*` as pure functions with unit tests; components stay thin.
- Match existing comment style (short "why" comments, JSDoc on exports), CSS tokens/vars in
  `styles/`, colours from the blue/purple/magenta palette.
- Touch targets ≥ 48 px; everything via Pointer Events; overlays `pointer-events: none`.
- New non-chiming controls: add `data-sound="off"`.
- Top-right controls live in `.screens__row`; cards and zoom limits measure that row.
- Never add dependencies without asking.

## Verifying in the browser pane (important quirks)

- The pane is often **hidden**: `document.visibilityState === 'hidden'`, rAF paused, size may be
  0×0. Use `resize_window` (e.g. 1280×720) and take screenshots to advance frames; Framer
  animations and `onAnimationComplete` only progress on rendered frames (sequences with timer
  fallbacks still advance).
- Access the live store from page JS:
  `const u = performance.getEntriesByType('resource').map(e=>e.name).find(n=>n.includes('useExplorerStore')); const { useExplorerStore } = await import(u);`
  (importing `/src/store/...` directly gives a *different* module instance).
- Drive input with `el.dispatchEvent(new PointerEvent(...))` (touch/pen/mouse, pointerId);
  target the *live* submenu (`.submenu` without `pointer-events: none`), exiting ones linger
  while frames are paused.
- Count sound with a patched `HTMLMediaElement.prototype.play`.
- Old `[vite] Failed to reload` console errors can be stale HMR noise from mid-edit states —
  reload and re-check before reporting.
- A dev server may already be running on 5173 (started by the user or an earlier session):
  navigate to it instead of starting another. Reset the viewport (`preset: desktop`) at the end.

## Status

### Completed
Everything in `CHANGELOG.md` up to and including [Unreleased]: radial menu, ripples,
relocate/drag, submenus (+ rotate), images (detach, pinch/double-tap zoom, tray, split view),
multi-screen throw, drift intro, clock ticks, idle demo, crystalline burst, tap-only chime + mute,
docs (README, LOCAL_SETUP, this file, CHANGELOG). Unit tests: 160 passing.

### Pending / next
1. **Commit + push the [Unreleased] work** (tap-only chime, mute button, silent demo, these docs)
   on `feature/subitem-rotate` — awaiting the user's OK.
2. Merge `feature/subitem-rotate` → `develop` → `main` when the user asks (PR or fast-forward;
   `main`/`develop` are at `6e35ae9`).
3. Real-hardware checks the pane cannot do: live animation feel and smoothness, sound sync,
   first-touch audio, multi-finger taps and pinch on the actual touchscreen (spec QG-6), two 32"
   screens (Window Management permission, fullscreen hand-off, throw directions).
4. Public deploy: the user was setting up Vercel (production branch in Settings → Environments →
   Production → Branch Tracking). Status unknown — ask.
5. Kiosk launch: document/verify Chrome flags (`--kiosk`, `--autoplay-policy=no-user-gesture-required`).

### Known limitations
- Images are generated SVG placeholders (`utils/sceneImage.ts`); real content not wired yet.
- Font "Sora" loads from Google Fonts (falls back offline).
- No e2e (Playwright) tests; browser checks are manual/scripted in the pane.
