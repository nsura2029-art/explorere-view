# Changelog

All notable changes to the Explorer touch menu. Newest first.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/). Dates are commit dates.

## [Unreleased]

Nothing yet.

## 2026-09-28 — `feature/ice-magic-burst`

### Display windows: tray, stars + sound, visible cursor

#### Added
- **Tray on the external screens:** a newer image thrown to a display no longer replaces the one
  shown there; the earlier one shrinks into a tray of thumbnails at the bottom right (like the
  touchscreen's, max 5, oldest leave first). Tap a thumbnail to bring it back full screen; an
  image thrown again comes out of the tray instead of showing twice (`displays/displayShelf.ts`,
  tested in `tests/displayShelf.test.ts`).
- **Stars and sound on the displays:** touches/clicks there get the same crystalline burst, taps
  the same ping + shimmer. Muting on the touchscreen mutes the displays too, live.

#### Fixed
- **Cursor vanished on the display in full screen:** it now stays visible while the mouse is
  used and only hides after ~3 s without moving (back on any move).

### Ice-magic tap: twice the stars, burst + slow fade, ping + shimmer sound

#### Changed
- **Twice as many stars** in the touch burst: 32–80 small (was 16–40), 6–10 medium (was 3–5),
  2–4 large feature stars (was 1–2); they travel a little further.
- **Burst, then a slow fade:** particles shoot out to ~60% of their travel in the first tenth of
  their life, then drift and fade slowly; the whole burst lasts ~2.4 s (was ~1 s). Slightly
  bigger contact flash and energy ring. Reduced motion unchanged.
- **New tap sound:** one soft glassy ping followed by a glittery shimmer that fades with the stars
  (~2.4 s, 5 variations), replacing the bell-like chime. Regenerated with a rewritten
  `scripts/generate_ice_tap.py` (still fully synthetic and original).

## 2026-09-27 — `feature/subitem-rotate`

### `63c7386` Demo fixes, smooth ring glides, calm tap glide, more stars

#### Fixed
- **Idle demo showed another item's submenu:** the ring could tick round between an item's pulse
  and its submenu preview. The ring now holds still for the whole pulse + preview, so the item
  that pulses is always the one whose submenu opens.

#### Changed
- **Ring rotation is a smooth glide inside the idle demo** (2–3 slots forward ≈2 s, then 1–2 back
  ≈0.8–1.4 s, random, alternating), replacing the separate 1-per-second clock ticks (removed:
  `hooks/useClockTicks.ts`). An interruption settles a glide quickly at its slot.
- **Calmer tap-to-move:** the menu glides to a tap on empty space in 0.7–1.1 s (was ≈0.45 s);
  the same glide for split-view dock/undock caused by images (open, zoom, tray, close).
- **Twice as many tiny stars** in the touch burst: 16–40 (was 8–20); nothing else changed.

## 2026-09-27 — merge

- `develop` fast-forwarded to `986f43e` (everything below, from `feature/subitem-rotate`).

## 2026-09-25 — `feature/subitem-rotate` (continued)

### `986f43e` Original ice-tap sound

#### Changed
- **New tap sound: original "ice tap"** (~1 s instead of the 3 s chime), shaped like the burst:
  glassy contact tink → cascade of tiny ice pings → shimmering bell highlight → frosty tail that
  fades with the particles by ~0.9 s. Five variations (`src/assets/sounds/ice-tap-1..5.mp3`),
  a random one per tap, never the same twice in a row; still one at a time, mute unchanged.
  Fully synthetic and reproducible: `scripts/generate_ice_tap.py` (numpy/scipy/ffmpeg); shape
  vs. the visual timeline in `docs/ice-tap-preview.png`. The original
  `docs/original_crystalline_touch_3s.mp3` is kept but no longer used.

### `e8d1bcc` Vercel deploy config

#### Added
- Vercel deploy config: `vercel.json` (Vite, `npm ci`, `npm run build`, `dist`, immutable caching
  for hashed assets), `engines.node >=20.19`, `docs/DEPLOY.md` (connect, branch previews,
  sharing/protection, fixed preview domain, production branch).

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
