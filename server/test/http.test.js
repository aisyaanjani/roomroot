import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import test from 'node:test';

test('production HTTP routing, CORS, validation, free-provider failure, and rate limit', async () => {
  const reservation = net.createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const env = { ...process.env, PORT: String(port), NODE_ENV: 'production', FRONTEND_ORIGIN: 'https://aisyaanjani.github.io', AI_PROVIDER: 'openrouter', AI_MODEL: 'google/gemma-4-26b-a4b-it:free', AI_RATE_LIMIT_MAX: '1' };
  delete env.OPENROUTER_API_KEY;
  delete env.GEMINI_API_KEY;
  // Disable dotenv so developer credentials can never be used by this test.
  env.DOTENV_CONFIG_PATH = '/dev/null';
  const child = spawn(process.execPath, ['index.js'], { cwd: new URL('../', import.meta.url), env, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await Promise.race([
      once(child.stdout, 'data'),
      once(child, 'exit').then(() => { throw new Error('Server exited before listening'); }),
      new Promise((_, reject) => { const timeout = setTimeout(() => reject(new Error('Startup timeout')), 5000); timeout.unref(); }),
    ]);
    const base = `http://127.0.0.1:${port}`;
    const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://aisyaanjani.github.io' }, body: JSON.stringify(body) });
    assert.equal((await fetch(base + '/health')).status, 200);
    const cors = await fetch(base + '/api/match', { method: 'OPTIONS', headers: { Origin: 'https://aisyaanjani.github.io', 'Access-Control-Request-Method': 'POST' } });
    assert.equal(cors.status, 204);
    assert.equal(cors.headers.get('access-control-allow-origin'), 'https://aisyaanjani.github.io');
    for (const origin of ['https://evil.invalid', 'http://localhost:5173']) {
      assert.equal((await fetch(base + '/health', { headers: { Origin: origin } })).status, 403);
    }
    assert.equal((await post('/api/match/deterministic', {})).status, 400);
    const profile = { budgetMax: 1200, location: 'Boston', sleepSchedule: 'Early bird', cleanliness: 'Tidy' };
    const payload = { seeker: profile, host: { ...profile, monthlyRent: 1000 } };
    const deterministic = await post('/api/match/deterministic', payload);
    assert.equal(deterministic.status, 200);
    assert.equal((await deterministic.json()).aiGenerated, false);
    const ai = await post('/api/match', payload);
    assert.equal(ai.status, 503);
    assert.equal((await ai.json()).code, 'AI_NOT_CONFIGURED');
    const limited = await post('/api/match', payload);
    assert.equal(limited.status, 429);
    assert.ok(limited.headers.get('retry-after'));
    assert.equal((await post('/api/match/deterministic', { seeker: { text: 'x'.repeat(21000) }, host: profile })).status, 413);
    const malformed = await fetch(base + '/api/match/deterministic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400);
  } finally {
    child.kill('SIGTERM');
    await once(child, 'exit');
  }
});
