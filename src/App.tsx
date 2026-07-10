import { useEffect, useMemo, useState } from 'react'
import './App.css'

declare const __SOURCE_COMMIT__: string

type PersonaKey = 'bod' | 'evasion' | 'masking' | 'sensors'

type UtilityCategory = 'attack' | 'defense' | 'stealth' | 'sensor' | 'control' | 'utility' | 'special'

interface DeckRuntime {
  sourceName: string
  owner: string
  handle: string
  detectionFactor: number
  persona: Record<PersonaKey, number>
  utilities: Array<{ name: string; category: UtilityCategory; rating: number; status: string }>
}

interface DeckManagerExport {
  deck?: {
    name?: string
    owner?: string
    handle?: string
    detectionFactor?: string
    persona?: Partial<Record<PersonaKey, string>>
  }
  utilities?: Array<{ name?: string; category?: UtilityCategory; rating?: string; status?: string }>
}

interface FlowChoice {
  label: string
  to: string
  testId?: string
}

interface FlowNode {
  id: string
  title: string
  kind: string
  description: string
  choices: FlowChoice[]
}

interface HostProfile {
  id: string
  name: string
  securityCode: string
  securityValue: number
  hostRating: number
  subsystem: Record<string, number>
  taskTargetNumbers: Record<string, number>
  securitySheaf: Array<{ threshold: number; label: string; effect: string }>
  sculpting: string
  notes: string
  flow: { startNodeId: string; nodes: FlowNode[] }
}

interface PathEntry {
  id: string
  at: string
  from: string
  choice: string
  to: string
  testId?: string
  targetNumber?: number
  dice?: number[]
  successes?: number
  tallyIncrease?: number
  sheaf?: string[]
}

interface CrawlState {
  currentNodeId: string
  visitedNodeIds: string[]
  securityTally: number
  path: PathEntry[]
}

const DECK_MANAGER_STORAGE_KEY = 'cindylou.sr3MevinDeckManager.v1'
const STORAGE_KEY = 'cindylou.mevinDeckerExperience.v1'
const HAPPY_CAT_URL = 'https://hanclintoclaw-pixel.github.io/campaign-wiki/data/matrix-hosts/happy-cat-public-storefront-host.json'

const seedDeck: DeckRuntime = {
  sourceName: 'Starter fallback deck',
  owner: 'Mevin Kitnick',
  handle: 'Condor / screaming birdman icon',
  detectionFactor: 5,
  persona: { bod: 4, evasion: 5, masking: 5, sensors: 4 },
  utilities: [
    { name: 'Analyze', category: 'sensor', rating: 4, status: 'loaded' },
    { name: 'Browse', category: 'utility', rating: 4, status: 'loaded' },
    { name: 'Sleaze / masking suite', category: 'stealth', rating: 5, status: 'loaded' },
  ],
}

const seedHost: HostProfile = {
  id: 'no-host-loaded',
  name: 'No host loaded',
  securityCode: 'green',
  securityValue: 4,
  hostRating: 4,
  subsystem: { access: 4, control: 3, index: 4, files: 4, slave: 3 },
  taskTargetNumbers: { logon: 4 },
  securitySheaf: [],
  sculpting: 'Load a host profile from the campaign wiki.',
  notes: '',
  flow: {
    startNodeId: 'load-host',
    nodes: [{ id: 'load-host', title: 'No Host Loaded', kind: 'setup', description: 'Fetch a host profile to begin the crawl.', choices: [] }],
  },
}

function numeric(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return fallback
  const match = value.match(/-?\d+/)
  return match ? Number(match[0]) : fallback
}

function deckFromManager(exported: DeckManagerExport): DeckRuntime {
  const deck = exported.deck ?? {}
  const persona = deck.persona ?? {}
  return {
    sourceName: deck.name ?? 'Imported Deck Manager state',
    owner: deck.owner ?? 'Mevin Kitnick',
    handle: deck.handle ?? seedDeck.handle,
    detectionFactor: numeric(deck.detectionFactor, seedDeck.detectionFactor),
    persona: {
      bod: numeric(persona.bod, seedDeck.persona.bod),
      evasion: numeric(persona.evasion, seedDeck.persona.evasion),
      masking: numeric(persona.masking, seedDeck.persona.masking),
      sensors: numeric(persona.sensors, seedDeck.persona.sensors),
    },
    utilities: (exported.utilities ?? []).map((utility, index) => ({
      name: utility.name ?? `Utility ${index + 1}`,
      category: utility.category ?? 'utility',
      rating: numeric(utility.rating, 0),
      status: utility.status ?? 'unknown',
    })).filter((utility) => utility.rating > 0),
  }
}

