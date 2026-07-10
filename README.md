# Mevin Decker Experience

A branching Shadowrun Matrix crawl for Mevin. This is the player-facing “cyber dungeon” experience: sync deck state, pull a host profile from the campaign wiki, click through doors/nodes, roll when prompted, reveal branches, and keep a path log.

## Data sources

- Deck data: `localStorage` from Mevin Matrix Deck Manager (`cindylou.sr3MevinDeckManager.v1`).
- Host data: campaign wiki JSON profiles, starting with Happy Cat.

## Development

```sh
npm install
npm run build
npm run dev
```

## Deployment

`https://hanclintoclaw-pixel.github.io/mevin-decker-experience/`
