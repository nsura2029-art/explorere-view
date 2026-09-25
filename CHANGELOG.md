# Changelog

All notable changes to the Explorer touch menu. Newest first.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/). Dates are commit dates.

## [Unreleased]

Nothing yet.

## 2026-09-25 — `feature/subitem-rotate` (continued)

### `0a7604f` Tap-only chime, mute button, docs

#### Changed
- **Chime only on taps.** The crystalline chime now plays when a finger, pen or mouse press is
  released without moving (tap, click, pen tap, each tap of a double tap, long press). Drags,
  flicks, pinches, turning a ring, right/middle clicks, keys and the wheel are silent. Plays on
  release, which also fixes "first touch after loading is silent" (browsers unlock audio on
  touch release).
- **Idle demo is silent** (sound is reserved for the user's own taps).
- Utility controls never chime: × (close image), "Open screens", the mute button
  (`data-sound="off"`).
- Image cards keep clear of both top-right buttons.

#### Added
- **Mute button** (speaker icon) just left of "Open screens": mutes every chime, remembered in
  `localStorage` (`explorer.soundMuted`); turning sound on plays one confirmation chime.
- `utils/tapSound.ts` (`TapTracker`), `hooks/useTapChime.ts`, `components/SoundToggle.tsx`,
  tests in `tests/tapSound.test.ts`.
- `CHANGELOG.md` and `CLAUDE.md` (agent brief); README links them.

## 2026-09-25 — `feature/subitem-rotate`

### `87988c5` Crystalline touch/click burst
- Every pointerdown (touch, mouse, pen), anywhere: a burst exactly at the pointer — contact flash,
  energy ring, 8–20 small / 3–5 medium / 1–2 large particles (stars, slender crystals, shards,
  dots, snow) in white/icy, blue/cyan, purple, magenta; gone within 1 s. Max 8 bursts.
- Independent overlay (`pointer-events: none`), CSS compositor animations, random values fixed
  once per burst (`utils/createCrystallineParticles.ts`).
- Shared chime element; configurable volume (`DEFAULT_CHIME_VOLUME` 0.35, `setChimeVolume`).

### `e32d14e` Idle attract demo
- 2 s after load and after 8–12 s without interaction: a random main item (never twice in a
  row) glides outward 50–100 px at 2× with extra glow, returns exactly, then its submenu opens
  for 1–2 s and collapses; repeats. Any input stops it instantly; a submenu it showed stays.
- Clock ticks pause during a pulse; the intro drift pauses during a preview.

### `4dfe8b0` Image tray and split view
- Only the newest image is a full card; earlier ones become thumbnails in a tray along the
  bottom of the right half (max 5). Tap a thumbnail to bring it back; reopening an image from
  the tray reuses it; closing the active card promotes the latest thumbnail.
- Split view: images max 50% screen width, only between the top-right controls and the tray;
  while the tray has images or the image is zoomed, menus dock (scaled) in the left half.
- Closing/switching a submenu keeps its images (untethered).
- Added `docs/original_crystalline_touch_3s.mp3`.

### `eb5a513` Submenu rotate mode, spaced submenu, image zoom
- Double-tap a sub item: submenu rotate mode (drag to turn, flick + snap). Shared
  `useDoubleTap` / `useRingSpin` hooks (main menu refactored onto them).
- Submenu = main menu scaled to 84% (`SUB_SCALE`), longer bridge, smooth open/close
  (bridge grows, submenu glides out, items stagger in).
- Main and submenu outer circles never overlap (`ORBIT_GAP`).
- Image cards: two-finger pinch zoom, double-tap 2× / normal; avoid the "Open screens" button.

## 2026-09-24 — `develop` / `main`

### `6e35ae9` Drifting intro
- Replaced the bouncing intro: the menu fades in at the bottom-left corner, drifts to the top
  right, then roams the window on smooth curves until the first touch (`utils/wander.ts`).

## 2026-09-23 — `main`

### `b2b0cca` Docs
- Tech stack overview in `docs/LOCAL_SETUP.md`.

### `a95b9e3` Initial prototype
- Radial menu (8 items), materialize reveal, water ripples, tap-to-relocate, one-finger drag,
  multi-touch safety, edge clamping, collapsible connected submenus, sub item images (drag to
  detach), item ripples, clock-tick ring rotation (idle), double-tap rotate mode for the main ring.
- Multi-screen: controller + display windows (`?view=display`), Window Management API +
  BroadcastChannel, flick an image toward a screen to show it full screen there.
- `docs/LOCAL_SETUP.md`.
