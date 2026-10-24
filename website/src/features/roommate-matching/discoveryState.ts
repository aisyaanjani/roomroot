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

const unique = (values: string[]) => [...new Set(values)]

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
