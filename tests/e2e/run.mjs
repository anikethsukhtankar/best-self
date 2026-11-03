// npm run e2e                      build, serve, and run every journey in tests/e2e/*.journey.mjs
// npm run e2e -- today habits     only those journey files
// npm run e2e -- --grep midnight  only journeys whose name matches
// npm run e2e -- --no-build       use the dist/ already built
// E2E_PORT and E2E_RESULTS set the port and the folder for failure screenshots.
// Each journey is { name, run(t) }: t.open(options) opens the app (see harness.mjs) and is closed
// for it afterwards. One line per journey; a failing journey leaves a screenshot in e2e-results/.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve, open, closeBrowsers, PORT } from './harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const grepAt = args.indexOf('--grep');
const grep = grepAt >= 0 ? new RegExp(args[grepAt + 1], 'i') : null;
const only = args.filter((a, i) => !a.startsWith('--') && (grepAt < 0 || i !== grepAt + 1));
const results = process.env.E2E_RESULTS || path.join(here, '..', '..', 'e2e-results');
const TIMEOUT = 90000;

if (!args.includes('--no-build')) execSync('npx vite build', { stdio: 'ignore' });
fs.rmSync(results, { recursive: true, force: true });
fs.mkdirSync(results, { recursive: true });

const files = fs.readdirSync(here).filter((f) => f.endsWith('.journey.mjs')).filter((f) => !only.length || only.some((o) => f.startsWith(o))).sort();
const server = await serve();
let passed = 0;
let failed = 0;
const failures = [];
const started = Date.now();
try {
  for (const file of files) {
    const journeys = (await import(pathToFileURL(path.join(here, file)))).default.filter((j) => !grep || grep.test(j.name));
    if (!journeys.length) continue;
    console.log(`\n${file.replace('.journey.mjs', '')}`);
    for (const j of journeys) {
      const opened = [];
      const t = { open: async (o) => { const app = await open(o); opened.push(app); return app; } };
      const t0 = Date.now();
      let error = null;
      try {
        await Promise.race([j.run(t), new Promise((_, no) => setTimeout(() => no(new Error(`timed out after ${TIMEOUT / 1000}s`)), TIMEOUT))]);
      } catch (e) { error = e; }
      if (error) {
        const slug = j.name.replace(/[^a-z0-9]+/gi, '-').slice(0, 80);
        for (const [i, app] of opened.entries()) await app.page.screenshot({ path: path.join(results, `${slug}-${i}.png`), fullPage: true }).catch(() => {});
        failures.push({ name: j.name, file, error });
        failed++;
        console.log(`  ✗ ${j.name}\n      ${String(error.message || error).split('\n').join('\n      ')}`);
      } else {
        passed++;
        console.log(`  ✓ ${j.name}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
      }
      for (const app of opened) await app.close().catch(() => {});
    }
  }
} finally {
  await closeBrowsers();
  server.kill();
}
const total = passed + failed;
console.log(`\n${passed}/${total} journeys pass${failed ? `, ${failed} fail (screenshots in ${path.relative(process.cwd(), results) || results})` : ''} on port ${PORT} in ${((Date.now() - started) / 1000).toFixed(0)}s`);
fs.writeFileSync(path.join(results, 'summary.json'), JSON.stringify({ passed, failed, total, failures: failures.map((f) => ({ name: f.name, file: f.file, error: String(f.error?.message || f.error) })) }, null, 2));
process.exit(failed ? 1 : 0);
