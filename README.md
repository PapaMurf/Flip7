# Flip 7 Scorekeeper (PWA)

A beginner-simple, mobile-first scorekeeper you can install on iPhone (Safari → Share → Add to Home Screen).
Works offline. Saves automatically on your device.

## Files included
- index.html
- styles.css
- app.js
- manifest.json
- service-worker.js
- icons/

---

# Part A — Create the GitHub repo (drag-and-drop friendly)

## 1) Make a new repo
1. Go to GitHub.com and log in
2. Click your profile icon (top right) → **Your repositories**
3. Click **New**
4. Repository name: `flip7-scorekeeper` (or any name you want)
5. Set it to **Public**
6. Click **Create repository**

## 2) Upload the files
1. In your new repo, click **Add file** → **Upload files**
2. Drag-and-drop:
   - index.html
   - styles.css
   - app.js
   - manifest.json
   - service-worker.js
3. Create a folder named `icons`
   - Easiest way: click **Add file** → **Create new file**
   - Name it: `icons/.keep`
   - Scroll down and click **Commit changes**
4. Now upload the icon files into the `icons` folder:
   - Click into the `icons` folder
   - Click **Add file** → **Upload files**
   - Upload these 4 PNG files (see Part B for how to create them):
     - icon-192.png
     - icon-512.png
     - apple-touch-icon.png
     - favicon-32.png
   - Click **Commit changes**

---

# Part B — Create the icons (no coding)

You need 4 PNG icon files in the `icons/` folder.

## Option 1 (fastest): Use any “App icon generator” website
1. Search the web for: **PWA icon generator**
2. Upload any square image you like (even a simple screenshot/logo)
3. Download the generated icons
4. Rename/copy these sizes into `icons/`:
   - `icon-192.png` (192×192)
   - `icon-512.png` (512×512)
   - `apple-touch-icon.png` (180×180)
   - `favicon-32.png` (32×32)

## Option 2 (simple placeholder): Use this built-in placeholder image
If you don’t have a logo:
1. Create a simple 1024×1024 image that says “Flip 7” (Canva / Keynote / any image editor)
2. Export as PNG
3. Use an icon generator site to make the 4 sizes above

---

# Part C — Enable GitHub Pages (exact clicks)

1. In your repo, click **Settings**
2. In the left sidebar, click **Pages**
3. Under **Build and deployment**
   - Source: choose **Deploy from a branch**
   - Branch: choose **main**
   - Folder: choose **/(root)**
4. Click **Save**
5. Wait a minute, then GitHub will show your site URL on that same page.

Your URL will look like:
`https://YOUR-USERNAME.github.io/flip7-scorekeeper/`

---

# Part D — Install on iPhone Home Screen

1. On your iPhone, open **Safari**
2. Go to your GitHub Pages URL
3. Tap the **Share** button (square with arrow)
4. Tap **Add to Home Screen**
5. Tap **Add**

Now it opens like an app, and works offline.

---

# Using the app
- Add 2–8 players, tap names to edit
- Start Game
- Enter each player’s round score (integers; negatives allowed)
- Submit Round
- Undo last round removes it from history
- Round History → tap a round → edit → save (totals recalculated for later rounds)
- Game ends the first time someone reaches 200+ at the end of a round; winner(s) highlighted (ties supported)

---

# Troubleshooting

## “It didn’t update on my phone”
PWAs can cache aggressively.

Try this:
1. On iPhone, open the site in Safari (not the home screen icon)
2. Pull down to refresh
3. If still old:
   - Safari → tap the **AA** in the address bar → **Website Settings** → (optional) disable cache features if shown
   - Or clear website data: Settings → Safari → Advanced → Website Data → search your site → Delete
4. Re-open and Add to Home Screen again if needed.

## “Service worker didn’t register”
- GitHub Pages must be HTTPS (it is)
- Make sure `service-worker.js` is in the repo root (same level as index.html)
- Make sure you uploaded the icons exactly where manifest expects them:
  `icons/icon-192.png`, etc.

## “My scores disappeared”
Data is stored in your device’s local storage:
- If you clear Safari website data, it resets.
- If you open in a different browser/device, it won’t sync.
