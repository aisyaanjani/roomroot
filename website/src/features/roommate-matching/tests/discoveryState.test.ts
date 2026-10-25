/// <reference types="node" />
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  discoveryReducer,
  initialDiscoveryState,
  loadDiscoveryState,
  saveDiscoveryState,
} from '../discoveryState.ts'

test('Like and Pass advance the deck and Undo restores the prior action', () => {
  const liked = discoveryReducer(initialDiscoveryState, { type: 'like', id: 'maya' })
  assert.equal(liked.currentIndex, 1)
  assert.deepEqual(liked.liked, ['maya'])
  const passed = discoveryReducer(liked, { type: 'pass', id: 'jordan' })
  assert.equal(passed.currentIndex, 2)
  assert.deepEqual(passed.passed, ['jordan'])
  const undone = discoveryReducer(passed, { type: 'undo' })
  assert.equal(undone.currentIndex, 1)
  assert.deepEqual(undone.passed, [])
});

test('Save toggles without advancing and Undo restores it', () => {
  const saved = discoveryReducer(initialDiscoveryState, { type: 'save', id: 'priya' })
  assert.equal(saved.currentIndex, 0)
  assert.deepEqual(saved.saved, ['priya'])
  const unsaved = discoveryReducer(saved, { type: 'save', id: 'priya' })
  assert.deepEqual(unsaved.saved, [])
  assert.deepEqual(discoveryReducer(unsaved, { type: 'undo' }).saved, ['priya'])
});

test('deck actions persist locally for the same housing profile and restore after reload', () => {
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
    let state = discoveryReducer(initialDiscoveryState, { type: 'like', id: 'maya' })
    state = discoveryReducer(state, { type: 'save', id: 'jordan' })
    assert.equal(saveDiscoveryState(profile, state), true)
    assert.deepEqual(loadDiscoveryState(profile), state)
    assert.deepEqual(loadDiscoveryState({ city: 'Boston', state: 'MA' }), initialDiscoveryState)
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})

test('invalid stored deck actions are ignored and storage write failures are reported', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => '{"profile":"{}","state":{"currentIndex":-1}}',
      setItem: () => { throw new Error('storage unavailable') },
    },
  })
  try {
    assert.deepEqual(loadDiscoveryState({}), initialDiscoveryState)
    assert.equal(saveDiscoveryState({}, initialDiscoveryState), false)
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
