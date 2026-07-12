import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
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
  unlockSuccesses?: number
  targetNumber?: number
  securityValue?: number
}

interface FlowNode {
  id: string
  title: string
  kind: string
  description: string
  choices: FlowChoice[]
}

type ThreatType = 'probe' | 'trace' | 'scramble' | 'tarBaby' | 'killer' | 'blaster' | 'sparky' | 'black' | 'psychotropic' | 'generic'
type RunEndKind = 'gracefulLogoff' | 'emergencyJackOut' | 'iconCrashed' | 'traceCompleted' | 'blackIcHarm' | 'psychotropicHarm' | 'objectiveComplete' | 'shutdownDumpshock' | 'failedJackoutDumpshock'
type AlertState = 'normal' | 'passive' | 'active' | 'shutdown'

interface SecuritySheafStep {
  threshold: number
  label: string
  effect: string
  encounter?: {
    type?: ThreatType
    rating?: number
    terminalOnFail?: boolean
    consequence?: string
  }
}

interface HostProfile {
  schemaVersion?: string
  id: string
  name: string
  wikiPage?: string
  securityCode: string
  securityValue: number
  hostRating: number
  shutdownTally?: number
  subsystem: Record<string, number>
  taskTargetNumbers: Record<string, number>
  securitySheaf: SecuritySheafStep[]
  sculpting: string
  notes: string
  flow: { startNodeId: string; nodes: FlowNode[] }
}

interface HostIndexEntry {
  id: string
  name: string
  url: string
  wikiPage?: string
}

interface HostIndex {
  schemaVersion?: string
  hosts: HostIndexEntry[]
}

interface PathEntry {
  id: string
  at: string
  from: string
  verb: string
  choice: string
  to: string
  testId?: string
  targetNumber?: number
  dicePool?: number
  hackingPoolIncluded?: number
  dice?: number[]
  successes?: number
  requiredSuccesses?: number
  outcome?: 'opened' | 'unlocked' | 'locked' | 'gm' | 'threat'
  tallyIncrease?: number
  sheaf?: string[]
}

interface ChoiceGateState {
  state: 'unlocked' | 'locked'
  at: string
  successes?: number
  requiredSuccesses?: number
}

interface RollFeedback {
  id: number
  tone: 'success' | 'failure' | 'neutral'
  icon: string
  title: string
  detail: string
}

interface ThreatCheckpoint {
  id: string
  threshold: number
  label: string
  effect: string
  rating: number
  type: ThreatType
  consequence: string
  terminalOnFail: boolean
  status: 'pending' | 'active'
}

interface RunOutcome {
  id: string
  title: string
  detail: string
  notifyGm: boolean
}

interface PoolLock {
  id: string
  label: string
  dice: number
  reason: string
}

interface RunEndState {
  id: string
  kind: RunEndKind
  title: string
  detail: string
  notifyGm: string
}

interface CrawlState {
  currentNodeId: string
  visitedNodeIds: string[]
  revealedNodeIds?: string[]
  choiceGates?: Record<string, ChoiceGateState>
  pendingThreats?: ThreatCheckpoint[]
  activeThreats?: ThreatCheckpoint[]
  poolLocks?: PoolLock[]
  dfPoolReserve?: number
  outcomes?: RunOutcome[]
  runEnd?: RunEndState
  securityTally: number
  path: PathEntry[]
}

const EMPTY_CHOICE_GATES: Record<string, ChoiceGateState> = {}
const EMPTY_THREATS: ThreatCheckpoint[] = []
const EMPTY_OUTCOMES: RunOutcome[] = []
const EMPTY_POOL_LOCKS: PoolLock[] = []

interface StoredAppState {
  version: 1
  deck: DeckRuntime
  host: HostProfile
  hostUrl: string
  crawl: CrawlState
}

const DECK_MANAGER_STORAGE_KEY = 'cindylou.sr3MevinDeckManager.v1'
const STORAGE_KEY = 'cindylou.mevinDeckerExperience.v1'
const HOST_INDEX_URL = 'https://hanclintoclaw-pixel.github.io/campaign-wiki/data/matrix-hosts/index.json'
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
  name: 'No scenario loaded',
  securityCode: 'green',
  securityValue: 4,
  hostRating: 4,
  subsystem: { access: 4, control: 3, index: 4, files: 4, slave: 3 },
  taskTargetNumbers: { logon: 4 },
  securitySheaf: [],
  sculpting: 'Load a fictional Matrix host scenario from the campaign wiki.',
  notes: '',
  flow: {
    startNodeId: 'load-host',
    nodes: [{ id: 'load-host', title: 'No Scenario Loaded', kind: 'setup', description: 'Fetch or import a scenario JSON profile to begin the flowchart scene.', choices: [] }],
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

function poolLockTotal(poolLocks: PoolLock[]) {
  return poolLocks.reduce((sum, lock) => sum + lock.dice, 0)
}

function dfBonusFromReserve(dfPoolReserve: number) {
  return Math.min(3, Math.floor(dfPoolReserve / 2))
}

function freshCrawl(host: HostProfile): CrawlState {
  return { currentNodeId: host.flow.startNodeId, visitedNodeIds: [host.flow.startNodeId], revealedNodeIds: [host.flow.startNodeId], choiceGates: {}, pendingThreats: [], activeThreats: [], poolLocks: [], dfPoolReserve: 0, outcomes: [], securityTally: 0, path: [] }
}

function unique(values: string[]) {
  return [...new Set(values)]
}

function choiceKey(nodeId: string, choiceIndex: number) {
  return `${nodeId}:${choiceIndex}`
}

function normalizeCrawl(crawl: CrawlState, host: HostProfile): CrawlState {
  const revealedNodeIds = crawl.revealedNodeIds?.length ? crawl.revealedNodeIds : crawl.visitedNodeIds
  const currentNodeId = revealedNodeIds.includes(crawl.currentNodeId) ? crawl.currentNodeId : host.flow.startNodeId
  return {
    ...crawl,
    currentNodeId,
    visitedNodeIds: unique(crawl.visitedNodeIds.length ? crawl.visitedNodeIds : [host.flow.startNodeId]),
    revealedNodeIds: unique(revealedNodeIds.length ? revealedNodeIds : [host.flow.startNodeId]),
    choiceGates: crawl.choiceGates ?? {},
    pendingThreats: crawl.pendingThreats ?? [],
    activeThreats: crawl.activeThreats ?? [],
    poolLocks: crawl.poolLocks ?? [],
    dfPoolReserve: crawl.dfPoolReserve ?? 0,
    outcomes: crawl.outcomes ?? [],
    runEnd: crawl.runEnd,
    path: crawl.path ?? [],
  }
}

function isHostProfile(value: unknown): value is HostProfile {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<HostProfile>
  return Boolean(candidate.id && candidate.name && candidate.flow?.startNodeId && Array.isArray(candidate.flow.nodes))
}

function isHostIndex(value: unknown): value is HostIndex {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<HostIndex>
  return Array.isArray(candidate.hosts) && candidate.hosts.every((hostEntry) => Boolean(hostEntry.id && hostEntry.name && hostEntry.url))
}

function loadStoredAppState(): StoredAppState {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return { version: 1, deck: seedDeck, host: seedHost, hostUrl: HAPPY_CAT_URL, crawl: freshCrawl(seedHost) }
  try {
    const parsed = JSON.parse(stored) as Partial<StoredAppState> | CrawlState
    if ('host' in parsed && isHostProfile(parsed.host) && parsed.crawl?.currentNodeId) {
      return { version: 1, deck: parsed.deck ?? seedDeck, host: parsed.host, hostUrl: parsed.hostUrl ?? HAPPY_CAT_URL, crawl: normalizeCrawl(parsed.crawl, parsed.host) }
    }
    if ('currentNodeId' in parsed && parsed.currentNodeId) {
      return { version: 1, deck: seedDeck, host: seedHost, hostUrl: HAPPY_CAT_URL, crawl: normalizeCrawl(parsed as CrawlState, seedHost) }
    }
  } catch {
    // Fall through to a fresh starter state.
  }
  return { version: 1, deck: seedDeck, host: seedHost, hostUrl: HAPPY_CAT_URL, crawl: freshCrawl(seedHost) }
}

function verbForChoice(choice: FlowChoice) {
  if (!choice.testId) return 'Move'
  if (choice.testId === 'logon') return 'Enter'
  if (choice.testId === 'browsePublic') return 'Survey'
  if (choice.testId === 'searchCustomer') return 'Search'
  if (choice.testId === 'staffRecords') return 'Open'
  if (choice.testId === 'controlSlave' || choice.testId === 'alterStore') return 'Command'
  if (choice.testId === 'findUvSeam') return 'Find Seam'
  if (choice.testId === 'breachUv') return 'Breach UV'
  if (choice.testId === 'evadeTrace') return 'Slip Away'
  if (choice.testId === 'fightIc') return 'Face Opposition'
  return 'Act'
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
    findUvSeam: ['sensor', 'stealth', 'special'],
    breachUv: ['stealth', 'special', 'utility'],
  }
  const wanted = categories[testId ?? ''] ?? ['utility']
  return deck.utilities.filter((utility) => wanted.includes(utility.category) && utility.status !== 'burned').reduce((best, utility) => Math.max(best, utility.rating), 0)
}

