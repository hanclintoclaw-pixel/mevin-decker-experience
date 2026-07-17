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
  "shutdownTally": 18,
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
- Each private-side node should usually have 1-4 core featured `choices`. Existing 2-choice profiles remain valid; a 1-choice node is appropriate for a single locked door or terminal if it also provides a way to back out nearby.
- A node may have a fifth choice only when that last choice is a back-out, return, retreat, or logoff option.
- Tested choices are gated: by default, 1+ success unlocks and reveals the target node; failure locks that choice for the current crawl and reveals nothing beyond it.
- Do not create double gates to one location: a tested choice should not lead to a node whose only substantive onward option is another tested choice. Merge those checks into one harder gate, or make the first success reveal a useful location, hub, result, or back-out option.
- `shutdownTally` is optional. If omitted, the app infers it from the host rating and final sheaf threshold.
- The app shows **Passive Alert** at roughly one-third of Shutdown and **Active Alert** at roughly two-thirds. Reaching Shutdown ends the run with dumpshock.
- When Security Tally crosses a `securitySheaf` threshold, the app pauses normal navigation with a checkpoint. The player can suppress/evade, fight, ignore, or jack out; ignored or failed checkpoints become active pressure that adds Tally risk to later tested actions.
- `securitySheaf[].encounter` is optional. Without it, the app infers IC type from the label (`Probe`, `Trace`, `Scramble`, `Tar Baby`, `Killer`, `Blaster`, `Sparky`, `Black`, `Psychotropic`, etc.). Encounter metadata can override `type`, `rating`, `terminalOnFail`, and GM-facing `consequence` text. The checkpoint UI explains what the IC type does and what the four response choices risk before the player commits.
- The checkpoint, active-pressure, suppressed-queue, and final unresolved-IC summaries show built-in IC icons for `probe`, `trace`, `scramble`, `tarBaby`, `killer`, `blaster`, `sparky`, `black`, and `psychotropic`; unknown or generic security pressure uses the warning/pressure icon.
- Runs now end explicitly through graceful logoff, emergency jack out, objective completion, trace completion, shutdown/dumpshock, failed-jackout dumpshock, ICON/deck crash, black IC harm, or psychotropic consequence. The final card tells the player to alert the GM, summarizes recovered outcomes and unresolved threats, and provides a Discord-ready copyable run report including final Security Tally.
- A successful featured action should either reveal a new node or give a specific decker-facing result, such as customer files, shipping records, camera access, or a note to tell/ask the GM.
- Final run reports should exclude pure flavor/fluff nodes, but include concrete discoveries, access, paydata, permanent changes, and GM-confirmation results. Use `kind: "confirmation"`, `kind: "reward"`, `kind: "paydata"`, `kind: "permanent-outcome"`, or explicit `report` metadata on concrete result nodes.
- Nodes may grant run-scoped `advantages`: targeted passcodes, keys, found passwords, or access tokens that modify later rolls.
- Permanent outcomes such as altered records, recurring orders, disabled devices, planted files, or changed access must tell the player to notify the GM. Current-crawl lockouts are not permanent by default; after in-world time passes, the GM may allow a reset and retry.
- `choice.unlockSuccesses` is optional and raises the success threshold for harder routes. Omit it for the default 1-success gate.
- `choice.targetNumber` and `choice.securityValue` are optional per-choice overrides for hidden/deeper layers that are harder than the outer Host default.
- Current app utility mapping recognizes starter IDs such as `logon`, `browsePublic`, `searchCustomer`, `staffRecords`, `alterStore`, `controlSlave`, `evadeTrace`, `fightIc`, `findUvSeam`, and `breachUv`.
- Keep descriptions short enough for live-session scanning.

## Final report metadata

Concrete result nodes can customize whether and how they appear in the Discord-ready final run report:

```json
{
  "id": "camera-confirmation",
  "title": "Camera Network Access",
  "kind": "confirmation",
  "description": "You appear to have access to the camera network. Confirm scope, feeds, controls, and blind spots with the GM.",
  "report": {
    "include": "always",
    "title": "Camera network access",
    "detail": "Mevin reached the camera network. Confirm visible feeds, controls, blind spots, and physical coverage with the GM.",
    "notifyGm": true
  },
  "choices": []
}
```

`report.include` accepts `always`, `auto`, or `never`. Omit it for normal auto behavior: reportable node kinds and concrete access/file/device/paydata-looking nodes are captured; public flavor, menus, setup, navigation, and exits are not. Use `never` for fun fluff that should stay out of the final Discord output.

## Run advantages

A node can grant small targeted modifiers when the decker reaches it. Keep values simple: usually `targetNumberModifier: -1`, `diceBonus: 1`, or `requiredSuccessModifier: -1`.

```json
{
  "id": "manager-terminal-password",
  "title": "Password Note Found",
  "kind": "reward",
  "description": "You find a sticky-note passcode for staff records. Tell the GM you have it.",
  "advantages": [
    {
      "name": "Staff records passcode",
      "reason": "Password note hidden in the manager terminal",
      "targetNumberModifier": -1,
      "appliesTo": ["staffRecords", "logon"]
    }
  ],
  "choices": []
}
```

Supported fields are `name`, `reason`, `diceBonus`, `targetNumberModifier`, `requiredSuccessModifier`, and optional `appliesTo`. If `appliesTo` is omitted or empty, the advantage affects all tested rolls. The special test ID `threatCheckpoint` applies to IC checkpoint rolls.

## Wiki update workflow

1. Edit the prose host page, such as `Tech/Matrix/Happy-Cat-Public-Storefront-Host.md`, for campaign context.
2. Edit the matching JSON file, such as `data/matrix-hosts/happy-cat-public-storefront-host.json`, for app-loadable scenario data.
3. Add or update `data/matrix-hosts/index.json` when adding a new scenario file; the Decker Experience Host Library reads this index.
4. Run the campaign wiki's existing validation/build command if it has one.
5. Commit and push the wiki update so the JSON is available from GitHub Pages.
6. Load the Host Library in the Decker Experience, click the Host, or paste the individual URL with **Fetch Scenario**. Download the file and use **Import Scenario JSON** if URL fetch is unavailable.

The mechanics are a provisional SR3-inspired tabletop aid. Treat Security Tally and sheaf events as prompts for GM adjudication, not a full rules replacement.

## Hacking Pool abstraction

The app auto-adds free Hacking Pool to tested action rolls to reduce per-roll math. Hacking Pool remains visible as a separate value. Players can lower the effective pool for the current run by reserving dice for Detection Factor or by suppressing a checkpoint IC with a pool die. These allocations remain visible and last until reset/end in the current abstraction.
