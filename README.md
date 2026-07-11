# Mevin Decker Experience

A branching, fictional Shadowrun 3rd Edition Matrix-host flowchart scene tool for Mevin. It is meant for live table use: load a scenario JSON profile, click through connected node/encounter cards, record choices, roll provisional SR3-inspired table checks, update Security Tally, and reveal new route branches only when the decker succeeds.

## Data sources

- Decker data: attempts to sync Mevin Matrix Deck Manager browser state from `localStorage` key `cindylou.sr3MevinDeckManager.v1`.
- Manual deck fallback: import a JSON export from the Deck Manager.
- Scenario data: fetch wiki-hosted JSON from the Host Library index at `https://hanclintoclaw-pixel.github.io/campaign-wiki/data/matrix-hosts/index.json`, or paste an individual scenario URL.
- Manual scenario fallback: import a downloaded scenario JSON file.

GitHub Pages project apps under `https://hanclintoclaw-pixel.github.io/` normally share the same site origin for localStorage, so Deck Manager sync can work across repo paths in the same browser. If the app is run from local dev, a fork, a preview URL, or a different domain, export JSON from Deck Manager and import it here instead.

## Scenario JSON

Scenario files are host profiles plus a `flow` graph. See [docs/SCENARIO_JSON.md](docs/SCENARIO_JSON.md) for the expected shape and wiki update workflow.

## Development

```sh
npm install
npm run lint
npm run build
npm run dev
```

## Deployment

This repo deploys to GitHub Pages through `.github/workflows/deploy.yml`.

Live app: `https://hanclintoclaw-pixel.github.io/mevin-decker-experience/`
