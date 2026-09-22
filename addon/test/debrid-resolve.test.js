import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveWithCache, tokenScope } from '../moch/mochHelper.js';
import { isReady, describeTbError } from '../moch/torbox.js';

test('resolveWithCache does not cache a failed resolve', async () => {
  const key = `test:resolve:${Date.now()}:miss`;
  let calls = 0;
  const first = await resolveWithCache(key, async () => { calls++; return null; });
  const second = await resolveWithCache(key, async () => { calls++; return 'https://cdn.example/file.mkv'; });
  assert.equal(first, null);
  assert.equal(second, 'https://cdn.example/file.mkv');
  assert.equal(calls, 2);
});

test('resolveWithCache caches a successful resolve', async () => {
  const key = `test:resolve:${Date.now()}:hit`;
  let calls = 0;
  const resolver = async () => { calls++; return 'https://cdn.example/a.mkv'; };
  assert.equal(await resolveWithCache(key, resolver), 'https://cdn.example/a.mkv');
  assert.equal(await resolveWithCache(key, resolver), 'https://cdn.example/a.mkv');
  assert.equal(calls, 1);
});

test('tokenScope separates users and never exposes the key', () => {
  const a = tokenScope('user-a-api-key-1234567890');
  const b = tokenScope('user-b-api-key-1234567890');
  assert.notEqual(a, b);
  assert.equal(a, tokenScope('user-a-api-key-1234567890'));
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.ok(!a.includes('user-a'));
});

test('TorBox isReady accepts cached torrents, not only "completed"', () => {
  assert.equal(isReady({ download_state: 'cached', download_present: true }), true);
  assert.equal(isReady({ download_state: 'uploading', download_finished: true }), true);
  assert.equal(isReady({ download_state: 'downloading', download_present: false }), false);
  assert.equal(isReady(null), false);
});

test('describeTbError summarises TorBox error bodies', () => {
  assert.equal(
    describeTbError({ success: false, error: 'ACTIVE_LIMIT', detail: 'Too many active downloads' }),
    'ACTIVE_LIMIT (Too many active downloads)',
  );
  assert.equal(
    describeTbError({ detail: [{ type: 'missing', loc: ['query', 'token'], msg: 'Field required' }] }),
    'UNKNOWN (query.token: Field required)',
  );
  assert.equal(describeTbError({}), 'UNKNOWN');
});
