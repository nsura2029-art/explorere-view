# Deploy & preview on Vercel

The app is a static Vite build (no server), so Vercel builds it straight from GitHub.
Repo config lives in `vercel.json` (framework Vite, `npm ci`, `npm run build`, output `dist`,
long-term caching for hashed `/assets/*`) and `package.json` → `engines.node` (`>=20.19`, needed by
Vite 7). Nothing else is required in the repo.

Repository: https://github.com/nsura2029-art/explorere-view

## 1. Connect the project (once)

If the repo is not on Vercel yet: vercel.com → **Add New → Project → Import**
`nsura2029-art/explorere-view` → keep the detected settings (Framework **Vite**, the rest comes
from `vercel.json`) → **Deploy**. Vercel may ask to install its GitHub app for the repo.

If it is already imported, check **Settings → Build and Deployment**: Framework Preset **Vite**,
no overridden build/output commands (or the same values as `vercel.json`), Node.js 20.x or newer.

## 2. Preview a branch (e.g. `feature/subitem-rotate`)

Every push to any branch other than the production branch creates a **Preview deployment**
automatically. For this branch:

- **Deployments** tab → filter by branch `feature/subitem-rotate` → open the newest one
  (status **Ready**). Build log is there if it fails.
- Each branch also gets a **stable branch URL** that always points to its latest push:
  `https://<project>-git-feature-subitem-rotate-<team-or-username>.vercel.app`
  (shown on the deployment page under "Domains").

To force a build without pushing: **Deployments → Create Deployment** → enter the branch as
`https://github.com/nsura2029-art/explorere-view/tree/feature/subitem-rotate`.

## 3. Let others open the preview

Preview URLs are protected by **Vercel Authentication** by default (only you / your team,
logged in to Vercel, can open them). To share:

- **Public for a few days:** **Settings → Deployment Protection → Vercel Authentication** → turn
  it off (or set it to protect production only, if offered). Turn it back on afterwards.
- **Share without making it public:** on the deployment's **Share** button create a shareable
  link (if available on your plan), or use Protection Bypass for Automation.

## 4. Optional: a nicer, fixed preview address

**Settings → Domains → Add** e.g. `explorer-preview.vercel.app` (any free `*.vercel.app` name, or
your own domain) → **Edit** → **Git Branch** = `feature/subitem-rotate`. That address then follows
every push to the branch.

## 5. Production

The production branch is set in **Settings → Environments → Production → Branch Tracking**
(default `main`). Merging the feature branch into `main` (or pointing production at
`develop`) publishes it on the production URL.

## Notes

- HTTPS is automatic, which the "Open screens" feature (Window Management API) requires.
- Display windows work at `https://<deployment>/?view=display`.
- Vercel's Hobby plan is for non-commercial use.
- Local check of what Vercel builds: `npm ci && npm run build && npx vite preview`
  (http://localhost:4173).
- Windows tip: stop `npm run dev` before `npm ci` — a running dev server locks `esbuild.exe`.
