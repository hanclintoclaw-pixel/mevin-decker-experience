# Scenario JSON

The Decker Experience loads a fictional Matrix-host scenario from JSON. The campaign wiki should hold canonical scenario files under `data/matrix-hosts/`, with prose context on the matching `Tech/Matrix/*.md` page. For campaign host design conventions, see the wiki's Matrix Host Construction Guide.

## Required shape

```json
{
  "schemaVersion": "cindylou.matrixHostProfile/v1",
  "id": "happy-cat-public-host",
  "name": "Happy Cat Public Storefront Host",
  "wikiPage": "Tech/Matrix/Happy-Cat-Public-Storefront-Host.md",
  "securityCode": "green",
  "securityValue": 4,
  "hostRating": 4,
  "subsystem": { "access": 4, "control": 3, "index": 4, "files": 4, "slave": 3 },
  "taskTargetNumbers": { "logon": 4, "browsePublic": 4 },
  "securitySheaf": [{ "threshold": 2, "label": "Probe IC", "effect": "Host starts checking the decker icon.", "encounter": { "type": "probe", "rating": 4 } }],
  "sculpting": "Short feel/imagery for the fictional Matrix host.",
  "notes": "GM-facing table notes.",
  "flow": {
    "startNodeId": "ltg-approach",
    "nodes": [
      {
        "id": "ltg-approach",
        "title": "Local Grid Outside Happy Cat",
        "kind": "entry",
        "description": "Scene text shown on the encounter card.",
        "choices": [{ "label": "Open the public door", "to": "public-storefront", "testId": "logon", "unlockSuccesses": 1 }]
      }
    ]
  }
}
```

## Flow rules

- `flow.startNodeId` must match one node `id`.
- Every `choice.to` should match another node `id` unless it intentionally points to a future placeholder.
- `choice.testId` is optional. If present, the app uses `taskTargetNumbers[testId]` or falls back to `hostRating`.
- The recommended campaign pattern is at most two initial doors: an optional no-roll public visitor door and a secure/hidden decker intrusion door.
- Each private-side node may have 1-4 featured `choices`. Existing 2-choice profiles remain valid; a 1-choice node is appropriate for a single locked door, terminal, or forced-forward obstacle.
- The app also provides a custom/RAW action lane at every node for GM-adjudicated operations outside the featured choices.
- Tested choices are gated: by default, 1+ success unlocks and reveals the target node; failure locks that choice for the current crawl and reveals nothing beyond it.
- When Security Tally crosses a `securitySheaf` threshold, the app pauses normal navigation with a checkpoint. The player can suppress/evade, fight, ignore, or jack out; ignored or failed checkpoints become active pressure that adds Tally risk to later tested actions.
- `securitySheaf[].encounter` is optional. Without it, the app infers IC type from the label (`Probe`, `Trace`, `Scramble`, `Tar Baby`, `Killer`, `Blaster`, `Sparky`, `Black`, `Psychotropic`, etc.). Encounter metadata can override `type`, `rating`, `terminalOnFail`, and GM-facing `consequence` text. The checkpoint UI explains what the IC type does and what the four response choices risk before the player commits.
- Runs now end explicitly through graceful logoff, emergency jack out, objective completion, trace completion, ICON/deck crash, black IC harm, or psychotropic consequence. The final card tells the player to alert the GM and summarizes recovered outcomes and unresolved threats.
- A successful featured action should either reveal a new node or give a specific decker-facing result, such as customer files, shipping records, camera access, or a note to tell/ask the GM.
- Permanent outcomes such as altered records, recurring orders, disabled devices, planted files, or changed access must tell the player to notify the GM. Current-crawl lockouts are not permanent by default; after in-world time passes, the GM may allow a reset and retry.
- `choice.unlockSuccesses` is optional and raises the success threshold for harder routes. Omit it for the default 1-success gate.
- `choice.targetNumber` and `choice.securityValue` are optional per-choice overrides for hidden/deeper layers that are harder than the outer Host default.
- Current app utility mapping recognizes starter IDs such as `logon`, `browsePublic`, `searchCustomer`, `staffRecords`, `alterStore`, `controlSlave`, `evadeTrace`, `fightIc`, `findUvSeam`, and `breachUv`.
- Keep descriptions short enough for live-session scanning.

## Wiki update workflow

1. Edit the prose host page, such as `Tech/Matrix/Happy-Cat-Public-Storefront-Host.md`, for campaign context.
2. Edit the matching JSON file, such as `data/matrix-hosts/happy-cat-public-storefront-host.json`, for app-loadable scenario data.
3. Add or update `data/matrix-hosts/index.json` when adding a new scenario file; the Decker Experience Host Library reads this index.
4. Run the campaign wiki's existing validation/build command if it has one.
5. Commit and push the wiki update so the JSON is available from GitHub Pages.
6. Load the Host Library in the Decker Experience, click the Host, or paste the individual URL with **Fetch Scenario**. Download the file and use **Import Scenario JSON** if URL fetch is unavailable.

The mechanics are a provisional SR3-inspired tabletop aid. Treat Security Tally and sheaf events as prompts for GM adjudication, not a full rules replacement.
