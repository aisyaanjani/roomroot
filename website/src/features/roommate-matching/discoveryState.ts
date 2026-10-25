export interface DiscoveryState {
  currentIndex: number
  liked: string[]
  passed: string[]
  saved: string[]
  history: Array<Omit<DiscoveryState, 'history'>>
}

export type DiscoveryAction =
  | { type: 'like'; id: string }
  | { type: 'pass'; id: string }
  | { type: 'save'; id: string }
  | { type: 'undo' }
  | { type: 'rewind' }
  | { type: 'reset' }

export const initialDiscoveryState: DiscoveryState = {
  currentIndex: 0,
  liked: [],
  passed: [],
  saved: [],
  history: [],
}

const STORAGE_KEY = 'roomroot:matching-actions:v1'
const unique = (values: string[]) => [...new Set(values)]

function isSnapshot(value: unknown): value is Omit<DiscoveryState, 'history'> {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Record<string, unknown>
  return Number.isInteger(snapshot.currentIndex) && Number(snapshot.currentIndex) >= 0
    && ['liked', 'passed', 'saved'].every(key => Array.isArray(snapshot[key]) && (snapshot[key] as unknown[]).every(id => typeof id === 'string'))
}

function isDiscoveryState(value: unknown): value is DiscoveryState {
  if (!isSnapshot(value)) return false
  const state = value as unknown as Record<string, unknown>
  return Array.isArray(state.history) && state.history.every(isSnapshot)
}

export function loadDiscoveryState(profile: object): DiscoveryState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return initialDiscoveryState
    const envelope: unknown = JSON.parse(stored)
    if (!envelope || typeof envelope !== 'object') return initialDiscoveryState
    const record = envelope as Record<string, unknown>
    return record.profile === JSON.stringify(profile) && isDiscoveryState(record.state)
      ? record.state
      : initialDiscoveryState
  } catch {
    return initialDiscoveryState
  }
}

export function saveDiscoveryState(profile: object, state: DiscoveryState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile: JSON.stringify(profile), state }))
    return true
  } catch {
    return false
  }
}

export function discoveryReducer(state: DiscoveryState, action: DiscoveryAction): DiscoveryState {
  if (action.type === 'reset') return initialDiscoveryState
  if (action.type === 'rewind') return { ...state, currentIndex: 0, history: [] }
  if (action.type === 'undo') {
    const previous = state.history.at(-1)
    return previous ? { ...previous, history: state.history.slice(0, -1) } : state
  }

  const snapshot = {
    currentIndex: state.currentIndex,
    liked: state.liked,
    passed: state.passed,
    saved: state.saved,
  }
  if (action.type === 'save') {
    const saved = state.saved.includes(action.id)
      ? state.saved.filter(id => id !== action.id)
      : unique([...state.saved, action.id])
    return { ...state, saved, history: [...state.history, snapshot] }
  }
  if (action.type === 'like') {
    return {
      ...state,
      currentIndex: state.currentIndex + 1,
      liked: unique([...state.liked, action.id]),
      history: [...state.history, snapshot],
    }
  }
  return {
    ...state,
    currentIndex: state.currentIndex + 1,
    passed: unique([...state.passed, action.id]),
    history: [...state.history, snapshot],
  }
}
