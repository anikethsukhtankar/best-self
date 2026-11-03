// The journey harness: the production build, served locally, driven in headless Chromium at a real
// device scale (a 375px phone and a 1440px desktop, both at 2x), with the clock, the time zone and
// what is stored on the device set per journey. Journeys use these helpers to act the way a person
// does (tap, type, press keys) and to read what is on screen and what was saved.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

export { assert };

export const PORT = Number(process.env.E2E_PORT || 4310);
export const URL = `http://localhost:${PORT}/best-self/`;
export const STORAGE_KEY = 'best-self-state';

// A Chromium build that honours --force-device-scale-factor at any window size. Set
// BEST_SELF_CHROMIUM to use another one; with neither, Playwright's own browser is used.
const SHELL = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const executablePath = process.env.BEST_SELF_CHROMIUM || (fs.existsSync(SHELL) ? SHELL : undefined);

// Serve dist/ (built by the runner) on PORT. Resolves once the server answers.
export async function serve() {
  const child = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const started = Date.now();
  for (;;) {
    try {
      const res = await fetch(URL);
      if (res.ok) return child;
    } catch { /* not up yet */ }
    if (Date.now() - started > 30000) { child.kill(); throw new Error(`preview server did not start on ${PORT}`); }
    await new Promise((r) => setTimeout(r, 200));
  }
}

const browsers = new Map();
async function browserFor(width, dpr) {
  const key = `${width}x${dpr}`;
  if (!browsers.has(key)) {
    browsers.set(key, chromium.launch({
      executablePath,
      args: [`--force-device-scale-factor=${dpr}`, `--window-size=${width},${width < 768 ? 812 : 900}`],
    }));
  }
  return browsers.get(key);
}
export async function closeBrowsers() {
  for (const b of browsers.values()) await (await b).close();
  browsers.clear();
}