function rollOpenD6(targetNumber: number) {
  let total = 0
  let roll = 0
  do {
    roll = Math.floor(Math.random() * 6) + 1
    total += roll
  } while (roll === 6 && targetNumber > 6)
  return total
}

function loadStoredCrawl(host: HostProfile): CrawlState {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return { currentNodeId: host.flow.startNodeId, visitedNodeIds: [host.flow.startNodeId], securityTally: 0, path: [] }
  try {
    const parsed = JSON.parse(stored) as CrawlState
    return parsed.currentNodeId ? parsed : { currentNodeId: host.flow.startNodeId, visitedNodeIds: [host.flow.startNodeId], securityTally: 0, path: [] }
  } catch {
    return { currentNodeId: host.flow.startNodeId, visitedNodeIds: [host.flow.startNodeId], securityTally: 0, path: [] }
  }
}

function bestUtility(deck: DeckRuntime, testId?: string) {
  const categories: Record<string, UtilityCategory[]> = {
    logon: ['stealth', 'utility'],
    browsePublic: ['sensor', 'utility'],
    searchCustomer: ['sensor', 'utility'],
    staffRecords: ['sensor', 'utility'],
    alterStore: ['control', 'stealth'],
    controlSlave: ['control', 'stealth'],
    evadeTrace: ['stealth', 'defense'],
    fightIc: ['attack', 'defense'],
  }
  const wanted = categories[testId ?? ''] ?? ['utility']
  return deck.utilities.filter((utility) => wanted.includes(utility.category) && utility.status !== 'burned').reduce((best, utility) => Math.max(best, utility.rating), 0)
}

function testPersona(testId?: string): PersonaKey {
  if (testId === 'evadeTrace' || testId === 'logon') return 'masking'
  if (testId === 'controlSlave' || testId === 'alterStore') return 'masking'
  if (testId === 'fightIc') return 'bod'
  return 'sensors'
}

