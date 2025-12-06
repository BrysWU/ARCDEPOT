```markdown
# Arc Raiders Tracker & Data Explorer

This is a static single-page application designed to provide a rich interactive experience similar to tracker sites like arctracker.io. It uses the RaidTheory/arcraiders-data repository as the data source (fetched from raw GitHub URLs at runtime).

Features
- Interactive Leaflet map with markers for items/quests/loot when coordinates or map references are available.
- Marker clustering and custom SVG marker icons.
- Searchable & filterable list of dataset entries (projects, bots, trades, maps, skillNodes).
- Detailed item view with sections for Basic Info, Stats, Blueprint/Recipe, Locations/Drops, and Raw JSON.
- Questline viewer: attempts to detect quests in the loaded dataset and visualizes quest dependencies; you can also import local quest JSON files.
- Local JSON import: load local datasets into the UI for exploration (does not write to the repo).
- Heuristics to extract coordinates from several possible schema patterns.

Files
- index.html — main HTML and layout (includes Leaflet and MarkerCluster from CDN)
- css/styles.css — UI styles (complete)
- js/app.js — full client app logic (complete)
- README.md — this file

How to deploy
1. Create a new GitHub repository or branch.
2. Add the files above preserving the structure:
   - index.html
   - css/styles.css
   - js/app.js
3. Commit & push.
4. Enable GitHub Pages (Settings → Pages) for the branch (main or gh-pages). The site will be published as a static site and will fetch data live from the RaidTheory/arcraiders-data repo.

Notes & next improvements (I can do next)
- Add custom icons for weapon/tool/blueprint categories and asset images if you provide images or mapping from item -> image.
- Add a dedicated blueprint graph (visualize components recursively) using a graph library (Cytoscape, D3).
- Improve quest graph visualization using DAG layout (dagre-d3 or cytoscape) for better flow diagrams.
- Add persistent bookmarks / permalink support to share specific items.
- Add caching (localStorage or service-worker) for offline and faster loads.
- Add authentication + contribution flow (allow users to propose fixes to data via PRs).

If you want, I can now:
- Commit these files to a repository or open a PR for you — tell me the target repository (owner/name) and branch to open the PR against and I'll prepare the PR.
- Or I can iterate on UI details (specific color palette, icons, custom map tiles) before committing.