// Open the app as a person would find it.
//   state: what is already stored on this device (an object), or false for a first visit.
//   now:   local wall-clock time in `tz`, e.g. '2026-11-03T08:00:00'.
//   width: 1440 (desktop) or 375 (phone, with touch); scheme: 'light' | 'dark' system setting.
export async function open({ state = false, now = '2026-11-03T08:00:00', tz = 'America/Los_Angeles', width = 1440, dpr = 2, scheme = 'light', reducedMotion = 'no-preference', storageBlocked = false } = {}) {
  const browser = await browserFor(width, dpr);
  const phone = width < 768;
  const ctx = await browser.newContext({ viewport: null, timezoneId: tz, colorScheme: scheme, reducedMotion, hasTouch: phone, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 300)}`); });
  await page.clock.install({ time: wallClock(now, tz) });
  if (storageBlocked) {
    await page.addInitScript(() => {
      const deny = () => { throw new DOMException('blocked', 'SecurityError'); };
      Object.defineProperty(window, 'localStorage', { get: deny });
    });
  } else if (state) {
    await page.addInitScript(([k, s]) => { if (!sessionStorage.getItem('e2e-seeded')) { localStorage.setItem(k, JSON.stringify(s)); sessionStorage.setItem('e2e-seeded', '1'); } }, [STORAGE_KEY, state]);
  }
  await page.goto(URL);
  await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  return new App(page, ctx, errors, { width, phone, tz });
}

// '2026-11-03T08:00:00' in `tz` as an instant.
export function wallClock(local, tz) {
  const guess = new Date(`${local}Z`);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(guess);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return new Date(guess.getTime() - (asIfUtc - guess.getTime()));
}

export class App {
  constructor(page, ctx, errors, { width, phone, tz }) {
    Object.assign(this, { page, ctx, errors, width, phone, tz });
  }

  async close() { await this.ctx.close(); }

  // What this device has stored (parsed), or null.
  stored() { return this.page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), STORAGE_KEY); }

  // Tap or click an element the way a person would: scrolled to the middle of the screen first,
  // so the phone's fixed bottom bar never sits over it.
  async tap(target) {
    const loc = typeof target === 'string' ? this.page.getByText(target, { exact: true }).first() : target;
    await loc.waitFor({ state: 'visible', timeout: 5000 });
    await loc.evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'center' }));
    const box = await loc.boundingBox();
    if (!box) throw new Error(`nothing to tap: ${target}`);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    if (this.phone) await this.page.touchscreen.tap(x, y);
    else await this.page.mouse.click(x, y);
    await this.page.waitForTimeout(300);
  }

  button(name, exact = true) { return this.page.getByRole('button', { name, exact }).first(); }
  async press(key) { await this.page.keyboard.press(key); await this.page.waitForTimeout(200); }
  async type(text) { await this.page.keyboard.type(text); }
  async wait(ms) { await this.page.waitForTimeout(ms); }

  // Move the clock forward (e.g. '08:00:00'), then wake the app as a phone does when it is reopened.
  async later(duration) {
    await this.page.clock.fastForward(duration);
    await this.page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
    });
    await this.page.waitForTimeout(300);
  }

  async reload() {
    await this.page.reload();
    await this.page.waitForFunction(() => document.querySelector('#root')?.children.length > 0);
    await this.page.waitForTimeout(300);
  }

  // The day Today is showing, read from the screen: the weekday word over (phone) or under
  // (desktop) the numeral, the numeral itself, and the date in the header (phone) or the
  // Schedule column (desktop).
  shownDay() {
    return this.page.evaluate(() => {
      const leaves = [...document.querySelectorAll('div, span, button')].filter((e) => [...e.childNodes].every((c) => c.nodeType === 3 || c.tagName === 'SPAN'));
      const text = (e) => e.textContent.trim();
      const weekday = leaves.map(text).find((t) => /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/.test(t)) || null;
      const header = leaves.map(text).find((t) => /^[A-Z][a-z]{2} \d{1,2} ?▼$/.test(t) || /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), [A-Z][a-z]+ \d{1,2}$/.test(t)) || null;
      const louver = [...document.querySelectorAll('[role=img]')].map((e) => e.getAttribute('aria-label')).find((l) => /habits done$/.test(l || ''));
      return { weekday, header: header && header.replace(/ ?▼$/, ''), numeral: louver ? Number(louver.split(',')[0]) : null, louver: louver || null };
    });
  }

  // The habit rows on Today, in order, with whether each is checked.
  habitRows() {
    return this.page.evaluate(() => [...document.querySelectorAll('[data-habit-row]')].map((r) => ({ text: r.getAttribute('data-habit-row'), checked: r.getAttribute('aria-checked') === 'true' })));
  }

  // The week strip's day with date number `n`.
  weekDay(n) { return this.page.locator('[data-week-day]').filter({ has: this.page.locator(`[data-date-number="${n}"]`) }).first(); }

  // A day in the month calendar (the month in view), by its date number.
  calendarDay(n) { return this.page.locator(`[data-calendar-day][data-in-month="true"][data-date-number="${n}"]`).first(); }

  // No sideways scroll on the page.
  async assertNoHorizontalScroll(where = '') {
    const over = await this.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(over <= 0, `page scrolls sideways by ${over}px ${where}`);
  }

  assertNoErrors() { assert.deepEqual(this.errors, [], 'console or page errors'); }

  async shot(path) { await this.page.screenshot({ path, fullPage: true }); }
}

// A stored state with the given habits, completions and tasks, as the app would have saved it.
export function stateWith({ habits, completions = {}, todos = [], settings = {}, chapters = {} }) {
  return { habits, completions, todos, chapters, settings: { completionThreshold: 0.8, darkMode: false, ...settings } };
}

// A habit as the app stores it. `since` is the day it began ('YYYY-MM-DD').
export function habit(id, text, { block = 'morning', days = null, minutes = null, since = '2026-10-01', order = 0, stages, ...rest } = {}) {
  const recurrence = days ? { type: 'specific_days', days } : { type: 'daily' };
  return { id, text, timeBlock: block, recurrence, durationMinutes: minutes, sortOrder: order, createdAt: `${since}T12:00:00.000Z`, stages: stages || [{ from: since, text, durationMinutes: minutes, recurrence }], ...rest };
}

// The owner's core list, begun on `since`.
export function coreHabits(since = '2026-10-01') {
  const M2S = [1, 2, 3, 4, 5, 6];
  return [
    habit('cycling', 'Cycling', { days: [1, 3, 5], since, order: 0 }),
    habit('push', 'Push Day', { days: [2], since, order: 1 }),
    habit('pull', 'Pull Day', { days: [4], since, order: 2 }),
    habit('leg', 'Leg Day', { days: [6], since, order: 3 }),
    habit('rest', 'Rest Day', { days: [0], since, order: 4 }),
    habit('walk', '5K Walk', { block: 'postwork', days: M2S, since, order: 0 }),
    habit('study1', 'Study 1 Hour', { block: 'postwork', days: [1, 2, 3], minutes: 60, since, order: 1 }),
    habit('study2', 'Study 2 Hours', { block: 'postwork', days: [4, 5, 6], minutes: 120, since, order: 2 }),
    habit('meditate', 'Meditate', { block: 'evening', days: M2S, since, order: 0 }),
    habit('read', 'Read 30 min', { block: 'evening', days: M2S, minutes: 30, since, order: 1 }),
    habit('water', 'Drink 3L Water', { block: 'evening', days: M2S, since, order: 2 }),
    habit('diet', 'Healthy Diet', { block: 'evening', days: M2S, since, order: 3 }),
  ];
}

// Every day from `from` to `to` (inclusive) with the listed habits checked.
export function keptDays(from, to, ids) {
  const out = {};
  for (let d = new Date(`${from}T12:00:00`); d <= new Date(`${to}T12:00:00`); d.setDate(d.getDate() + 1)) {
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out[k] = Object.fromEntries(ids.map((id) => [id, true]));
  }
  return out;
}
