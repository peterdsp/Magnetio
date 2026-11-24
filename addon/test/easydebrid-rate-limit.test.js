import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import axios from 'axios';
import { logger } from '../lib/logger.js';
import { parseConfiguration } from '../lib/configuration.js';
import { applyMochs } from '../moch/moch.js';
import { getCachedStreams, resolve } from '../moch/easydebrid.js';

function rateLimited(retryAfter) {
  const err = new Error('Request failed with status code 429');
  err.response = { status: 429, headers: retryAfter == null ? {} : { 'retry-after': retryAfter } };
  return err;
}

function hashes(prefix, count) {
  return Array.from({ length: count }, (_, i) => `${prefix}${i}`.padEnd(40, '0'));
}

test('one EasyDebrid 429 pauses the token instead of firing every queued resolve', async t => {
  const key = 'ed-burst-api-key-000000000001';
  const streams = hashes('e1', 10).map(infoHash => ({ infoHash, name: 'Magnetio', title: 'Movie' }));
  const config = { ...parseConfiguration(''), easyDebridApiKey: key };
  let lookups = 0;
  let generates = 0;
  t.mock.method(axios, 'post', async (url, body) => {
    if (url.endsWith('/link/lookup')) {
      lookups++;
      return { data: { cached: body.urls.map(() => true) } };
    }
    generates++;
    throw rateLimited();
  });
  const warn = t.mock.method(logger, 'warn');

  assert.deepEqual(await applyMochs(streams, config, {}), []);
  // Only the requests already running when the first 429 landed reach ED.
  assert.ok(generates <= 4, `expected at most 4 link/generate calls, got ${generates}`);
  const rateWarnings = warn.mock.calls.filter(call => /EasyDebrid/.test(call.arguments[0]));
  assert.equal(rateWarnings.length, 1);
  assert.match(rateWarnings[0].arguments[0], /rate limited \(429\), pausing this token for 30s/);

  // While paused, the next stream request does not touch EasyDebrid at all.
  const before = { lookups, generates };
  assert.deepEqual(await applyMochs(streams, config, {}), []);
  assert.deepEqual({ lookups, generates }, before);
});

test('EasyDebrid cooldown honours Retry-After and expires', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
  const key = 'ed-retry-after-api-key-0000001';
  const [first, second, third] = hashes('e2', 3);
  let rejectNext = true;
  const post = t.mock.method(axios, 'post', async () => {
    if (rejectNext) {
      rejectNext = false;
      throw rateLimited('120');
    }
    return { data: { url: 'https://cdn.example/ed.mkv' } };
  });
  t.mock.method(logger, 'warn');

  assert.equal(await resolve({ infoHash: first }, key), null);
  assert.equal(post.mock.callCount(), 1);

  t.mock.timers.tick(119_000);
  assert.equal(await resolve({ infoHash: second }, key), null);
  assert.equal((await getCachedStreams([{ infoHash: second }], key)).size, 0);
  assert.equal(post.mock.callCount(), 1);

  // The pause is per token: another account is unaffected.
  assert.equal(await resolve({ infoHash: second }, 'ed-other-account-api-key-00001'), 'https://cdn.example/ed.mkv');
  assert.equal(post.mock.callCount(), 2);

  t.mock.timers.tick(1_001);
  assert.equal(await resolve({ infoHash: third }, key), 'https://cdn.example/ed.mkv');
  assert.equal(post.mock.callCount(), 3);
});

test('EasyDebrid resolve timeout aborts the underlying request', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const key = 'ed-abort-api-key-0000000000001';
  const [infoHash] = hashes('e3', 1);
  const config = { ...parseConfiguration(''), easyDebridApiKey: key };
  let signal;
  t.mock.method(axios, 'post', (url, body, options) => {
    if (url.endsWith('/link/lookup')) return Promise.resolve({ data: { cached: [true] } });
    signal = options.signal;
    assert.ok(signal, 'link/generate must receive an AbortSignal');
    return new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new axios.CanceledError('canceled')));
    });
  });
  const warn = t.mock.method(logger, 'warn');

  const pending = applyMochs([{ infoHash, name: 'Magnetio', title: 'Movie' }], config, {});
  for (let i = 0; i < 50 && !signal; i++) await setImmediate();
  assert.ok(signal, 'link/generate was not called');
  assert.equal(signal.aborted, false);

  t.mock.timers.tick(8_000);
  assert.deepEqual(await pending, []);
  assert.equal(signal.aborted, true);
  // Only the moch timeout is logged, not a second EasyDebrid "canceled" error.
  assert.equal(warn.mock.calls.filter(call => /EasyDebrid error/.test(call.arguments[0])).length, 0);
});
