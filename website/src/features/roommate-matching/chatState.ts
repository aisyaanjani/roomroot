export interface ChatMessage {
  id: string
  sender: 'you' | 'roommate'
  text: string
  createdAt: string
  unread: boolean
}

export interface ChatConversation {
  roommateId: string
  roommateName: string
  messages: ChatMessage[]
}

export interface ChatState {
  conversations: ChatConversation[]
}

export type ChatAction =
  | { type: 'start'; roommateId: string; roommateName: string }
  | { type: 'send'; roommateId: string; message: ChatMessage }
  | { type: 'reply'; roommateId: string; message: ChatMessage }
  | { type: 'read'; roommateId: string }

export const emptyChatState: ChatState = { conversations: [] }

const STORAGE_KEY = 'roomroot:demo-chat:v1'

function isMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Record<string, unknown>
  return typeof message.id === 'string'
    && (message.sender === 'you' || message.sender === 'roommate')
    && typeof message.text === 'string'
    && typeof message.createdAt === 'string'
    && !Number.isNaN(Date.parse(message.createdAt))
    && typeof message.unread === 'boolean'
}

function isChatState(value: unknown): value is ChatState {
  if (!value || typeof value !== 'object') return false
  const state = value as Record<string, unknown>
  return Array.isArray(state.conversations) && state.conversations.every(conversation => {
    if (!conversation || typeof conversation !== 'object') return false
    const item = conversation as Record<string, unknown>
    return typeof item.roommateId === 'string'
      && typeof item.roommateName === 'string'
      && Array.isArray(item.messages)
      && item.messages.every(isMessage)
  }) && new Set((state.conversations as Array<{ roommateId: string }>).map(item => item.roommateId)).size
    === state.conversations.length
}

export function loadChatState(profile: object): ChatState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return emptyChatState
    const envelope: unknown = JSON.parse(stored)
    if (!envelope || typeof envelope !== 'object') return emptyChatState
    const record = envelope as Record<string, unknown>
    return record.profile === JSON.stringify(profile) && isChatState(record.state)
      ? record.state
      : emptyChatState
  } catch {
    return emptyChatState
  }
}

export function saveChatState(profile: object, state: ChatState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile: JSON.stringify(profile), state }))
    return true
  } catch {
    return false
  }
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  if (action.type === 'start') {
    if (state.conversations.some(item => item.roommateId === action.roommateId)) return state
    return {
      conversations: [...state.conversations, {
        roommateId: action.roommateId,
        roommateName: action.roommateName,
        messages: [],
      }],
    }
  }

  const conversations = state.conversations.map(conversation => {
    if (conversation.roommateId !== action.roommateId) return conversation
    if (action.type === 'read') {
      return {
        ...conversation,
        messages: conversation.messages.map(message => message.sender === 'roommate'
          ? { ...message, unread: false }
          : message),
      }
    }
    return { ...conversation, messages: [...conversation.messages, action.message] }
  })
  return conversations.some(item => item.roommateId === action.roommateId)
    ? { conversations }
    : state
}

export function unreadMessageCount(state: ChatState) {
  return state.conversations.reduce((total, conversation) => total
    + conversation.messages.filter(message => message.sender === 'roommate' && message.unread).length, 0)
}
