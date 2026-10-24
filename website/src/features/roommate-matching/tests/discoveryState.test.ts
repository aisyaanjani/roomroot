/// <reference types="node" />
import assert from 'node:assert/strict'
import test from 'node:test'
import { discoveryReducer, initialDiscoveryState } from '../discoveryState.ts'

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
