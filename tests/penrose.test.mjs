import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEGMENTS, CORNER, visibleSegments } from '../src/utils/penrose.js';

test('the figure has twelve strokes', () => {
  assert.equal(SEGMENTS.length, 12);
});

test('strokes grow with the share of habits done, and never complete while a habit remains', () => {
  assert.equal(visibleSegments(0, 9, false).size, 0);
  assert.equal(visibleSegments(1, 9, false).size, 1);
  assert.equal(visibleSegments(5, 9, false).size, 6);
  assert.equal(visibleSegments(8, 9, false).has(CORNER), false);
  assert.ok(visibleSegments(8, 9, false).size < 12);
});

test('the corner stroke appears only when the day is complete', () => {
  const v = visibleSegments(8, 9, true);
  assert.equal(v.has(CORNER), true);
  assert.equal(v.size, 11);
  assert.equal(visibleSegments(9, 9, true).size, 12);
  assert.equal(visibleSegments(0, 0, false).size, 0);
});