function testPersona(testId?: string): PersonaKey {
  if (testId === 'evadeTrace' || testId === 'logon') return 'masking'
  if (testId === 'controlSlave' || testId === 'alterStore' || testId === 'breachUv') return 'masking'
  if (testId === 'fightIc') return 'bod'
  return 'sensors'
}

function threatTypeFromLabel(label: string): ThreatType {
  const lower = label.toLowerCase()
  if (lower.includes('psychotropic')) return 'psychotropic'
  if (lower.includes('black')) return 'black'
  if (lower.includes('trace')) return 'trace'
  if (lower.includes('scramble')) return 'scramble'
  if (lower.includes('tar')) return 'tarBaby'
  if (lower.includes('killer')) return 'killer'
  if (lower.includes('blaster')) return 'blaster'
  if (lower.includes('sparky')) return 'sparky'
  if (lower.includes('probe') || lower.includes('scout')) return 'probe'
  return 'generic'
}

function descriptionForThreat(type: ThreatType) {
  const descriptions: Record<ThreatType, string> = {
    probe: 'Probe/Scout IC studies your icon, credentials, and behavior. If left active, the host may identify your signature or make future security response more precise.',
    trace: 'Trace IC tries to connect your icon to a route, jackpoint, address, or other real-world handle. Ignoring it can end the run with a trace-completed outcome.',
    scramble: 'Scramble IC interferes with files, records, maps, and paydata. If left active, recovered data may be partial, corrupted, noisy, or require GM confirmation before it can be trusted.',
    tarBaby: 'Tar Baby-style IC tries to hold you in place. If left active, movement, clean logoff, or retreat may be harder and should be reported at run end.',
    killer: 'Killer IC attacks the icon directly. Failed handling can crash the icon, damage the deck/persona, and end the run.',
    blaster: 'Blaster IC is destructive anti-intrusion pressure. Failed handling can damage the deck, crash the icon, and end the run.',
    sparky: 'Sparky IC stresses connected hardware and interface systems. Failed handling can crash the run or create repair/gear consequences for the GM to adjudicate.',
    black: 'Black IC is biofeedback danger. Failed handling can end the run with harm that must be resolved with the GM.',
    psychotropic: 'Psychotropic IC attacks perception, emotion, memory, or behavior. Failed handling can create a lasting mental or behavioral consequence for GM adjudication.',
    generic: 'This is active host security pressure. If left active, it increases risk on future tested actions and should be reported if still active when the run ends.',
  }
  return descriptions[type]
}

function actionDetailsForThreat(threat: ThreatCheckpoint) {
  const terminalKind = terminalKindForThreat(threat.type)
  return {
    suppress: `Roll vs TN ${threat.rating}, need 1 success. On success, clear this checkpoint and continue. On failure, it becomes active pressure${threat.terminalOnFail && terminalKind ? ' or may end the run for severe IC' : ''}.`,
    fight: `Roll vs TN ${threat.rating}, need 2 successes. Best for destructive IC, but failure can leave it active${threat.terminalOnFail && terminalKind ? ' or crash/end the run' : ''}.`,
    ignore: threat.type === 'trace' ? 'Do not roll. Trace completes immediately and the run ends; alert the GM.' : 'Do not roll. Continue the run, but this IC stays active and adds +1 Tally pressure to future tested actions.',
    jackout: `Roll vs TN ${Math.max(4, threat.rating - 1)}, need 1 success. On success, end the run with Emergency Jack Out. On failure, the IC stays dangerous${threat.terminalOnFail && terminalKind ? ' and may force its terminal consequence' : ''}.`,
  }
}

function consequenceForThreat(type: ThreatType, label: string) {
  const consequences: Record<ThreatType, string> = {
    probe: `${label}: host has a better read on the icon signature. Notify the GM if this remains active at run end.`,
    trace: `${label}: trace risk is live. Notify the GM; the decker may be locatable if this is ignored or the run ends under pressure.`,
    scramble: `${label}: records/paydata may be corrupted, partial, or noisy until cleared. Notify the GM before trusting recovered data.`,
    tarBaby: `${label}: movement or clean logoff may be impaired. Notify the GM if the decker exits with this still active.`,
    killer: `${label}: ICON/deck damage risk. A failed checkpoint can crash the run.`,
    blaster: `${label}: destructive IC pressure. A failed checkpoint can crash the run or damage the deck.`,
    sparky: `${label}: hardware stress risk. Notify the GM if this hits or remains active at run end.`,
    black: `${label}: black IC biofeedback risk. Failed handling can end the run with harm requiring GM adjudication.`,
    psychotropic: `${label}: psychotropic pressure risk. Failed handling can create a mental/behavioral consequence requiring GM adjudication.`,
    generic: `${label}: active IC/security pressure. Notify the GM if it remains active at run end.`,
  }
  return consequences[type]
}