function App() {
  const [deck, setDeck] = useState<DeckRuntime>(seedDeck)
  const [host, setHost] = useState<HostProfile>(seedHost)
  const [crawl, setCrawl] = useState<CrawlState>(() => loadStoredCrawl(seedHost))
  const [message, setMessage] = useState('')
  const currentNode = useMemo(() => host.flow.nodes.find((node) => node.id === crawl.currentNodeId) ?? host.flow.nodes[0], [host, crawl.currentNodeId])
  const nextSheaf = host.securitySheaf.find((step) => step.threshold > crawl.securityTally)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(crawl))
  }, [crawl])

  function syncDeck() {
    const stored = localStorage.getItem(DECK_MANAGER_STORAGE_KEY)
    if (!stored) {
      setMessage('No Deck Manager state found in this browser. Open Deck Manager on this same site first.')
      return
    }
    try {
      const nextDeck = deckFromManager(JSON.parse(stored) as DeckManagerExport)
      setDeck(nextDeck)
      setMessage(`Synced ${nextDeck.sourceName}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Deck sync failed.')
    }
  }

  async function fetchHappyCat() {
    try {
      const response = await fetch(HAPPY_CAT_URL)
      if (!response.ok) throw new Error(`Host fetch failed: ${response.status}`)
      const nextHost = await response.json() as HostProfile
      setHost(nextHost)
      setCrawl({ currentNodeId: nextHost.flow.startNodeId, visitedNodeIds: [nextHost.flow.startNodeId], securityTally: 0, path: [] })
      setMessage(`Loaded ${nextHost.name} from wiki data.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Host fetch failed.')
    }
  }

  function choose(choice: FlowChoice) {
    const from = currentNode.id
    let dice: number[] | undefined
    let successes: number | undefined
    let targetNumber: number | undefined
    let tallyIncrease = 0
    let sheaf: string[] = []

    if (choice.testId) {
      const tn = host.taskTargetNumbers[choice.testId] ?? host.hostRating
      targetNumber = tn
      const persona = deck.persona[testPersona(choice.testId)]
      const utility = Math.floor(bestUtility(deck, choice.testId) / 4)
      const dicePool = Math.max(1, 8 + Math.floor(persona / 3) + utility)
      dice = Array.from({ length: dicePool }, () => rollOpenD6(tn))
      successes = dice.filter((die) => die >= tn).length
      const securityDice = Array.from({ length: host.securityValue }, () => rollOpenD6(deck.detectionFactor))
      tallyIncrease = securityDice.filter((die) => die >= deck.detectionFactor).length
      const after = crawl.securityTally + tallyIncrease
      sheaf = host.securitySheaf.filter((step) => step.threshold > crawl.securityTally && step.threshold <= after).map((step) => `${step.threshold}: ${step.label}`)
    }

    const entry: PathEntry = {
      id: `path-${Date.now()}`,
      at: new Date().toLocaleTimeString(),
      from,
      choice: choice.label,
      to: choice.to,
      testId: choice.testId,
      targetNumber,
      dice,
      successes,
      tallyIncrease,
      sheaf,
    }

    setCrawl((current) => ({
      currentNodeId: choice.to,
      visitedNodeIds: [...new Set([...current.visitedNodeIds, choice.to])],
      securityTally: current.securityTally + tallyIncrease,
      path: [entry, ...current.path].slice(0, 60),
    }))
  }

  function resetCrawl() {
    setCrawl({ currentNodeId: host.flow.startNodeId, visitedNodeIds: [host.flow.startNodeId], securityTally: 0, path: [] })
  }

  return (
    <main className="crawl-shell">
      <header className="crawl-hero">
        <div>
          <p className="kicker">FICTIONAL MATRIX CRAWL // SR3 TABLE AID</p>
          <h1>Mevin Decker Experience</h1>
          <p className="subtitle">A cyber dungeon of doors, nodes, rolls, branches, and consequences.</p>
          <p className="micro">Build {__SOURCE_COMMIT__} · <a href="https://hanclintoclaw-pixel.github.io/mevin-deck-manager/">Deck Manager</a> · <a href="https://hanclintoclaw-pixel.github.io/campaign-wiki/Minigames.html">Minigames</a></p>
        </div>
        <div className="hero-buttons">
          <button onClick={syncDeck}>Sync Deck</button>
          <button onClick={fetchHappyCat}>Load Happy Cat</button>
          <button onClick={resetCrawl}>Reset Crawl</button>
        </div>
      </header>

      {message && <p className="notice">{message}</p>}

      <section className="status-grid">
        <article><span>Deck</span><strong>{deck.sourceName}</strong><small>{deck.handle}</small></article>
        <article><span>Host</span><strong>{host.name}</strong><small>{host.securityCode.toUpperCase()}-{host.securityValue}</small></article>
        <article><span>Tally</span><strong>{crawl.securityTally}</strong><small>{nextSheaf ? `Next: ${nextSheaf.threshold} ${nextSheaf.label}` : 'End / GM escalation'}</small></article>
        <article><span>Location</span><strong>{currentNode.title}</strong><small>{currentNode.kind}</small></article>
      </section>

      <section className="crawl-layout">
        <aside className="node-map">
          {host.flow.nodes.map((node) => <button key={node.id} className={`${crawl.currentNodeId === node.id ? 'current' : ''} ${crawl.visitedNodeIds.includes(node.id) ? 'visited' : ''}`} onClick={() => setCrawl((current) => ({ ...current, currentNodeId: node.id, visitedNodeIds: [...new Set([...current.visitedNodeIds, node.id])] }))}>{node.title}</button>)}
        </aside>

        <section className="node-card">
          <p className="kicker">Current node</p>
          <h2>{currentNode.title}</h2>
          <p>{currentNode.description}</p>
          <div className="door-list">
            {currentNode.choices.length === 0 && <p className="empty">No more doors from here.</p>}
            {currentNode.choices.map((choice) => <button key={`${choice.label}-${choice.to}`} onClick={() => choose(choice)}><strong>{choice.label}</strong>{choice.testId && <span>Roll TN {host.taskTargetNumbers[choice.testId] ?? host.hostRating}</span>}</button>)}
          </div>
        </section>

        <aside className="log-panel">
          <h2>Path Log</h2>
          {crawl.path.length === 0 && <p className="empty">No choices yet.</p>}
          {crawl.path.map((entry) => <article key={entry.id}><strong>{entry.choice}</strong><span>{entry.at} · {entry.from} → {entry.to}</span>{entry.dice && <p>{entry.successes} success(es) vs TN {entry.targetNumber}; dice [{entry.dice.join(', ')}]; tally +{entry.tallyIncrease}</p>}{entry.sheaf && entry.sheaf.length > 0 && <p className="sheaf">Sheaf: {entry.sheaf.join(' · ')}</p>}</article>)}
        </aside>
      </section>
    </main>
  )
}

export default App
