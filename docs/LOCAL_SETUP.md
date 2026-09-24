# Local setup — Explorer Touch Menu

How to get the app running on a Windows touchscreen laptop (and, optionally, the two external
32" screens).

## 1. Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | **20.19+ or 22.12+** (Vite 7 requirement; tested with 24.x) | `node -v` |
| npm | comes with Node | `npm -v` |
| Git | any recent version | `git --version` |
| Browser | Chrome or Edge (current) | — |

Install Node.js from <https://nodejs.org> (LTS) if it is missing.

## 2. Get the code

```bash
git clone https://github.com/nsura2029-art/explorere-view.git
cd explorere-view
```

## 3. Install dependencies

```bash
npm install
```

## 4. Run the app (development)

```bash
npm run dev
```

Open <http://localhost:5173> in Chrome or Edge on the touchscreen laptop and press **F11** for
fullscreen. The dev server reloads automatically when files change. Stop it with `Ctrl+C`.

The port is fixed to **5173** (`vite.config.ts`, `strictPort`). If it is taken, stop the other
process or change the port there.

## 5. Checks

```bash
npm run typecheck   # TypeScript, no output = OK
npm test            # unit tests (Vitest)
npm run build       # production build into dist/
npm run preview     # serve the production build at http://localhost:4173
```

## 6. Touchscreen tips

- Use the browser in fullscreen (F11) so swipes don't trigger browser navigation.
- Windows **Settings → Display → Scale**: any scale works; the menu sizes itself to the screen.
- Pinch-zoom, text selection, long-press menus and page scroll are already suppressed in the app.

## 7. External screens (optional)

The laptop page is the **controller**; each 32" screen shows a **display** window. Throw an image
card toward a screen and it appears there full screen.

1. Connect the screens, then **Windows Settings → System → Display**:
   - choose **"Extend these displays"**;
   - drag the screen tiles so they match where the screens physically stand (throw directions come
     from this arrangement).
2. **Control Panel → Tablet PC Settings → Setup…** → *Touch input* → tap the laptop screen, so touch
   goes to the laptop panel and not an external screen.
3. Start the app (`npm run dev`) and open <http://localhost:5173> on the laptop (F11).
4. Tap **Open screens** (top right). Allow **"Manage windows on all your displays"** and **pop-ups**
   for `localhost` when Chrome/Edge asks, then tap **Open screens** again. A display window opens on
   each other screen.
5. If a display window is not fullscreen, click it once with a mouse or press **F11** on it.

Manual alternative (any browser, no permission needed): open
<http://localhost:5173/?view=display> in a window on each external screen and press F11. The
controller finds them by itself; the top-right button shows how many screens are linked.

## 8. Using the app

| Gesture | Result |
|---|---|
| Tap empty space | ripple + the menu glides there |
| Drag hub / item / ring | move the menu |
| Tap an item | open its submenu (tap again to close) |
| Double-tap an item | rotate mode: drag around the menu to turn the ring (either direction) |
| Tap a sub item | show its image (tap again to hide) |
| Drag an image | detach it and place it anywhere |
| Flick an image toward a screen | send it to that screen, full screen |
| No touch for 15 s | the ring ticks round like a clock |

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| `npm run dev` says the port is in use | Close the other dev server, or change `server.port` in `vite.config.ts`. |
| Blank page | Check the browser console (F12); run `npm install` again after pulling changes. |
| "Only one screen found" | Windows is mirroring; switch to **Extend these displays**. |
| "Allow Manage windows…" message | Click the window-management icon in the address bar → Allow, then tap again. |
| Display windows don't open | Allow pop-ups for `localhost` (address bar icon), then tap again. |
| Throws go to the wrong screen | Fix the screen arrangement in Windows Display settings. |
| Touches land on an external screen | Redo **Tablet PC Settings → Setup…** (step 7.2). |
| Fonts look different offline | The Sora font loads from Google Fonts; offline it falls back to Segoe UI. |