function terminalKindForThreat(type: ThreatType): RunEndKind | undefined {
  if (type === 'trace') return 'traceCompleted'
  if (type === 'black') return 'blackIcHarm'
  if (type === 'psychotropic') return 'psychotropicHarm'
  if (type === 'killer' || type === 'blaster' || type === 'sparky') return 'iconCrashed'
  return undefined
}

function outcomeForNode(node: FlowNode): RunOutcome | undefined {
  if (!['reward', 'gm-reward', 'paydata', 'permanent-outcome', 'major-reward'].includes(node.kind)) return undefined
  return {
    id: node.id,
    title: node.title,
    detail: node.description,
    notifyGm: node.kind === 'gm-reward' || node.kind === 'permanent-outcome' || node.kind === 'major-reward' || node.kind === 'paydata',
  }
}

function shutdownTallyForHost(host: HostProfile) {
  if (host.shutdownTally && host.shutdownTally > 0) return host.shutdownTally
  const lastSheafThreshold = host.securitySheaf.reduce((highest, step) => Math.max(highest, step.threshold), 0)
  return Math.max(host.hostRating * 3, lastSheafThreshold + host.securityValue)
}

function alertStateForTally(securityTally: number, shutdownTally: number): AlertState {
  if (securityTally >= shutdownTally) return 'shutdown'
  if (securityTally >= Math.ceil((shutdownTally * 2) / 3)) return 'active'
  if (securityTally >= Math.ceil(shutdownTally / 3)) return 'passive'
  return 'normal'
}

function alertLabel(alertState: AlertState) {
  if (alertState === 'passive') return 'Passive Alert'
  if (alertState === 'active') return 'Active Alert'
  if (alertState === 'shutdown') return 'Shutdown'
  return 'Normal'
}

function dumpshockRunEnd(kind: 'shutdownDumpshock' | 'failedJackoutDumpshock', detail: string): RunEndState {
  const title = kind === 'shutdownDumpshock' ? 'Host Shutdown / Dumpshock' : 'Failed Jack Out / Dumpshock'
  return {
    id: `run-end-${Date.now()}`,
    kind,
    title,
    detail,
    notifyGm: `RUN OVER — alert the GM: ${title}. Resolve dumpshock as close to SR3 RAW as the table wants; the decker has been forcibly dumped from the host and may suffer disorientation/stun or harsher IC-linked consequences at GM discretion.`,
  }
}

function runEndForNode(node: FlowNode, activeThreats: ThreatCheckpoint[]): RunEndState | undefined {
  if (node.kind !== 'exit' && node.choices.length > 0) return undefined
  return {
    id: `run-end-${Date.now()}`,
    kind: node.kind === 'exit' ? 'gracefulLogoff' : 'objectiveComplete',
    title: node.kind === 'exit' ? 'Graceful Logoff' : 'Run Objective Complete',
    detail: node.description,
    notifyGm: activeThreats.length > 0 ? 'Tell the GM the run ended while IC/security pressure was still active.' : 'Tell the GM the final recovered data, permanent changes, and clean-exit status.',
  }
}

function runEndForThreat(threat: ThreatCheckpoint, kind: RunEndKind): RunEndState {
  const titles: Record<RunEndKind, string> = {
    gracefulLogoff: 'Graceful Logoff',
    emergencyJackOut: 'Emergency Jack Out',
    iconCrashed: 'ICON Crashed / Deck Damaged',
    traceCompleted: 'Trace Completed',
    blackIcHarm: 'Black IC Harm',
    psychotropicHarm: 'Psychotropic IC Consequence',
    objectiveComplete: 'Run Objective Complete',
    shutdownDumpshock: 'Host Shutdown / Dumpshock',
    failedJackoutDumpshock: 'Failed Jack Out / Dumpshock',
  }
  return {
    id: `run-end-${Date.now()}`,
    kind,
    title: titles[kind],
    detail: threat.consequence,
    notifyGm: `RUN OVER — alert the GM to final outcome: ${titles[kind]}. ${threat.consequence}`,
  }
}

function buildRunReport(host: HostProfile, deck: DeckRuntime, crawl: CrawlState, runEnd: RunEndState, outcomes: RunOutcome[], activeThreats: ThreatCheckpoint[], poolLocks: PoolLock[], dfPoolReserve: number) {
  const dfBonus = dfBonusFromReserve(dfPoolReserve)
  const shutdownTally = shutdownTallyForHost(host)
  const lines = [
    `RUN OVER — ALERT THE GM`,
    `Host: ${host.name}`,
    `Deck/Icon: ${deck.sourceName} (${deck.handle})`,
    `Final outcome: ${runEnd.title}`,
    `Final Security Tally: ${crawl.securityTally} / ${shutdownTally}`,
    `Hacking Pool tied up: ${poolLockTotal(poolLocks) + dfPoolReserve}`,
    `Effective Detection Factor: ${deck.detectionFactor + dfBonus}${dfBonus > 0 ? ` (base ${deck.detectionFactor} + ${dfBonus} from reserved pool)` : ''}`,
    `Outcome detail: ${runEnd.detail}`,
    `GM notice: ${runEnd.notifyGm}`,
    '',
    `Recovered / changed outcomes (${outcomes.length}):`,
    ...(outcomes.length > 0 ? outcomes.map((outcome, index) => `${index + 1}. ${outcome.title}${outcome.notifyGm ? ' — notify GM' : ''}: ${outcome.detail}`) : ['None recorded.']),
    '',
    `Unresolved IC / consequences (${activeThreats.length}):`,
    ...(activeThreats.length > 0 ? activeThreats.map((threat, index) => `${index + 1}. ${threat.label} [${threat.type}, Rating ${threat.rating}]: ${threat.consequence}`) : ['None recorded.']),
    '',
    `Pool allocations (${poolLocks.length + (dfPoolReserve > 0 ? 1 : 0)}):`,
    ...(dfPoolReserve > 0 ? [`DF reserve: ${dfPoolReserve} Hacking Pool dice (${dfBonus > 0 ? `+${dfBonus} DF` : 'no DF bonus until 2 dice are reserved'})`] : []),
    ...(poolLocks.length > 0 ? poolLocks.map((lock, index) => `${index + 1}. ${lock.reason}: ${lock.label} (${lock.dice} die/dice)`) : dfPoolReserve > 0 ? [] : ['None recorded.']),
  ]
  return lines.join('\n')
}

