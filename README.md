```markdown
# Arc Raiders — Data Explorer (static SPA)

This is a static, single-page viewer that loads the Arc Raiders data hosted in the
RaidTheory/arcraiders-data repository and provides an interactive UI for browsing
projects (items & blueprints), bots, trades, maps, and skill nodes.

How it works
- The site fetches JSON files directly from the repository's raw URLs:
  https://raw.githubusercontent.com/RaidTheory/arcraiders-data/main/{filename}
- It normalizes objects/arrays into a list, and attempts to display:
  - Basic info (name/id/rarity/tier)
  - Stats/attributes
  - Blueprints/recipes/ingredients
  - Locations/drops/spawn info
  - Map references (attempts to fetch maps.json for more detail)

Files included
- index.html — the full single-page application HTML
- js/app.js — single-file application logic (fetch, normalize, render)
- css/styles.css — site styles
- README.md — this file

Usage
1. Create a new repository (or branch) and add the files above in the same structure:
   - index.html
   - js/app.js
   - css/styles.css

2. Commit & push. To host:
   - Enable GitHub Pages from repository Settings → Pages and choose the main branch (or gh-pages)
   - The site will be published and will fetch data from the RaidTheory/arcraiders-data repo

Notes & next steps
- Because the data in the source repo can be nested or inconsistent, the viewer uses heuristic detection for sections (stats, blueprint, drops).
- If you want the site to include more datasets or custom fields (e.g. quests if/when added), I can:
  - Add explicit parsers for known schemas
  - Add a local data upload (drag & drop) option
  - Add bookmarking / permalink support for entries
  - Add offline caching and faster repeated loads

Security & privacy
- The site only requests static raw JSON files from the RaidTheory repository. No writes are performed.

Want me to commit these files to a repo for you or open a PR against a specific repository/branch? Tell me the target repo (owner/name) and branch and I will create the commit or PR.
```