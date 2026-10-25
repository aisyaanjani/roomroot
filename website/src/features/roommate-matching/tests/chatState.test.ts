/// <reference types="node" />
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  chatReducer,
  emptyChatState,
  loadChatState,
  saveChatState,
  unreadMessageCount,
} from '../chatState.ts'

const message = (id: string, sender: 'you' | 'roommate', unread = false) => ({
  id,
  sender,
  text: `${sender} message`,
  createdAt: '2026-10-25T12:00:00.000Z',
  unread,
})

test('starts only one conversation per fictional roommate and sends and reads messages', () => {
  let state = chatReducer(emptyChatState, { type: 'start', roommateId: 'maya', roommateName: 'Maya Chen' })
  state = chatReducer(state, { type: 'start', roommateId: 'maya', roommateName: 'Maya Chen' })
  assert.equal(state.conversations.length, 1)

  state = chatReducer(state, { type: 'send', roommateId: 'maya', message: message('one', 'you') })
  state = chatReducer(state, { type: 'reply', roommateId: 'maya', message: message('two', 'roommate', true) })
  assert.deepEqual(state.conversations[0].messages.map(item => item.sender), ['you', 'roommate'])
  assert.equal(unreadMessageCount(state), 1)

  state = chatReducer(state, { type: 'read', roommateId: 'maya' })
  assert.equal(unreadMessageCount(state), 0)
  assert.equal(state.conversations[0].messages[1].unread, false)
})

test('persists conversations for their housing profile and restores them after reload', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  })
  try {
    const profile = { city: 'Blacksburg', state: 'VA' }
    let state = chatReducer(emptyChatState, { type: 'start', roommateId: 'maya', roommateName: 'Maya Chen' })
    state = chatReducer(state, { type: 'send', roommateId: 'maya', message: message('one', 'you') })
    state = chatReducer(state, { type: 'reply', roommateId: 'maya', message: message('two', 'roommate', true) })
    assert.equal(saveChatState(profile, state), true)
    assert.deepEqual(loadChatState(profile), state)
    assert.deepEqual(loadChatState({ city: 'Boston', state: 'MA' }), emptyChatState)
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})

test('ignores malformed stored conversations and reports storage write failure', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => '{"profile":"{}","state":{"conversations":[{"roommateId":"maya","messages":"invalid"}]}}',
      setItem: () => { throw new Error('storage unavailable') },
    },
  })
  try {
    assert.deepEqual(loadChatState({}), emptyChatState)
    assert.equal(saveChatState({}, emptyChatState), false)
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