function App() {
  const [initialState] = useState(loadStoredAppState)
  const [deck, setDeck] = useState<DeckRuntime>(initialState.deck)
  const [host, setHost] = useState<HostProfile>(initialState.host)
  const [hostUrl, setHostUrl] = useState(initialState.hostUrl)
  const [hostIndex, setHostIndex] = useState<HostIndexEntry[]>([])
  const [crawl, setCrawl] = useState<CrawlState>(initialState.crawl)
  const [message, setMessage] = useState('')
  const [rollFeedback, setRollFeedback] = useState<RollFeedback | undefined>()
  const [computerSkill, setComputerSkill] = useState(8)
  const [hackingPoolAvailable, setHackingPoolAvailable] = useState(6)
  const [selectedChoiceIndex, setSelectedChoiceIndex] = useState(0)
  const currentNode = useMemo(() => host.flow.nodes.find((node) => node.id === crawl.currentNodeId) ?? host.flow.nodes[0], [host, crawl.currentNodeId])
  const revealedNodeIds = crawl.revealedNodeIds ?? crawl.visitedNodeIds
  const choiceGates = crawl.choiceGates ?? EMPTY_CHOICE_GATES
  const pendingThreat = crawl.pendingThreats?.[0]
  const activeThreats = crawl.activeThreats ?? EMPTY_THREATS
  const poolLocks = crawl.poolLocks ?? EMPTY_POOL_LOCKS
  const outcomes = crawl.outcomes ?? EMPTY_OUTCOMES
  const runEnd = crawl.runEnd
  const lockedPoolDice = poolLockTotal(poolLocks)
  const dfPoolReserve = Math.min(crawl.dfPoolReserve ?? 0, 6, Math.max(0, hackingPoolAvailable - lockedPoolDice))
  const effectiveHackingPool = Math.max(0, hackingPoolAvailable - lockedPoolDice - dfPoolReserve)
  const dfBonus = dfBonusFromReserve(dfPoolReserve)
  const effectiveDetectionFactor = deck.detectionFactor + dfBonus
  const totalCommittedPool = lockedPoolDice + dfPoolReserve
  const maxDfPoolReserve = Math.min(6, Math.max(0, hackingPoolAvailable - lockedPoolDice))
  const shutdownTally = shutdownTallyForHost(host)
  const alertState = alertStateForTally(crawl.securityTally, shutdownTally)
  const passiveAlertAt = Math.ceil(shutdownTally / 3)
  const activeAlertAt = Math.ceil((shutdownTally * 2) / 3)
  const nextSheaf = host.securitySheaf.find((step) => step.threshold > crawl.securityTally)
  const selectedChoice = currentNode.choices[selectedChoiceIndex]
  const selectedChoiceGate = selectedChoice ? choiceGates[choiceKey(currentNode.id, selectedChoiceIndex)] : undefined
  const selectedRequiredSuccesses = selectedChoice?.testId ? Math.max(1, selectedChoice.unlockSuccesses ?? 1) : 0
  const selectedPersona = selectedChoice ? testPersona(selectedChoice.testId) : 'sensors'
  const selectedUtility = selectedChoice ? bestUtility(deck, selectedChoice.testId) : 0
  const selectedTargetNumber = selectedChoice?.testId ? (selectedChoice.targetNumber ?? host.taskTargetNumbers[selectedChoice.testId] ?? host.hostRating) : undefined
  const selectedDicePool = selectedChoice?.testId ? Math.max(1, computerSkill + effectiveHackingPool) : undefined
  const pendingThreatActionDetails = pendingThreat ? actionDetailsForThreat(pendingThreat) : undefined
  const runReport = useMemo(() => runEnd ? buildRunReport(host, deck, crawl, runEnd, outcomes, activeThreats, poolLocks, dfPoolReserve) : '', [activeThreats, crawl, deck, dfPoolReserve, host, outcomes, poolLocks, runEnd])

  useEffect(() => {
    const selectedKey = choiceKey(currentNode.id, selectedChoiceIndex)
    if (selectedChoiceIndex < currentNode.choices.length && choiceGates[selectedKey]?.state !== 'locked') return
    const firstOpenChoice = currentNode.choices.findIndex((_, index) => choiceGates[choiceKey(currentNode.id, index)]?.state !== 'locked')
    setSelectedChoiceIndex(firstOpenChoice >= 0 ? firstOpenChoice : 0)
  }, [choiceGates, currentNode, selectedChoiceIndex])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, deck, host, hostUrl, crawl }))
  }, [crawl, deck, host, hostUrl])

  useEffect(() => {
    void fetchHostIndex(true)
  }, [])

  function syncDeck() {
    const stored = localStorage.getItem(DECK_MANAGER_STORAGE_KEY)
    if (!stored) {
      setMessage('No Deck Manager state found on this site origin. On GitHub Pages, open Deck Manager in the same browser first; otherwise export JSON there and import it here.')
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

  function applyHostProfile(nextHost: unknown, source: string) {
    if (!isHostProfile(nextHost)) throw new Error('Scenario JSON must include host id/name and flow.startNodeId with flow.nodes[].')
    setHost(nextHost)
    setCrawl(freshCrawl(nextHost))
    setSelectedChoiceIndex(0)
    setRollFeedback(undefined)
    setMessage(`Loaded ${nextHost.name} from ${source}.`)
  }

  async function fetchHostFromUrl(url: string) {
    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      setMessage('Choose a Host from the wiki list, paste a scenario JSON URL, or import a scenario JSON file.')
      return
    }
    try {
      const response = await fetch(trimmedUrl)
      if (!response.ok) throw new Error(`Scenario fetch failed: ${response.status}`)
      applyHostProfile(await response.json(), trimmedUrl)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Scenario fetch failed.')
    }
  }

  async function fetchHostIndex(silent = false) {
    try {
      const response = await fetch(HOST_INDEX_URL)
      if (!response.ok) throw new Error(`Host index fetch failed: ${response.status}`)
      const nextIndex = await response.json()
      if (!isHostIndex(nextIndex)) throw new Error('Host index JSON must include hosts[].id, name, and url.')
      setHostIndex(nextIndex.hosts)
      if (!silent) setMessage(`Loaded ${nextIndex.hosts.length} wiki Host profiles.`)
    } catch (error) {
      if (!silent) setMessage(error instanceof Error ? error.message : 'Host index fetch failed.')
    }
  }

  function loadIndexedHost(hostEntry: HostIndexEntry) {
    setHostUrl(hostEntry.url)
    void fetchHostFromUrl(hostEntry.url)
  }

  async function importDeck(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const nextDeck = deckFromManager(JSON.parse(await file.text()) as DeckManagerExport)
      setDeck(nextDeck)
      setMessage(`Imported deck JSON: ${nextDeck.sourceName}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Deck import failed.')
    } finally {
      event.target.value = ''
    }
  }

  async function importHost(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      applyHostProfile(JSON.parse(await file.text()), file.name)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Scenario import failed.')
    } finally {
      event.target.value = ''
    }
  }

  function exportCrawl() {
    const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), deck, host, crawl }, null, 2)
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${host.id}-decker-experience-log.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  function resolveSelectedChoice() {
    if (!selectedChoice) return
    const selectedKey = choiceKey(currentNode.id, selectedChoiceIndex)
    if (choiceGates[selectedKey]?.state === 'locked') {
      setMessage('That route is locked by the failed roll. Reset the crawl to try it again.')
      return
    }
    const from = currentNode.id
    let dice: number[] | undefined
    let successes: number | undefined
    let targetNumber: number | undefined
    let dicePool: number | undefined
    let tallyIncrease = 0
    let sheaf: string[] = []
    const poolSpent = selectedChoice.testId ? effectiveHackingPool : 0

    if (selectedChoice.testId) {
      const tn = selectedChoice.targetNumber ?? host.taskTargetNumbers[selectedChoice.testId] ?? host.hostRating
      targetNumber = tn
      dicePool = Math.max(1, computerSkill + effectiveHackingPool)
      dice = Array.from({ length: dicePool }, () => rollOpenD6(tn))
      successes = dice.filter((die) => die >= tn).length
      const securityDice = Array.from({ length: selectedChoice.securityValue ?? host.securityValue }, () => rollOpenD6(effectiveDetectionFactor))
      tallyIncrease = securityDice.filter((die) => die >= effectiveDetectionFactor).length + activeThreats.length
      const after = crawl.securityTally + tallyIncrease
      sheaf = host.securitySheaf.filter((step) => step.threshold > crawl.securityTally && step.threshold <= after).map((step) => `${step.threshold}: ${step.label}`)
    }
    const passed = !selectedChoice.testId || (successes ?? 0) >= selectedRequiredSuccesses
    const outcome = selectedChoice.testId ? (passed ? 'unlocked' : 'locked') : 'opened'

    const entry: PathEntry = {
      id: `path-${Date.now()}`,
      at: new Date().toLocaleTimeString(),
      from,
      verb: verbForChoice(selectedChoice),
      choice: selectedChoice.label,
      to: selectedChoice.to,
      testId: selectedChoice.testId,
      targetNumber,
      dicePool,
      hackingPoolIncluded: poolSpent,
      dice,
      successes,
      requiredSuccesses: selectedChoice.testId ? selectedRequiredSuccesses : undefined,
      outcome,
      tallyIncrease,
      sheaf,
    }

    setRollFeedback({
      id: Date.now(),
      tone: passed ? 'success' : 'failure',
      icon: passed ? '✅' : '⛔',
      title: passed ? (selectedChoice.testId ? 'Branch unlocked' : 'Branch opened') : 'Branch locked',
      detail: selectedChoice.testId ? `${successes ?? 0}/${selectedRequiredSuccesses} successes vs TN ${targetNumber}` : selectedChoice.label,
    })

    setCrawl((current) => {
      const currentRevealedNodeIds = current.revealedNodeIds ?? current.visitedNodeIds
      const gateState: ChoiceGateState = {
        state: outcome === 'locked' ? 'locked' : 'unlocked',
        at: entry.at,
        successes,
        requiredSuccesses: selectedChoice.testId ? selectedRequiredSuccesses : undefined,
      }
      const nextChoiceGates = {
        ...(current.choiceGates ?? {}),
        [selectedKey]: gateState,
      }
      const after = current.securityTally + tallyIncrease
      const existingThreatIds = new Set([...(current.pendingThreats ?? []), ...(current.activeThreats ?? [])].map((threat) => threat.id))
      const newThreats = host.securitySheaf
        .filter((step) => step.threshold > current.securityTally && step.threshold <= after)
        .map((step) => {
          const type = step.encounter?.type ?? threatTypeFromLabel(step.label)
          return {
            id: `threat-${step.threshold}-${step.label}`,
            threshold: step.threshold,
            label: step.label,
            effect: step.effect,
            rating: step.encounter?.rating ?? Math.max(selectedChoice.securityValue ?? host.securityValue, Math.ceil(step.threshold / 2)),
            type,
            consequence: step.encounter?.consequence ?? consequenceForThreat(type, step.label),
            terminalOnFail: step.encounter?.terminalOnFail ?? Boolean(terminalKindForThreat(type)),
            status: 'pending' as const,
          }
        })
        .filter((threat) => !existingThreatIds.has(threat.id))
      const destinationNode = host.flow.nodes.find((node) => node.id === selectedChoice.to)
      const nodeOutcome = passed && destinationNode ? outcomeForNode(destinationNode) : undefined
      const nextOutcomes = nodeOutcome && !(current.outcomes ?? []).some((existing) => existing.id === nodeOutcome.id) ? [...(current.outcomes ?? []), nodeOutcome] : (current.outcomes ?? [])
      const shutdownRunEnd = after >= shutdownTally ? dumpshockRunEnd('shutdownDumpshock', `Security Tally reached ${after}/${shutdownTally}. The host shuts down the run and forcibly dumps the decker.`) : undefined
      const runEnd = shutdownRunEnd ?? (passed && destinationNode ? runEndForNode(destinationNode, current.activeThreats ?? []) : undefined)
      return {
        currentNodeId: passed ? selectedChoice.to : from,
        visitedNodeIds: passed ? unique([...current.visitedNodeIds, selectedChoice.to]) : current.visitedNodeIds,
        revealedNodeIds: passed ? unique([...currentRevealedNodeIds, selectedChoice.to]) : currentRevealedNodeIds,
        choiceGates: nextChoiceGates,
        pendingThreats: [...(current.pendingThreats ?? []), ...newThreats],
        activeThreats: current.activeThreats ?? [],
        outcomes: nextOutcomes,
        runEnd: runEnd ?? current.runEnd,
        securityTally: after,
        path: [entry, ...current.path].slice(0, 60),
      }
    })
    setMessage(passed ? `Unlocked: ${selectedChoice.label}.` : `Locked: ${selectedChoice.label} needed ${selectedRequiredSuccesses} success(es), rolled ${successes ?? 0}.`)
    setSelectedChoiceIndex(0)
  }

  function threatEntry(threat: ThreatCheckpoint, verb: string, choice: string, dice?: number[], successes?: number, targetNumber?: number, requiredSuccesses?: number, tallyIncrease = 0): PathEntry {
    return {
      id: `path-${Date.now()}`,
      at: new Date().toLocaleTimeString(),
      from: currentNode.id,
      verb,
      choice,
      to: currentNode.id,
      testId: 'threatCheckpoint',
      targetNumber,
      dicePool: dice?.length,
      hackingPoolIncluded: dice ? effectiveHackingPool : 0,
      dice,
      successes,
      requiredSuccesses,
      outcome: 'threat',
      tallyIncrease,
      sheaf: [`${threat.threshold}: ${threat.label}`],
    }
  }

  function rollThreatCheckpoint(action: 'suppress' | 'fight' | 'jackout') {
    if (!pendingThreat) return
    const targetNumber = action === 'jackout' ? Math.max(4, pendingThreat.rating - 1) : pendingThreat.rating
    const requiredSuccesses = action === 'fight' ? 2 : 1
    const dicePool = Math.max(1, computerSkill + effectiveHackingPool)
    const dice = Array.from({ length: dicePool }, () => rollOpenD6(targetNumber))
    const successes = dice.filter((die) => die >= targetNumber).length
    const passed = successes >= requiredSuccesses
    const tallyIncrease = passed ? 0 : 1
    const verb = action === 'suppress' ? 'Suppress IC' : action === 'fight' ? 'Cybercombat' : 'Jack Out'
    const entry = threatEntry(pendingThreat, verb, pendingThreat.label, dice, successes, targetNumber, requiredSuccesses, tallyIncrease)
    const logoffNode = host.flow.nodes.find((node) => node.id === 'logoff')
    const failedTerminalKind = !passed && pendingThreat.terminalOnFail ? terminalKindForThreat(pendingThreat.type) : undefined

    setCrawl((current) => {
      const remainingThreats = (current.pendingThreats ?? []).slice(1)
      const activatedThreat = passed || failedTerminalKind || (action === 'jackout' && !passed) ? [] : [{ ...pendingThreat, status: 'active' as const }]
      const emergencyJackOut = passed && action === 'jackout'
      const failedJackout = !passed && action === 'jackout'
      const after = current.securityTally + tallyIncrease
      const shutdownRunEnd = after >= shutdownTally ? dumpshockRunEnd('shutdownDumpshock', `Security Tally reached ${after}/${shutdownTally}. The host shuts down the run and forcibly dumps the decker.`) : undefined
      const runEnd = shutdownRunEnd ?? (failedJackout ? dumpshockRunEnd('failedJackoutDumpshock', `${pendingThreat.label} caught the decker during a failed jackout attempt.`) : failedTerminalKind ? runEndForThreat(pendingThreat, failedTerminalKind) : emergencyJackOut ? {
        id: `run-end-${Date.now()}`,
        kind: 'emergencyJackOut' as const,
        title: 'Emergency Jack Out',
        detail: `${pendingThreat.label} was handled by cutting the run short.`,
        notifyGm: 'RUN OVER — alert the GM: emergency jack out before completing a graceful host logoff.',
      } : current.runEnd)
      return {
        ...current,
        currentNodeId: emergencyJackOut && logoffNode ? logoffNode.id : current.currentNodeId,
        visitedNodeIds: emergencyJackOut && logoffNode ? unique([...current.visitedNodeIds, logoffNode.id]) : current.visitedNodeIds,
        revealedNodeIds: emergencyJackOut && logoffNode ? unique([...(current.revealedNodeIds ?? current.visitedNodeIds), logoffNode.id]) : current.revealedNodeIds,
        pendingThreats: remainingThreats,
        activeThreats: [...(current.activeThreats ?? []), ...activatedThreat],
        runEnd,
        securityTally: after,
        path: [entry, ...current.path].slice(0, 60),
      }
    })
    setRollFeedback({
      id: Date.now(),
      tone: passed ? 'success' : 'failure',
      icon: passed ? '🧊' : '⚠️',
      title: passed ? `${verb} succeeded` : `${pendingThreat.label} is active`,
      detail: `${successes}/${requiredSuccesses} successes vs TN ${targetNumber}`,
    })
    setMessage(passed ? `${pendingThreat.label} handled.` : `${pendingThreat.label} remains active and will add pressure to future tests.`)
  }

  function suppressThreatWithPool() {
    if (!pendingThreat) return
    if (effectiveHackingPool < 1) {
      setMessage('No free Hacking Pool dice are available to suppress this IC.')
      return
    }
    const dice = 1
    const entry = threatEntry(pendingThreat, 'Pool Suppression', `${pendingThreat.label} suppressed with 1 Hacking Pool die`)
    const poolLock: PoolLock = { id: `pool-lock-${pendingThreat.id}-${Date.now()}`, label: pendingThreat.label, dice, reason: 'IC suppression' }
    setCrawl((current) => ({
      ...current,
      pendingThreats: (current.pendingThreats ?? []).slice(1),
      poolLocks: [...(current.poolLocks ?? []), poolLock],
      path: [entry, ...current.path].slice(0, 60),
    }))
    setRollFeedback({ id: Date.now(), tone: 'success', icon: '🔒', title: `${pendingThreat.label} suppressed`, detail: '1 Hacking Pool die tied up until the run resets/ends.' })
    setMessage(`${pendingThreat.label} suppressed by tying up 1 Hacking Pool die. Future rolls use a smaller effective pool.`)
  }

  function ignoreThreatCheckpoint() {
    if (!pendingThreat) return
    const entry = threatEntry(pendingThreat, 'Ignore IC', `${pendingThreat.label} stays active`)
    setCrawl((current) => {
      const terminalKind = pendingThreat.type === 'trace' ? terminalKindForThreat(pendingThreat.type) : undefined
      return {
        ...current,
        pendingThreats: (current.pendingThreats ?? []).slice(1),
        activeThreats: terminalKind ? (current.activeThreats ?? []) : [...(current.activeThreats ?? []), { ...pendingThreat, status: 'active' }],
        runEnd: terminalKind ? runEndForThreat(pendingThreat, terminalKind) : current.runEnd,
        path: [entry, ...current.path].slice(0, 60),
      }
    })
    setRollFeedback({ id: Date.now(), tone: 'neutral', icon: '👁️', title: `${pendingThreat.label} ignored`, detail: 'It stays active and adds pressure to future tested actions.' })
    setMessage(`${pendingThreat.label} is now active. Continuing under pressure.`)
  }

  function copyRunReport() {
    if (!runReport) return
    void navigator.clipboard.writeText(runReport).then(() => {
      setMessage('Run report copied for Discord / GM handoff.')
    }).catch(() => {
      setMessage('Copy failed; select the run report text manually.')
    })
  }

  function resetCrawl() {
    setCrawl(freshCrawl(host))
    setSelectedChoiceIndex(0)
    setRollFeedback(undefined)
  }

  return (
    <main className="crawl-shell">
      <header className="crawl-hero">
        <div>
          <p className="kicker">FICTIONAL MATRIX CRAWL // SR3 TABLE AID</p>
          <h1>Mevin Decker Experience</h1>
          <p className="subtitle">A fictional Matrix-host scene flow: doors, nodes, rolls, branches, and tabletop consequences.</p>
          <p className="micro">Build {__SOURCE_COMMIT__} · <a href="https://hanclintoclaw-pixel.github.io/mevin-deck-manager/">Deck Manager</a> · <a href="https://hanclintoclaw-pixel.github.io/campaign-wiki/Documentation/Mevin-Decker-Experience-Manual.html">Manual</a> · <a href="https://hanclintoclaw-pixel.github.io/campaign-wiki/Minigames.html">Minigames</a></p>
        </div>
        <div className="hero-buttons">
          <button onClick={syncDeck}>Sync Deck Manager</button>
          <button onClick={() => void fetchHostIndex()}>Load Host List</button>
          <button onClick={resetCrawl}>Reset Crawl</button>
          <button onClick={exportCrawl}>Export Log</button>
        </div>
      </header>

      {message && <p className="notice">{message}</p>}

      <section className="loader-panel">
        <div>
          <label htmlFor="scenario-url">Scenario JSON URL</label>
          <div className="url-row">
            <input id="scenario-url" value={hostUrl} onChange={(event) => setHostUrl(event.target.value)} />
            <button onClick={() => void fetchHostFromUrl(hostUrl)}>Fetch Scenario</button>
          </div>
          <p className="micro">Wiki-hosted scenario JSON is preferred. If a browser blocks a URL or you are using another site origin, download the JSON and import it manually.</p>
          <div className="host-list">
            <span>Wiki Host Library</span>
            {hostIndex.length === 0 ? <p className="empty">No indexed Hosts loaded yet.</p> : hostIndex.map((hostEntry) => <button key={hostEntry.id} className={host.id === hostEntry.id ? 'selected' : ''} onClick={() => loadIndexedHost(hostEntry)}>{hostEntry.name}</button>)}
          </div>
        </div>
        <div className="import-row">
          <label className="file-button">Import Deck JSON<input type="file" accept="application/json,.json" onChange={(event) => void importDeck(event)} /></label>
          <label className="file-button">Import Scenario JSON<input type="file" accept="application/json,.json" onChange={(event) => void importHost(event)} /></label>
        </div>
      </section>

      <section className="status-grid">
        <article><span>Deck</span><strong>{deck.sourceName}</strong><small>{deck.handle} · DF {effectiveDetectionFactor}{dfPoolReserve > 0 ? ` (${deck.detectionFactor}+${effectiveDetectionFactor - deck.detectionFactor})` : ''} · Pool {effectiveHackingPool}/{hackingPoolAvailable} free, {totalCommittedPool} committed</small></article>
        <article><span>Matrix host</span><strong>{host.name}</strong><small>{host.securityCode.toUpperCase()}-{host.securityValue}</small></article>
        <article><span>Tally</span><strong>{crawl.securityTally}/{shutdownTally}</strong><small>{runEnd ? 'Run over' : pendingThreat ? `Checkpoint: ${pendingThreat.label}` : nextSheaf ? `Next: ${nextSheaf.threshold} ${nextSheaf.label}` : 'End / GM escalation'}</small></article>
        <article><span>Location</span><strong>{runEnd ? runEnd.title : currentNode.title}</strong><small>{activeThreats.length ? `${activeThreats.length} active threat(s)` : currentNode.kind}</small></article>
      </section>

      {alertState !== 'normal' && !runEnd && <section className={`alert-state ${alertState}`}><span className="alert-light" /><article><strong>{alertLabel(alertState)}</strong><small>{alertState === 'passive' ? `Security Tally has reached at least one-third of shutdown (${passiveAlertAt}/${shutdownTally}). The host is suspicious.` : alertState === 'active' ? `Security Tally has reached at least two-thirds of shutdown (${activeAlertAt}/${shutdownTally}). The host is actively responding.` : `Security Tally has reached shutdown (${shutdownTally}).`}</small></article></section>}
      {activeThreats.length > 0 && <section className="active-threats"><span>Active pressure</span>{activeThreats.map((threat) => <article key={threat.id}><strong>{threat.label}</strong><small>Rating {threat.rating} · {descriptionForThreat(threat.type)}</small></article>)}</section>}
      {(dfPoolReserve > 0 || poolLocks.length > 0) && <section className="pool-allocations"><span>Pool allocations</span>{dfPoolReserve > 0 && <article><strong>Detection Factor reserve</strong><small>{dfPoolReserve} Hacking Pool dice reserved · effective DF {effectiveDetectionFactor}</small></article>}{poolLocks.map((lock) => <article key={lock.id}><strong>{lock.reason}: {lock.label}</strong><small>{lock.dice} Hacking Pool die/dice tied up until reset/end</small></article>)}</section>}

      <section className="crawl-layout">
        <aside className="node-map">
          {host.flow.nodes.filter((node) => revealedNodeIds.includes(node.id)).map((node) => <button key={node.id} className={`${crawl.currentNodeId === node.id ? 'current' : ''} ${crawl.visitedNodeIds.includes(node.id) ? 'visited' : ''}`} onClick={() => setCrawl((current) => ({ ...current, currentNodeId: node.id, visitedNodeIds: unique([...current.visitedNodeIds, node.id]) }))}>{node.title}</button>)}
          {host.flow.nodes.filter((node) => !revealedNodeIds.includes(node.id)).map((node, index) => <button key={node.id} className="unrevealed" disabled>Unknown route {index + 1}</button>)}
        </aside>

        <section className="node-card">
          <p className="kicker">Current node</p>
          <h2>{currentNode.title}</h2>
          <p>{currentNode.description}</p>
          {rollFeedback && <div key={rollFeedback.id} className={`roll-feedback ${rollFeedback.tone}`}><strong>{rollFeedback.icon} {rollFeedback.title}</strong><span>{rollFeedback.detail}</span></div>}
          {runEnd ? <div className="run-end-card">
            <p className="kicker">RUN OVER — ALERT THE GM</p>
            <h3>{runEnd.title}</h3>
            <p>{runEnd.detail}</p>
            <p className="notice">{runEnd.notifyGm}</p>
            <div className="run-summary-grid">
              <article><span>Final Tally</span><strong>{crawl.securityTally}/{shutdownTally}</strong></article>
              <article><span>Recovered / changed</span><strong>{outcomes.length}</strong></article>
              <article><span>Active threats</span><strong>{activeThreats.length}</strong></article>
            </div>
            {outcomes.length > 0 && <div className="run-summary-list"><h4>Tell the GM / note for later</h4>{outcomes.map((outcome) => <article key={outcome.id}><strong>{outcome.title}</strong><p>{outcome.detail}</p>{outcome.notifyGm && <small>Notify the GM.</small>}</article>)}</div>}
            {activeThreats.length > 0 && <div className="run-summary-list danger"><h4>Unresolved IC / consequences</h4>{activeThreats.map((threat) => <article key={threat.id}><strong>{threat.label}</strong><p>{threat.consequence}</p></article>)}</div>}
            <div className="run-report-box">
              <label htmlFor="run-report">Discord-ready run report</label>
              <textarea id="run-report" readOnly value={runReport} rows={Math.min(18, Math.max(10, runReport.split('\n').length))} />
              <div className="run-report-actions">
                <button onClick={copyRunReport}>Copy run report</button>
                <button onClick={exportCrawl}>Export final log</button>
              </div>
            </div>
          </div> : pendingThreat ? <div className="threat-checkpoint">
            <p className="kicker">Security checkpoint</p>
            <h3>{pendingThreat.label}</h3>
            <p>{pendingThreat.effect}</p>
            <div className="ic-context">
              <strong>{pendingThreat.type} IC / security behavior</strong>
              <span>{descriptionForThreat(pendingThreat.type)}</span>
              <small>{pendingThreat.consequence}</small>
            </div>
            <p className="roll-formula">Rating {pendingThreat.rating}. Normal host choices pause until you handle this alert. Choose whether to clear it, fight it, carry it as active pressure, or end the run by jacking out.</p>
            <div className="roll-grid">
              <label>Computer skill<input type="number" min="1" value={computerSkill} onChange={(event) => setComputerSkill(Number(event.target.value))} /></label>
              <label>Hacking Pool total<input type="number" min="0" value={hackingPoolAvailable} onChange={(event) => setHackingPoolAvailable(Number(event.target.value))} /></label>
              <label>Pool reserved for DF<input type="number" min="0" max={maxDfPoolReserve} value={dfPoolReserve} onChange={(event) => setCrawl((current) => ({ ...current, dfPoolReserve: Math.min(Number(event.target.value), maxDfPoolReserve) }))} /></label>
            </div>
            <p className="roll-formula">Effective roll pool: Computer {computerSkill} + free Hacking Pool {effectiveHackingPool} = {computerSkill + effectiveHackingPool} dice. {lockedPoolDice} pool dice tied up suppressing IC; {dfPoolReserve} reserved for Detection Factor.</p>
            <div className="threat-actions">
              <button onClick={() => rollThreatCheckpoint('suppress')}><strong>Suppress / Evade</strong><span>{pendingThreatActionDetails?.suppress}</span></button>
              <button onClick={suppressThreatWithPool} disabled={effectiveHackingPool < 1}><strong>Suppress with Pool</strong><span>Tie up 1 free Hacking Pool die. Clears this checkpoint without a roll until reset/end.</span></button>
              <button onClick={() => rollThreatCheckpoint('fight')}><strong>Fight IC</strong><span>{pendingThreatActionDetails?.fight}</span></button>
              <button onClick={ignoreThreatCheckpoint}><strong>Ignore and Continue</strong><span>{pendingThreatActionDetails?.ignore}</span></button>
              <button onClick={() => rollThreatCheckpoint('jackout')}><strong>Jack Out</strong><span>{pendingThreatActionDetails?.jackout}</span></button>
            </div>
          </div> : <>
            <div className="action-header"><span>Featured actions</span><small>{currentNode.choices.length} shown · use up to 4 core actions plus a back-out option</small></div>
            <div className="door-list verb-list">
              {currentNode.choices.length === 0 && <p className="empty">No more featured actions from here.</p>}
              {currentNode.choices.map((choice, index) => {
                const gate = choiceGates[choiceKey(currentNode.id, index)]
                const isLocked = gate?.state === 'locked'
                return <button key={`${choice.label}-${choice.to}`} className={`${selectedChoiceIndex === index ? 'selected' : ''} ${isLocked ? 'locked' : ''}`} disabled={isLocked} onClick={() => setSelectedChoiceIndex(index)}><strong>{isLocked ? 'Locked' : verbForChoice(choice)}</strong><span>{isLocked ? 'Route burned by failed roll' : choice.label}</span>{choice.testId && <small>TN {choice.targetNumber ?? host.taskTargetNumbers[choice.testId] ?? host.hostRating} · unlocks on {Math.max(1, choice.unlockSuccesses ?? 1)}+ success(es){gate?.state === 'unlocked' ? ' · unlocked' : ''}</small>}</button>
              })}
            </div>
            {selectedChoice && <div className="roll-preview">
              <p className="kicker">Selected verb</p>
              <h3>{verbForChoice(selectedChoice)}: {selectedChoice.label}</h3>
              {selectedChoiceGate?.state === 'locked' ? <p className="empty">This route is locked. The failed test did not reveal what was beyond it.</p> : selectedChoice.testId ? <>
                <div className="roll-grid">
                  <label>Computer skill<input type="number" min="1" value={computerSkill} onChange={(event) => setComputerSkill(Number(event.target.value))} /></label>
                  <label>Hacking Pool total<input type="number" min="0" value={hackingPoolAvailable} onChange={(event) => setHackingPoolAvailable(Number(event.target.value))} /></label>
                  <label>Pool reserved for DF<input type="number" min="0" max={maxDfPoolReserve} value={dfPoolReserve} onChange={(event) => setCrawl((current) => ({ ...current, dfPoolReserve: Math.min(Number(event.target.value), maxDfPoolReserve) }))} /></label>
                </div>
                <p className="roll-formula">Roll {selectedDicePool} dice vs TN {selectedTargetNumber}. {selectedRequiredSuccesses}+ success(es) unlock this route; zero or too few successes locks it and reveals nothing beyond. Base dice are Computer {computerSkill} + free Hacking Pool {effectiveHackingPool}. {lockedPoolDice} pool dice are tied up suppressing IC; {dfPoolReserve} are reserved for DF {effectiveDetectionFactor}. Relevant persona: {selectedPersona} {deck.persona[selectedPersona]}; best matching utility rating: {selectedUtility}. Host response check rolls {selectedChoice.securityValue ?? host.securityValue} dice vs DF {effectiveDetectionFactor} and may raise Tally{activeThreats.length ? `, plus ${activeThreats.length} active threat pressure` : ''}.</p>
                <button className="roll-button" onClick={resolveSelectedChoice}>Roll to unlock this branch</button>
              </> : <button className="roll-button" onClick={resolveSelectedChoice}>Open this branch</button>}
            </div>}
          </>}
        </section>

        <aside className="log-panel">
          <h2>Path Log</h2>
          {crawl.path.length === 0 && <p className="empty">No choices yet.</p>}
          {crawl.path.map((entry) => <article key={entry.id} className={entry.outcome === 'locked' ? 'failed-entry' : entry.outcome === 'gm' ? 'gm-entry' : entry.outcome === 'threat' ? 'threat-entry' : ''}><strong>{entry.verb}: {entry.choice}</strong><span>{entry.at} · {entry.from} {entry.outcome === 'locked' ? '↛' : entry.outcome === 'gm' ? '◇' : entry.outcome === 'threat' ? '⚠' : '→'} {entry.to}</span>{entry.outcome === 'gm' && <p>Custom action recorded; GM chooses the RAW test, time cost, tally pressure, and fictional outcome.</p>}{entry.dice && <p>{entry.successes} success(es) vs TN {entry.targetNumber}; needed {entry.requiredSuccesses}; pool {entry.dicePool} dice, Hacking Pool included {entry.hackingPoolIncluded}; dice [{entry.dice.join(', ')}]; tally +{entry.tallyIncrease}; {entry.outcome === 'locked' ? 'route locked' : entry.outcome === 'threat' ? 'checkpoint action' : 'route unlocked'}</p>}{entry.sheaf && entry.sheaf.length > 0 && <p className="sheaf">Sheaf: {entry.sheaf.join(' · ')}</p>}</article>)}
        </aside>
      </section>
    </main>
  )
}

export default App
