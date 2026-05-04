# Golf Handicap (WHS)

Local or web: static HTML/CSS/JS. Optional [GolfCourseAPI](https://golfcourseapi.com) course lookup (your API key stays in the browser).

## Host on GitHub Pages

1. **Create a new repository** on GitHub (any name, e.g. `golf-handicap`). Do not add a README from the template if you want this folder to be the only content.

2. **Push this project** from your machine (replace `YOUR_USER` and `YOUR_REPO`):

   ```bash
   cd golf-handicap
   git init
   git add .
   git commit -m "Initial commit: golf handicap app"
   git branch -M main
   git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
   git push -u origin main
   ```

3. **Turn on GitHub Pages**

   - Repo → **Settings** → **Pages** (left sidebar).
   - **Build and deployment** → Source: **Deploy from a branch**.
   - Branch: **main**, folder: **/ (root)** → Save.

4. After a minute or two, the site is live at:

   `https://YOUR_USER.github.io/YOUR_REPO/`

   (If the repo is named `YOUR_USER.github.io`, the site is `https://YOUR_USER.github.io/` at the root.)

The `.nojekyll` file tells GitHub not to run Jekyll on this site, which avoids odd processing of static files.

## Develop locally

```bash
python3 -m http.server 8765
```

Open `http://localhost:8765` (ES modules need a local server, not `file://`).
