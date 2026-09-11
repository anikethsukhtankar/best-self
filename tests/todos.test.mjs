import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTodosForDay, todoDayKey } from '../src/utils/todos.js';

const today = new Date(2026, 8, 10);
const iso = (y, m, d, h = 9) => new Date(y, m - 1, d, h).toISOString();
const todos = [
  { id: 'a', text: 'undated, created today', createdAt: iso(2026, 9, 10) },
  { id: 'b', text: 'due tomorrow', createdAt: iso(2026, 9, 10), dueDate: '2026-09-11' },
  { id: 'c', text: 'open since the 8th', createdAt: iso(2026, 9, 8) },
  { id: 'd', text: 'done yesterday', createdAt: iso(2026, 9, 8), completedAt: iso(2026, 9, 9, 20) },
];
const ids = (date) => getTodosForDay(todos, date, today).map((t) => t.id);

test('a task belongs to its due date, else its creation day', () => {
  assert.equal(todoDayKey(todos[0]), '2026-09-10');
  assert.equal(todoDayKey(todos[1]), '2026-09-11');
});

test('today shows its own tasks plus open tasks carried from earlier days', () => {
  assert.deepEqual(ids(new Date(2026, 8, 10)), ['a', 'c']);
  const carried = getTodosForDay(todos, new Date(2026, 8, 10), today).find((t) => t.id === 'c');
  assert.equal(carried.carriedFrom, '2026-09-08');
});

test('a future day shows only tasks due that day', () => {
  assert.deepEqual(ids(new Date(2026, 8, 11)), ['b']);
});

test('a past day shows tasks completed that day, and does not carry anything forward', () => {
  assert.deepEqual(ids(new Date(2026, 8, 9)), ['d']);
  assert.deepEqual(ids(new Date(2026, 8, 8)), ['c']);
});
